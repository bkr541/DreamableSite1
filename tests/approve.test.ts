import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, INQUIRY_ID, allKeys, cookieFor, req, setSecrets } from './helpers';

const state = vi.hoisted(() => ({
  users: new Map<string, Record<string, unknown>>(),
  tx: {} as Record<string, any>,
  transaction: null as any,
  inquiry: null as any,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(async ({ where }: any) => state.users.get(where.id) ?? null) },
    $transaction: vi.fn((fn: any) => state.transaction(fn)),
  },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/dispatch', () => ({ dispatchOutbox: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { POST } from '@/app/api/inquiries/[id]/approve/route';
import { prisma } from '@/lib/prisma';

const SECRET_FIELDS = ['passwordHash', 'password_hash', 'templogincode', 'tempLoginCodeExpiresAt', 'sessionVersion', 'tokenHash'];
const ctx = (id = INQUIRY_ID) => ({ params: Promise.resolve({ id }) });
const admin = () => cookieFor({ userId: ADMIN_ID, admin: true });

const baseInquiry = {
  id: INQUIRY_ID, name: 'Ada', email: 'ada@example.com', company: 'Acme', website: null, service: 'Branding', description: 'x',
  budgetRange: null, timeline: null, status: 'INQUIRY', approvedAt: null, approvedById: null,
  companyRecord: null, user: null, project: null,
};
const fullUser = { id: 'u1', name: 'Ada', email: 'ada@example.com', role: 'CLIENT', status: 'INVITED', companyId: 'c1',
  passwordHash: 'salt:hash', templogincode: 'ABCD1234', tempLoginCodeExpiresAt: new Date(), sessionVersion: 3, admin: false };

function makeTx(opts: { existing?: boolean; failAuditWrite?: boolean } = {}) {
  const writes: string[] = [];
  const co = { id: 'c1', name: 'Acme', website: null, status: 'ACTIVE', inquiryId: INQUIRY_ID };
  const proj = { id: 'p1', name: 'Branding Project', service: 'Branding', status: 'ONBOARDING', companyId: 'c1', primaryUserId: 'u1', description: 'x' };
  const tx = {
    $queryRaw: vi.fn(async () => []),
    inquiry: {
      findUnique: vi.fn(async () => (opts.existing
        ? { ...baseInquiry, status: 'APPROVED', approvedAt: new Date(), companyRecord: co, user: fullUser, project: proj }
        : baseInquiry)),
      update: vi.fn(async () => { writes.push('inquiry'); return { ...baseInquiry, status: 'APPROVED', approvedAt: new Date() }; }),
    },
    company: { upsert: vi.fn(async () => { writes.push('company'); return co; }) },
    user: { upsert: vi.fn(async () => { writes.push('user'); return fullUser; }) },
    project: { upsert: vi.fn(async () => { writes.push('project'); return proj; }) },
    auditLog: { create: vi.fn(async () => { if (opts.failAuditWrite) throw new Error('boom'); writes.push('audit'); return {}; }) },
    emailOutbox: { createMany: vi.fn(async () => { writes.push('invite'); return { count: 1 }; }) },
    adminNotification: { createMany: vi.fn(async () => { writes.push('notification'); return { count: 1 }; }) },
  };
  return { tx, writes };
}

/** Applies writes to a scratch list and discards them if the callback throws, like a real transaction. */
function useTx(t: ReturnType<typeof makeTx>, committed: string[]) {
  state.transaction = async (fn: any) => {
    t.writes.length = 0;
    const out = await fn(t.tx);
    committed.push(...t.writes);
    return out;
  };
}

beforeEach(() => {
  setSecrets();
  vi.clearAllMocks();
  state.users.clear();
  state.users.set(ADMIN_ID, { id: ADMIN_ID, name: 'A', email: 'a@x.com', admin: true, role: 'ADMIN', status: 'ACTIVE', sessionVersion: 0, inquiryId: null });
  state.users.set(CLIENT_ID, { id: CLIENT_ID, name: 'C', email: 'c@x.com', admin: false, role: 'CLIENT', status: 'ACTIVE', sessionVersion: 0, inquiryId: null });
});

describe('POST /api/inquiries/[id]/approve — authorization', () => {
  it('anonymous: 401 and the database is never touched', async () => {
    const res = await POST(req(`/api/inquiries/${INQUIRY_ID}/approve`), ctx());
    expect(res.status).toBe(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('ordinary customer: 403, no writes', async () => {
    const res = await POST(req('/x', { cookie: cookieFor({ userId: CLIENT_ID, admin: false }) }), ctx());
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('demoted admin with an old cookie: no writes', async () => {
    state.users.set(ADMIN_ID, { ...state.users.get(ADMIN_ID), admin: false });
    const res = await POST(req('/x', { cookie: admin() }), ctx());
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('suspended admin with an old cookie: no writes', async () => {
    state.users.set(ADMIN_ID, { ...state.users.get(ADMIN_ID), status: 'SUSPENDED' });
    const res = await POST(req('/x', { cookie: admin() }), ctx());
    expect(res.status).toBe(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('malformed id from an admin: 404 without a query', async () => {
    const res = await POST(req('/x', { cookie: admin() }), ctx('not-a-uuid'));
    expect(res.status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('POST /api/inquiries/[id]/approve — behaviour and response shape', () => {
  it('first approval creates records, audits, and returns only allowlisted fields', async () => {
    const committed: string[] = [];
    useTx(makeTx(), committed);
    const res = await POST(req('/x', { cookie: admin() }), ctx());
    expect(res.status).toBe(200);
    expect(committed).toEqual(['inquiry', 'company', 'user', 'project', 'audit', 'invite', 'notification']);
    const body = await res.json();
    const keys = allKeys(body);
    for (const f of SECRET_FIELDS) expect(keys.has(f)).toBe(false);
    expect(body.user).toEqual({ id: 'u1', name: 'Ada', email: 'ada@example.com', role: 'CLIENT', status: 'INVITED', companyId: 'c1' });
    expect(body.project.id).toBe('p1');
    expect(body.company.id).toBe('c1');
  });
  it('repeat approval is idempotent: no writes, equally filtered', async () => {
    const committed: string[] = [];
    useTx(makeTx({ existing: true }), committed);
    const res = await POST(req('/x', { cookie: admin() }), ctx());
    expect(res.status).toBe(200);
    expect(committed).toEqual([]);
    const keys = allKeys(await res.json());
    for (const f of SECRET_FIELDS) expect(keys.has(f)).toBe(false);
  });
  it('takes a row lock first so concurrent approvals serialise', async () => {
    const t = makeTx();
    useTx(t, []);
    await POST(req('/x', { cookie: admin() }), ctx());
    expect(t.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(t.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(t.tx.inquiry.findUnique.mock.invocationCallOrder[0]);
  });
  it('a failure mid-transaction commits nothing and returns 500', async () => {
    const committed: string[] = [];
    useTx(makeTx({ failAuditWrite: true }), committed);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(req('/x', { cookie: admin() }), ctx());
    expect(res.status).toBe(500);
    expect(committed).toEqual([]);
  });
  it('existing user with the same email → 409', async () => {
    state.transaction = async () => { throw Object.assign(new Error('unique'), { code: 'P2002' }); };
    const res = await POST(req('/x', { cookie: admin() }), ctx());
    expect(res.status).toBe(409);
  });
});
