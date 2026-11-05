import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, cookieFor, req, setSecrets } from './helpers';

const db = vi.hoisted(() => ({ users: new Map<string, Record<string, unknown>>() }));
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => db.users.get(where.id) ?? null) } },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { requireAdmin, requireUser } from '@/lib/authz';

const row = (over: Record<string, unknown>) => ({
  name: 'T', email: 't@example.com', role: 'CLIENT', admin: false, status: 'ACTIVE', sessionVersion: 0, inquiryId: null, ...over,
});

beforeEach(() => {
  setSecrets();
  db.users.clear();
  db.users.set(ADMIN_ID, row({ id: ADMIN_ID, admin: true, role: 'ADMIN' }));
  db.users.set(CLIENT_ID, row({ id: CLIENT_ID }));
});

const adminCookie = () => cookieFor({ userId: ADMIN_ID, admin: true });

describe('requireAdmin denial matrix', () => {
  it('anonymous → 401', async () => {
    const r = await requireAdmin(req('/x'));
    expect(!r.ok && r.response.status).toBe(401);
  });
  it('ordinary customer → 403', async () => {
    const r = await requireAdmin(req('/x', { cookie: cookieFor({ userId: CLIENT_ID, admin: false }) }));
    expect(!r.ok && r.response.status).toBe(403);
  });
  it('customer with a forged admin claim is still 403 (database wins)', async () => {
    const r = await requireAdmin(req('/x', { cookie: cookieFor({ userId: CLIENT_ID, admin: true }) }));
    expect(!r.ok && r.response.status).toBe(403);
  });
  it('disabled admin with a valid old cookie → 401', async () => {
    db.users.set(ADMIN_ID, row({ id: ADMIN_ID, admin: true, status: 'SUSPENDED' }));
    const r = await requireAdmin(req('/x', { cookie: adminCookie() }));
    expect(!r.ok && r.response.status).toBe(401);
  });
  it('demoted admin with a valid old cookie loses access', async () => {
    db.users.set(ADMIN_ID, row({ id: ADMIN_ID, admin: false }));
    const r = await requireAdmin(req('/x', { cookie: adminCookie() }));
    expect(r.ok).toBe(false);
  });
  it('revoked session (session_version bumped) → 401 and the cookie is cleared', async () => {
    db.users.set(ADMIN_ID, row({ id: ADMIN_ID, admin: true, sessionVersion: 1 }));
    const r = await requireAdmin(req('/x', { cookie: adminCookie() }));
    expect(!r.ok && r.response.status).toBe(401);
    expect(!r.ok && r.response.headers.get('set-cookie')).toMatch(/ds_session=;/);
  });
  it('deleted user → 401', async () => {
    db.users.delete(ADMIN_ID);
    const r = await requireAdmin(req('/x', { cookie: adminCookie() }));
    expect(!r.ok && r.response.status).toBe(401);
  });
  it('invited (setup unfinished) user → 401', async () => {
    db.users.set(CLIENT_ID, row({ id: CLIENT_ID, status: 'INVITED' }));
    const r = await requireUser(req('/x', { cookie: cookieFor({ userId: CLIENT_ID, admin: false }) }));
    expect(!r.ok && r.response.status).toBe(401);
  });
  it('expired cookie → 401', async () => {
    vi.useFakeTimers();
    const cookie = adminCookie();
    vi.setSystemTime(Date.now() + 2 * 24 * 3600 * 1000);
    const r = await requireAdmin(req('/x', { cookie }));
    vi.useRealTimers();
    expect(!r.ok && r.response.status).toBe(401);
  });
  it('tampered cookie → 401', async () => {
    const r = await requireAdmin(req('/x', { cookie: adminCookie().slice(0, -3) + 'xyz' }));
    expect(!r.ok && r.response.status).toBe(401);
  });
  it('cookie from before session versioning (no sv) → 401', async () => {
    const { createHmac } = await import('crypto');
    const data = Buffer.from(JSON.stringify({ userId: ADMIN_ID, name: 'T', email: 't@example.com', admin: true, exp: Date.now() + 1e6 })).toString('base64url');
    const sig = createHmac('sha256', process.env.SESSION_SECRET!).update(data).digest('base64url');
    const r = await requireAdmin(req('/x', { cookie: `ds_session=${data}.${sig}` }));
    expect(!r.ok && r.response.status).toBe(401);
  });
  it('cookie signed with a different (rotated-out) secret → 401', async () => {
    const cookie = adminCookie();
    process.env.SESSION_SECRET = 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
    const r = await requireAdmin(req('/x', { cookie }));
    expect(!r.ok && r.response.status).toBe(401);
  });
  it('missing/weak secret fails closed with 503, never accepts the cookie', async () => {
    const cookie = adminCookie();
    process.env.SESSION_SECRET = 'change-me-in-production';
    const r = await requireAdmin(req('/x', { cookie }));
    expect(!r.ok && r.response.status).toBe(503);
  });
  it('active administrator → allowed', async () => {
    const r = await requireAdmin(req('/x', { cookie: adminCookie() }));
    expect(r.ok && r.user.id).toBe(ADMIN_ID);
  });
});
