import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, cookieFor, setSecrets } from './helpers';
import { mailTables, table } from './fakes';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/dispatch', () => ({ dispatchOutbox: vi.fn() }));

import { GET as list } from '@/app/api/admin/notifications/route';
import { POST as markRead } from '@/app/api/admin/notifications/read/route';
import { GET as mailStatus } from '@/app/api/admin/email-outbox/route';
import { POST as retryOne } from '@/app/api/admin/email-outbox/[id]/retry/route';
import { POST as retryAll } from '@/app/api/admin/email-outbox/retry-all/route';
import { GET as cron } from '@/app/api/cron/process-email-outbox/route';
import { links, notify } from '@/lib/notifications';

const ADMIN2 = '99999999-9999-4999-8999-999999999999';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const req = (url: string, method = 'GET', cookie?: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const admin = (id = ADMIN_ID) => cookieFor({ userId: id, admin: true });
const client = () => cookieFor({ userId: CLIENT_ID, admin: false });

function seed(n: number) {
  for (let i = 1; i <= n; i++) {
    h.db.adminNotification.rows.push({ id: uuid(i), type: 'inquiry.new', title: `Inquiry ${i}`, body: null, url: `/admin?view=inquiries&inquiry=${i}`, createdAt: new Date(Date.now() - (n - i) * 1000) });
  }
}

beforeEach(() => {
  setSecrets();
  const tables = mailTables();
  const reads: any[] = [];
  const notifications = table([], {
    unique: 'dedupeKey', defaults: () => ({ createdAt: new Date(), body: null }),
    nested: (row, k, v) => (k === 'reads' && v.none ? !reads.some((r) => r.notificationId === row.id && r.userId === v.none.userId) : true),
  });
  const findMany = notifications.findMany;
  notifications.findMany = async (args: any) => (await findMany(args)).map((r: any) => ({ ...r, reads: reads.filter((x) => x.notificationId === r.id && x.userId === ADMIN_CTX.id).map((x) => ({ readAt: x.readAt })) }));
  const rr = { createMany: async ({ data }: any) => { for (const d of data) if (!reads.some((r) => r.notificationId === d.notificationId && r.userId === d.userId)) reads.push({ ...d, readAt: new Date() }); return { count: data.length }; } };
  h.db = {
    user: table([
      { id: ADMIN_ID, name: 'A', email: 'a@x.co', admin: true, role: 'ADMIN', status: 'ACTIVE', sessionVersion: 0, inquiryId: null },
      { id: ADMIN2, name: 'B', email: 'b@x.co', admin: true, role: 'ADMIN', status: 'ACTIVE', sessionVersion: 0, inquiryId: null },
      { id: CLIENT_ID, name: 'C', email: 'c@x.co', admin: false, role: 'CLIENT', status: 'ACTIVE', sessionVersion: 0, inquiryId: null },
    ]),
    emailOutbox: tables.emailOutbox,
    adminNotification: notifications,
    notificationRead: rr,
    auditLog: table(),
  };
  h.db.reads = reads;
});

// The list endpoint reports read state for whoever is asking; the fake needs to know who that is.
const ADMIN_CTX = { id: ADMIN_ID };
const as = (id: string) => { ADMIN_CTX.id = id; return admin(id); };

describe('notifications are admin-only', () => {
  it.each([
    ['list', () => list(req('/api/admin/notifications') as never)],
    ['mark read', () => markRead(req('/api/admin/notifications/read', 'POST', undefined, { all: true }) as never)],
    ['email status', () => mailStatus(req('/api/admin/email-outbox') as never)],
  ])('%s: anonymous → 401', async (_n, call) => { expect((await call()).status).toBe(401); });

  it.each([
    ['list', () => list(req('/api/admin/notifications', 'GET', client()) as never)],
    ['mark read', () => markRead(req('/api/admin/notifications/read', 'POST', client(), { all: true }) as never)],
    ['email status', () => mailStatus(req('/api/admin/email-outbox', 'GET', client()) as never)],
    ['retry all', () => retryAll(req('/api/admin/email-outbox/retry-all', 'POST', client()) as never)],
    ['retry one', () => retryOne(req('/x', 'POST', client()) as never, { params: Promise.resolve({ id: uuid(1) }) })],
  ])('%s: a customer → 403 and nothing leaks', async (_n, call) => {
    seed(2);
    const res = await call();
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain('Inquiry');
  });
});

describe('the feed', () => {
  it('shows a clear empty state when there is nothing — no placeholder items', async () => {
    const body = await (await list(req('/api/admin/notifications', 'GET', as(ADMIN_ID)) as never)).json();
    expect(body).toMatchObject({ ok: true, items: [], unread: 0, nextCursor: null });
  });

  it('lists newest first with a deep link, and pages with a cursor', async () => {
    seed(30);
    const first = await (await list(req('/api/admin/notifications?limit=10', 'GET', as(ADMIN_ID)) as never)).json();
    expect(first.items).toHaveLength(10);
    expect(first.items[0].title).toBe('Inquiry 30');
    expect(first.items[0].url).toBe('/admin?view=inquiries&inquiry=30');
    expect(first.unread).toBe(30);
    const second = await (await list(req(`/api/admin/notifications?limit=10&cursor=${encodeURIComponent(first.nextCursor)}`, 'GET', as(ADMIN_ID)) as never)).json();
    expect(second.items[0].title).toBe('Inquiry 20');
    expect(new Set([...first.items, ...second.items].map((i: any) => i.id)).size).toBe(20);
  });

  it('read state is saved on the server and per admin', async () => {
    seed(3);
    await markRead(req('/x', 'POST', as(ADMIN_ID), { ids: [uuid(3)] }) as never);
    const mine = await (await list(req('/api/admin/notifications', 'GET', as(ADMIN_ID)) as never)).json();   // "after a refresh"
    expect(mine.unread).toBe(2);
    expect(mine.items.find((i: any) => i.id === uuid(3)).read).toBe(true);
    const other = await (await list(req('/api/admin/notifications', 'GET', as(ADMIN2)) as never)).json();
    expect(other.unread).toBe(3);                         // another admin still sees it as new
    expect(other.items.every((i: any) => !i.read)).toBe(true);
  });

  it('the unread filter and mark-all-as-read', async () => {
    seed(4);
    await markRead(req('/x', 'POST', as(ADMIN_ID), { ids: [uuid(1), uuid(2)] }) as never);
    const unread = await (await list(req('/api/admin/notifications?filter=unread', 'GET', as(ADMIN_ID)) as never)).json();
    expect(unread.items.map((i: any) => i.title).sort()).toEqual(['Inquiry 3', 'Inquiry 4']);
    const res = await (await markRead(req('/x', 'POST', as(ADMIN_ID), { all: true }) as never)).json();
    expect(res.unread).toBe(0);
    expect((await (await list(req('/api/admin/notifications?filter=unread', 'GET', as(ADMIN_ID)) as never)).json()).items).toEqual([]);
  });

  it('marking read twice is harmless; bad input is refused', async () => {
    seed(1);
    await markRead(req('/x', 'POST', as(ADMIN_ID), { ids: [uuid(1)] }) as never);
    expect((await markRead(req('/x', 'POST', as(ADMIN_ID), { ids: [uuid(1)] }) as never)).status).toBe(200);
    expect(h.db.reads).toHaveLength(1);
    for (const bad of [{}, { ids: [] }, { ids: ['nope'] }, { ids: Array.from({ length: 101 }, (_, i) => uuid(i + 1)) }, { ids: 'x' }]) {
      expect((await markRead(req('/x', 'POST', as(ADMIN_ID), bad) as never)).status).toBe(400);
    }
    expect((await list(req('/api/admin/notifications?cursor=garbage', 'GET', as(ADMIN_ID)) as never)).status).toBe(400);
  });
});

describe('events appear once', () => {
  const event = { type: 'inquiry.new' as const, title: 'New inquiry from Ada', url: links.inquiry('abc'), dedupeKey: 'inquiry.new:abc' };
  it('recording the same event again (a retry) does not add a second item', async () => {
    await notify(h.db, event);
    await notify(h.db, event);
    await notify(h.db, { ...event, title: 'changed' });
    expect(h.db.adminNotification.rows).toHaveLength(1);
  });
  it('deep links point at the right records', () => {
    expect(links.inquiry('i1')).toBe('/admin?view=inquiries&inquiry=i1');
    expect(links.project('p1')).toBe('/admin?view=projects&project=p1');
    expect(links.folder({ id: 'f1', inquiryId: null, projectId: 'p1' })).toBe('/admin?view=projects&project=p1&tab=deliverables&folder=f1');
    expect(links.folder({ id: 'f1', inquiryId: 'i1', projectId: null })).toBe('/admin?view=inquiries&inquiry=i1&tab=deliverables&folder=f1');
    expect(links.clients()).toBe('/admin?view=clients');
  });
});

describe('email delivery controls', () => {
  const dead = (over = {}) => ({ id: uuid(50), eventType: 'inquiry.notification', recipient: 'studio@example.com', status: 'DEAD', attempts: 8, maxAttempts: 8, nextAttemptAt: new Date(), createdAt: new Date(), lastError: 'connect ECONNREFUSED', manualRetries: 0, ...over });

  it('an admin sees what failed, with masked recipients', async () => {
    h.db.emailOutbox.rows.push(dead());
    const body = await (await mailStatus(req('/x', 'GET', admin()) as never)).json();
    expect(body.failed).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain('studio@example.com');
  });
  it('Retry puts a failed email back in the queue and is audited; a sent one cannot be retried', async () => {
    h.db.emailOutbox.rows.push(dead(), dead({ id: uuid(51), status: 'SENT' }));
    const ok = await retryOne(req('/x', 'POST', admin()) as never, { params: Promise.resolve({ id: uuid(50) }) });
    expect(ok.status).toBe(200);
    expect(h.db.emailOutbox.rows[0]).toMatchObject({ status: 'PENDING', attempts: 0 });
    expect(h.db.auditLog.rows.map((r: any) => r.action)).toEqual(['email.retry']);
    const sent = await retryOne(req('/x', 'POST', admin()) as never, { params: Promise.resolve({ id: uuid(51) }) });
    expect(sent.status).toBe(409);
    expect(h.db.emailOutbox.rows[1].status).toBe('SENT');
  });
  it('Retry all revives only failed emails', async () => {
    h.db.emailOutbox.rows.push(dead(), dead({ id: uuid(52), eventType: 'inquiry.confirmation' }), dead({ id: uuid(53), status: 'SENT' }));
    const body = await (await retryAll(req('/x', 'POST', admin()) as never)).json();
    expect(body.retried).toBe(2);
    expect(h.db.emailOutbox.rows.find((r: any) => r.id === uuid(53)).status).toBe('SENT');
  });
});

describe('the scheduled worker', () => {
  const run = (auth?: string) => cron(req('/api/cron/process-email-outbox', 'GET', undefined, undefined, auth ? { authorization: auth } : {}) as never);
  beforeEach(() => { process.env.CRON_SECRET = 'c'.repeat(32); });

  it('refuses anyone without the secret', async () => {
    expect((await run()).status).toBe(401);
    expect((await run('Bearer wrong')).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await run('Bearer undefined')).status).toBe(401);
  });
  it('sends due email, and prunes old records while keeping failures', async () => {
    const old = new Date(Date.now() - 100 * 86400_000);
    h.db.emailOutbox.rows.push(
      { id: uuid(60), status: 'SENT', createdAt: old, eventType: 'x', recipient: 'a@b.co', dedupeKey: 'k1' },
      { id: uuid(61), status: 'DEAD', createdAt: old, eventType: 'x', recipient: 'a@b.co', dedupeKey: 'k2' },
    );
    h.db.adminNotification.rows.push({ id: uuid(62), createdAt: new Date(Date.now() - 200 * 86400_000), dedupeKey: 'n1' });
    h.db.adminNotification.deleteMany = async () => { h.db.adminNotification.rows.length = 0; return { count: 1 }; };
    const body = await (await run(`Bearer ${'c'.repeat(32)}`)).json();
    expect(body.ok).toBe(true);
    expect(h.db.emailOutbox.rows.map((r: any) => r.id)).toEqual([uuid(61)]);
  });
});
