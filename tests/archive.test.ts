import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, INQUIRY_ID, cookieFor, setSecrets } from './helpers';
import { FakeStorage, table } from './fakes';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { setStorageProvider } from '@/lib/storage';
import * as inquiryRoute from '@/app/api/admin/inquiries/[id]/route';
import { GET as preview, POST as purge } from '@/app/api/admin/inquiries/[id]/purge/route';
import { POST as approve } from '@/app/api/inquiries/[id]/approve/route';

const req = (method: string, body?: unknown, cookie?: string) =>
  new NextRequest('http://localhost/x', { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const admin = () => cookieFor({ userId: ADMIN_ID, admin: true });
const ctx = { params: Promise.resolve({ id: INQUIRY_ID }) };
let storage: FakeStorage;

beforeEach(() => {
  setSecrets();
  Object.assign(process.env, { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(40) });
  storage = new FakeStorage();
  setStorageProvider(storage);
  h.db = {
    user: table([
      { id: ADMIN_ID, name: 'A', email: 'a@x.co', admin: true, role: 'ADMIN', status: 'ACTIVE', sessionVersion: 0, inquiryId: null },
      { id: CLIENT_ID, name: 'C', email: 'c@x.co', admin: false, role: 'CLIENT', status: 'ACTIVE', sessionVersion: 0, inquiryId: null },
    ]),
    inquiry: table([{ id: INQUIRY_ID, archivedAt: null, archivedById: null, companyRecord: null, user: null, project: null }]),
    deliverableFolder: table(),
    deliverable: table(),
    inquiryAttachment: table([{ id: 'a1', inquiryId: INQUIRY_ID, storageKey: 'inquiries/a1' }]),
    auditLog: table(),
  };
  h.db.$transaction = async (fn: any) => fn(h.db);
  storage.put('inquiries/a1', Buffer.from('x'));
});

const inq = () => h.db.inquiry.rows[0];

describe('archive and restore', () => {
  it('archives without touching anything linked to the inquiry', async () => {
    Object.assign(inq(), { companyRecord: { id: 'c1' }, user: { id: 'u1' }, project: { id: 'p1' } });
    h.db.deliverableFolder.rows.push({ id: 'fo1', inquiryId: INQUIRY_ID });
    h.db.deliverable.rows.push({ id: 'd1', inquiryId: INQUIRY_ID, folderId: 'fo1', status: 'READY' });
    const before = JSON.stringify([h.db.deliverableFolder.rows, h.db.deliverable.rows, inq().project, inq().user, inq().companyRecord]);

    const res = await inquiryRoute.PATCH(req('PATCH', { archived: true }, admin()) as never, ctx);
    expect(res.status).toBe(200);
    expect(inq().archivedAt).toBeInstanceOf(Date);
    expect(inq().archivedById).toBe(ADMIN_ID);
    expect(JSON.stringify([h.db.deliverableFolder.rows, h.db.deliverable.rows, inq().project, inq().user, inq().companyRecord])).toBe(before);
    expect(storage.removed).toEqual([]);
    expect(h.db.auditLog.rows.map((r: any) => r.action)).toEqual(['inquiry.archive']);
  });
  it('can be restored, and is audited', async () => {
    await inquiryRoute.PATCH(req('PATCH', { archived: true }, admin()) as never, ctx);
    await inquiryRoute.PATCH(req('PATCH', { archived: false }, admin()) as never, ctx);
    expect(inq().archivedAt).toBeNull();
    expect(h.db.auditLog.rows.map((r: any) => r.action)).toEqual(['inquiry.archive', 'inquiry.restore']);
  });
  it('is admin-only', async () => {
    expect((await inquiryRoute.PATCH(req('PATCH', { archived: true }) as never, ctx)).status).toBe(401);
    expect((await inquiryRoute.PATCH(req('PATCH', { archived: true }, cookieFor({ userId: CLIENT_ID, admin: false })) as never, ctx)).status).toBe(403);
    expect(inq().archivedAt).toBeNull();
  });
  it('has no DELETE handler at all (no hidden hard delete)', () => {
    expect((inquiryRoute as Record<string, unknown>).DELETE).toBeUndefined();
  });
  it('an archived, never-approved inquiry cannot be approved until restored', async () => {
    inq().archivedAt = new Date();
    const tx = { $queryRaw: async () => [], inquiry: { findUnique: async () => ({ ...inq(), name: 'N', email: 'e@x.co', service: 's', description: 'd', companyRecord: null, user: null, project: null }), update: vi.fn() }, company: { upsert: vi.fn() } };
    h.db.$transaction = async (fn: any) => fn(tx);
    const res = await approve(req('POST', {}, admin()) as never, ctx);
    expect(res.status).toBe(409);
    expect(tx.inquiry.update).not.toHaveBeenCalled();
    expect(tx.company.upsert).not.toHaveBeenCalled();
  });
});

describe('permanent delete is a separate, guarded action', () => {
  const confirm = (extra: object = {}) => purge(req('POST', { confirm: INQUIRY_ID, ...extra }, admin()) as never, ctx);

  it('refuses unless the inquiry is archived', async () => {
    const res = await confirm();
    expect(res.status).toBe(409);
    expect(h.db.inquiry.rows).toHaveLength(1);
  });
  it('refuses when a client, company or project came from it', async () => {
    Object.assign(inq(), { archivedAt: new Date(), project: { id: 'p1' } });
    expect((await confirm()).status).toBe(409);
    expect(h.db.inquiry.rows).toHaveLength(1);
  });
  it('refuses when it has delivery folders or files — client work is never deleted with a lead', async () => {
    inq().archivedAt = new Date();
    h.db.deliverableFolder.rows.push({ id: 'fo1', inquiryId: INQUIRY_ID });
    const res = await confirm();
    expect(res.status).toBe(409);
    expect((await res.json()).blockers.join(' ')).toMatch(/delivery folders or files/);
    expect(h.db.inquiry.rows).toHaveLength(1);
  });
  it('needs the inquiry id typed back as confirmation', async () => {
    inq().archivedAt = new Date();
    expect((await purge(req('POST', {}, admin()) as never, ctx)).status).toBe(400);
    expect((await purge(req('POST', { confirm: 'yes' }, admin()) as never, ctx)).status).toBe(400);
    expect(h.db.inquiry.rows).toHaveLength(1);
  });
  it('is admin-only', async () => {
    inq().archivedAt = new Date();
    expect((await purge(req('POST', { confirm: INQUIRY_ID }) as never, ctx)).status).toBe(401);
    expect((await purge(req('POST', { confirm: INQUIRY_ID }, cookieFor({ userId: CLIENT_ID, admin: false })) as never, ctx)).status).toBe(403);
    expect(h.db.inquiry.rows).toHaveLength(1);
  });
  it('removes an archived plain lead, its stored attachments, and writes an audit record', async () => {
    inq().archivedAt = new Date();
    const res = await confirm();
    expect(res.status).toBe(200);
    expect(h.db.inquiry.rows).toHaveLength(0);
    expect(storage.removed).toEqual(['inquiries/a1']);
    expect(h.db.auditLog.rows.map((r: any) => r.action)).toEqual(['inquiry.purge']);
  });
  it('the preview shows what blocks it', async () => {
    const res = await preview(req('GET', undefined, admin()) as never, ctx);
    const body = await res.json();
    expect(body.allowed).toBe(false);
    expect(body.blockers[0]).toMatch(/Archive the inquiry first/);
  });
});
