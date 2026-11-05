import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, INQUIRY_ID, allKeys, cookieFor, setSecrets } from './helpers';
import { makeOnboardingDb } from './onboardingDb';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/dispatch', () => ({ dispatchOutbox: vi.fn() }));

import { POST as approve } from '@/app/api/inquiries/[id]/approve/route';
import { POST as reject } from '@/app/api/admin/inquiries/[id]/reject/route';
import { POST as reopen } from '@/app/api/admin/inquiries/[id]/reopen/route';
import { canReview } from '@/lib/inquiryReview';

const ctx = (id = INQUIRY_ID) => ({ params: Promise.resolve({ id }) });
const req = (body?: unknown, cookie?: string) =>
  new NextRequest('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const admin = () => cookieFor({ userId: ADMIN_ID, admin: true });
const customer = () => cookieFor({ userId: CLIENT_ID, admin: false });
const inq = () => h.db.inquiry.rows[0];
const doApprove = () => approve(req(undefined, admin()) as never, ctx());
const doReject = (body: unknown = {}) => reject(req(body, admin()) as never, ctx());
const nothingCreated = () => {
  expect(h.db.company.rows).toHaveLength(0);
  expect(h.db.project.rows).toHaveLength(0);
  expect(h.db.user.rows.filter((u: any) => u.inquiryId)).toHaveLength(0);
  expect(h.db.emailOutbox.rows).toHaveLength(0);
};

beforeEach(() => { setSecrets(); h.db = makeOnboardingDb(); });

describe('approving an inquiry', () => {
  it('creates the client, company and project, and queues exactly one invitation — with no password anywhere', async () => {
    const res = await doApprove();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyApproved).toBeUndefined();
    expect(inq()).toMatchObject({ status: 'APPROVED', approvedById: ADMIN_ID });

    const created = h.db.user.rows.find((u: any) => u.inquiryId === INQUIRY_ID);
    expect(created).toMatchObject({ status: 'INVITED', email: 'ada@example.com', role: 'CLIENT' });   // lower-cased so sign-in finds it
    expect(created.passwordHash ?? null).toBeNull();
    expect(h.db.company.rows[0].name).toBe('Analytical Co');
    expect(h.db.project.rows[0]).toMatchObject({ primaryUserId: created.id, companyId: h.db.company.rows[0].id });

    const jobs = h.db.emailOutbox.rows;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ eventType: 'client.invitation', recipient: 'ada@example.com', status: 'PENDING', dedupeKey: `invite:${created.id}` });
    expect(JSON.stringify(jobs)).not.toMatch(/token|password/i);
    expect(h.db.adminNotification.rows.map((n: any) => n.type)).toEqual(['inquiry.approved']);
    for (const k of ['passwordHash', 'templogincode', 'sessionVersion']) expect(allKeys(body).has(k)).toBe(false);
  });

  it('clicking Approve again changes nothing and says so', async () => {
    await doApprove();
    const again = await (await doApprove()).json();
    expect(again).toMatchObject({ ok: true, alreadyApproved: true });
    expect(h.db.company.rows).toHaveLength(1);
    expect(h.db.project.rows).toHaveLength(1);
    expect(h.db.emailOutbox.rows).toHaveLength(1);       // no second invitation
    expect(h.db.auditLog.rows.filter((a: any) => a.action === 'inquiry.approve')).toHaveLength(1);
  });

  it('an incomplete inquiry is refused with a useful message and creates nothing', async () => {
    inq().description = '';
    const res = await doApprove();
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/description/);
    expect(inq().status).toBe('INQUIRY');
    nothingCreated();
  });

  it('an email that already belongs to an account is a clear conflict; the existing account is untouched', async () => {
    h.db.user.rows.push({ id: 'existing', name: 'Real Ada', email: 'ada@example.com', status: 'ACTIVE', admin: false, inquiryId: null, passwordHash: 'keep', sessionVersion: 0 });
    const res = await doApprove();
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('EMAIL_EXISTS');
    expect(body.error).toMatch(/already exists/);
    expect(inq().status).toBe('INQUIRY');
    expect(h.db.user.rows.find((u: any) => u.id === 'existing')).toMatchObject({ passwordHash: 'keep', inquiryId: null, name: 'Real Ada' });
    expect(h.db.company.rows).toHaveLength(0);
    expect(h.db.project.rows).toHaveLength(0);
    expect(h.db.emailOutbox.rows).toHaveLength(0);
  });

  it('a rejected inquiry cannot be approved until it is reopened', async () => {
    await doReject({ reason: 'spam' });
    const res = await doApprove();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('REJECTED');
    nothingCreated();
    await reopen(req(undefined, admin()) as never, ctx());
    expect((await doApprove()).status).toBe(200);
  });

  it('an archived inquiry cannot be approved until it is restored', async () => {
    inq().archivedAt = new Date();
    const res = await doApprove();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('ARCHIVED');
    nothingCreated();
  });

  it('a failure part-way (e.g. the invitation can’t be queued) leaves nothing half-created', async () => {
    h.db.emailOutbox.createMany = async () => { throw new Error('queue unavailable'); };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await doApprove()).status).toBe(500);
    expect(inq().status).toBe('INQUIRY');
    nothingCreated();
  });

  it('anonymous and customer callers can neither approve nor learn anything', async () => {
    expect((await approve(req() as never, ctx())).status).toBe(401);
    const res = await approve(req(undefined, customer()) as never, ctx());
    expect(res.status).toBe(403);
    expect(inq().status).toBe('INQUIRY');
    nothingCreated();
  });
});

describe('rejecting an inquiry', () => {
  it('closes it with who/when/why, creates nothing, deletes nothing and emails nobody', async () => {
    const res = await doReject({ reason: 'Not a fit — outside our services' });
    expect(res.status).toBe(200);
    expect(inq()).toMatchObject({ status: 'REJECTED', rejectedById: ADMIN_ID, rejectionReason: 'Not a fit — outside our services' });
    expect(inq().rejectedAt).toBeInstanceOf(Date);
    nothingCreated();
    expect(h.db.inquiryAttachment.rows).toHaveLength(1);     // attachments stay
    expect(h.db.adminNotification.rows).toHaveLength(0);
    expect(h.db.auditLog.rows.map((a: any) => a.action)).toEqual(['inquiry.reject']);
    expect(JSON.stringify(h.db.auditLog.rows)).not.toContain('outside our services');   // the note isn't copied around
    expect(JSON.stringify(await res.json())).not.toContain('outside our services');
  });

  it('the reason is optional and is cleaned of control characters and length', async () => {
    await doReject({});
    expect(inq().rejectionReason).toBeNull();
    inq().status = 'INQUIRY'; inq().rejectedAt = null;
    await doReject({ reason: 'bad\r\nBcc: x' + 'y'.repeat(600) });
    expect(inq().rejectionReason).not.toMatch(/[\r\n]/);
    expect(inq().rejectionReason.length).toBeLessThanOrEqual(500);
    expect((await doReject({ reason: 42 })).status).toBe(400);
  });

  it('a repeated click is harmless and not recorded twice', async () => {
    await doReject({ reason: 'first' });
    const again = await (await doReject({ reason: 'second' })).json();
    expect(again).toMatchObject({ ok: true, alreadyRejected: true });
    expect(inq().rejectionReason).toBe('first');
    expect(h.db.auditLog.rows).toHaveLength(1);
  });

  it('an approved inquiry can’t be rejected, and its project is left alone', async () => {
    await doApprove();
    const res = await doReject({ reason: 'oops' });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('APPROVED');
    expect(inq().status).toBe('APPROVED');
    expect(h.db.project.rows).toHaveLength(1);
    expect(h.db.user.rows.find((u: any) => u.inquiryId === INQUIRY_ID)).toBeTruthy();
  });

  it('an archived inquiry can’t be rejected until restored', async () => {
    inq().archivedAt = new Date();
    expect((await doReject()).status).toBe(409);
    expect(inq().status).toBe('INQUIRY');
  });

  it('losing a race with an approval is reported, not silently overwritten', async () => {
    const original = h.db.inquiry.updateMany;
    h.db.inquiry.updateMany = async (args: any) => { inq().status = 'APPROVED'; return original(args); };   // approved in between
    const res = await doReject();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('CHANGED');
    expect(inq().status).toBe('APPROVED');
  });

  it('is admin-only: anonymous 401, customer 403, and nothing changes or is revealed', async () => {
    inq().rejectionReason = 'secret internal note'; inq().status = 'REJECTED';
    for (const [cookie, status] of [[undefined, 401], [customer(), 403]] as const) {
      const res = await reject(req({ reason: 'x' }, cookie) as never, ctx());
      expect(res.status).toBe(status);
      expect(JSON.stringify(await res.json())).not.toContain('secret internal note');
    }
    expect((await reopen(req(undefined) as never, ctx())).status).toBe(401);
    expect((await reopen(req(undefined, customer()) as never, ctx())).status).toBe(403);
    expect(inq().status).toBe('REJECTED');
  });

  it('validates the id and reports unknown inquiries', async () => {
    expect((await reject(req({}, admin()) as never, ctx('not-a-uuid'))).status).toBe(404);
    expect((await reject(req({}, admin()) as never, ctx('99999999-9999-4999-8999-999999999999'))).status).toBe(404);
  });
});

describe('reopening', () => {
  it('returns a rejected inquiry to review and clears the rejection', async () => {
    await doReject({ reason: 'later' });
    expect((await reopen(req(undefined, admin()) as never, ctx())).status).toBe(200);
    expect(inq()).toMatchObject({ status: 'INQUIRY', rejectedAt: null, rejectedById: null, rejectionReason: null });
    expect(h.db.auditLog.rows.map((a: any) => a.action)).toEqual(['inquiry.reject', 'inquiry.reopen']);
  });
  it('only applies to rejected inquiries', async () => {
    await doApprove();
    expect((await reopen(req(undefined, admin()) as never, ctx())).status).toBe(409);
    expect(inq().status).toBe('APPROVED');
  });
});

describe('transition policy', () => {
  it.each([
    ['approve', 'INQUIRY', null, true], ['approve', 'REJECTED', null, false], ['approve', 'APPROVED', null, true], ['approve', 'INQUIRY', new Date(), false],
    ['reject', 'INQUIRY', null, true], ['reject', 'APPROVED', null, false], ['reject', 'REJECTED', null, true], ['reject', 'INQUIRY', new Date(), false],
    ['reopen', 'REJECTED', null, true], ['reopen', 'INQUIRY', null, false], ['reopen', 'REJECTED', new Date(), false],
  ] as const)('%s on %s (archived: %s) → allowed: %s', (action, status, archivedAt, allowed) => {
    expect(canReview({ status, archivedAt }, action).ok).toBe(allowed);
  });
});
