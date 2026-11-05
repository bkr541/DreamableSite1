import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, cookieFor, setSecrets } from './helpers';
import { makeOnboardingDb } from './onboardingDb';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { PUT } from '@/app/api/admin/profile/route';

const CO = '88888888-8888-4888-8888-888888888888';
const me = () => h.db.user.rows.find((u: any) => u.id === ADMIN_ID);
const put = (body: unknown, cookie: string | null = cookieFor({ userId: ADMIN_ID, admin: true })) =>
  PUT(new NextRequest('http://localhost/x', { method: 'PUT', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }) as never);
const sessionOf = (res: Response) => {
  const raw = /ds_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
  return raw ? JSON.parse(Buffer.from(raw.split('.')[0], 'base64url').toString()) : null;
};
const valid = { name: 'Alex Admin', email: 'alex@studio.example', companyName: 'Studio Co', companyWebsite: 'https://studio.example' };

beforeEach(() => {
  setSecrets();
  h.db = makeOnboardingDb();
  h.db.company.rows.push({ id: CO, name: 'Old Studio', website: null });
  me().companyId = CO;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('a valid update', () => {
  it('changes exactly the signed-in admin and their company', async () => {
    const otherBefore = JSON.stringify(h.db.user.rows.find((u: any) => u.id === CLIENT_ID));
    const res = await put(valid);
    expect(res.status).toBe(200);
    expect(me()).toMatchObject({ name: 'Alex Admin', email: 'alex@studio.example', companyId: CO, admin: true, role: 'ADMIN', status: 'ACTIVE' });
    expect(h.db.company.rows).toEqual([expect.objectContaining({ id: CO, name: 'Studio Co', website: 'https://studio.example' })]);
    expect(JSON.stringify(h.db.user.rows.find((u: any) => u.id === CLIENT_ID))).toBe(otherBefore);
  });

  it('re-issues the session only after the commit, from the database’s role — name changes keep other sessions', async () => {
    const res = await put({ ...valid, email: 'admin@x.co' });                 // same email: only name/company change
    expect(sessionOf(res)).toMatchObject({ name: 'Alex Admin', email: 'admin@x.co', admin: true, sv: 0 });
    expect(me().sessionVersion).toBe(0);
  });

  it('a new email address ends the other sessions and issues a cookie for the new version', async () => {
    const res = await put(valid);
    expect(me().sessionVersion).toBe(1);
    expect(sessionOf(res)).toMatchObject({ email: 'alex@studio.example', sv: 1 });
  });

  it('keeps the remember-me lifetime', async () => {
    const res = await put({ ...valid, email: 'admin@x.co' }, cookieFor({ userId: ADMIN_ID, admin: true })); // 1-day session → not remembered
    expect(res.headers.get('set-cookie')).not.toMatch(/Max-Age/i);
  });

  it('creates a company for an admin who has none', async () => {
    me().companyId = null;
    await put(valid);
    expect(h.db.company.rows).toHaveLength(2);
    expect(me().companyId).toBe(h.db.company.rows[1].id);
  });

  it('ignores privilege fields in the request', async () => {
    await put({ ...valid, admin: false, role: 'CLIENT', status: 'SUSPENDED', sessionVersion: 99, id: CLIENT_ID });
    expect(me()).toMatchObject({ admin: true, role: 'ADMIN', status: 'ACTIVE', sessionVersion: 1, id: ADMIN_ID });
  });
});

describe('failures change nothing', () => {
  it('a duplicate email is rejected before any write, with no new cookie', async () => {
    const before = JSON.stringify([h.db.user.rows, h.db.company.rows]);
    const res = await put({ ...valid, email: 'OTHER@x.co' });
    expect(res.status).toBe(409);
    expect(JSON.stringify([h.db.user.rows, h.db.company.rows])).toBe(before);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('if the database rejects the email AFTER the company was updated, the company update is undone too', async () => {
    // The race: the pre-check passes, then the unique constraint fires on the user update.
    h.db.user.update = async () => { throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }); };
    const res = await put({ ...valid, email: 'taken-meanwhile@x.co' });
    expect(res.status).toBe(409);
    expect(h.db.company.rows[0]).toMatchObject({ name: 'Old Studio', website: null });
    expect(me()).toMatchObject({ name: 'Admin', email: 'admin@x.co' });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('any other failure mid-way rolls everything back and sets no cookie', async () => {
    h.db.user.update = async () => { throw new Error('connection reset'); };
    const res = await put(valid);
    expect(res.status).toBe(500);
    expect(h.db.company.rows[0].name).toBe('Old Studio');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it.each([[{ ...valid, name: '' }], [{ ...valid, email: 'nope' }], [{ ...valid, email: 'a@b.co\r\nBcc: x@y.co' }]])('rejects invalid input %#', async (body) => {
    const before = JSON.stringify([h.db.user.rows, h.db.company.rows]);
    expect((await put(body)).status).toBe(400);
    expect(JSON.stringify([h.db.user.rows, h.db.company.rows])).toBe(before);
  });
});

describe('shared organisations', () => {
  it('editing from a company other people belong to never alters it — the admin gets their own', async () => {
    h.db.user.rows.find((u: any) => u.id === CLIENT_ID).companyId = CO;     // a customer also belongs to "Old Studio"
    await put(valid);
    const shared = h.db.company.rows.find((c: any) => c.id === CO);
    expect(shared).toMatchObject({ name: 'Old Studio', website: null });    // untouched
    expect(me().companyId).not.toBe(CO);
    expect(h.db.company.rows.find((c: any) => c.id === me().companyId)).toMatchObject({ name: 'Studio Co' });
    expect(h.db.user.rows.find((u: any) => u.id === CLIENT_ID).companyId).toBe(CO);
  });
});

describe('authorization', () => {
  it('anonymous 401, customer 403, nothing changes', async () => {
    const before = JSON.stringify([h.db.user.rows, h.db.company.rows]);
    expect((await put(valid, null)).status).toBe(401);
    expect((await put(valid, cookieFor({ userId: CLIENT_ID, admin: false }))).status).toBe(403);
    expect(JSON.stringify([h.db.user.rows, h.db.company.rows])).toBe(before);
  });
});
