import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, cookieFor, setSecrets } from './helpers';
import { makeOnboardingDb } from './onboardingDb';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/dispatch', () => ({ dispatchOutbox: vi.fn() }));

import { POST } from '@/app/api/admin/clients/route';

const post = (body: unknown, cookie: string | null = cookieFor({ userId: ADMIN_ID, admin: true })) =>
  POST(new NextRequest('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }) as never);
const CO = '88888888-8888-4888-8888-888888888888';
const valid = { name: 'Grace Hopper', email: 'Grace@Navy.example' };
const users = () => h.db.user.rows.filter((u: any) => ![ADMIN_ID, CLIENT_ID].includes(u.id));

beforeEach(() => { setSecrets(); h.db = makeOnboardingDb(); vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('creating a client', () => {
  it('creates a company, an invited client with NO password, and queues the invitation — together', async () => {
    const res = await post({ ...valid, companyName: 'Navy Labs', companyWebsite: 'https://navy.example' });
    expect(res.status).toBe(200);
    const [u] = users();
    expect(u).toMatchObject({ name: 'Grace Hopper', email: 'grace@navy.example', role: 'CLIENT', status: 'INVITED', admin: false });
    expect(u.passwordHash).toBeNull();
    expect(h.db.company.rows).toEqual([expect.objectContaining({ name: 'Navy Labs', website: 'https://navy.example', id: u.companyId })]);
    expect(h.db.emailOutbox.rows).toEqual([expect.objectContaining({ eventType: 'client.invitation', recipient: 'grace@navy.example', payload: { userId: u.id } })]);
  });

  it('works without a company', async () => {
    expect((await post(valid)).status).toBe(200);
    expect(h.db.company.rows).toHaveLength(0);
    expect(users()[0].companyId).toBeNull();
  });

  it('a duplicate email leaves no orphan company and changes nothing', async () => {
    await post(valid);
    const before = JSON.stringify([h.db.user.rows, h.db.company.rows, h.db.emailOutbox.rows]);
    const res = await post({ ...valid, email: 'GRACE@navy.example', companyName: 'Second Company' });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('EMAIL_EXISTS');
    expect(JSON.stringify([h.db.user.rows, h.db.company.rows, h.db.emailOutbox.rows])).toBe(before);
  });

  it('even if the email is taken in the instant between the check and the insert, everything rolls back', async () => {
    // Simulate the race: the pre-check sees nothing, then the database rejects the insert as a duplicate.
    h.db.user.create = async () => { throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }); };
    const res = await post({ ...valid, companyName: 'Orphan Candidate' });
    expect(res.status).toBe(409);
    expect(h.db.company.rows).toHaveLength(0);          // the company created a moment earlier is gone
    expect(h.db.emailOutbox.rows).toHaveLength(0);
  });

  it('any failure mid-way (e.g. the invitation can’t be queued) leaves the database unchanged', async () => {
    h.db.emailOutbox.createMany = async () => { throw new Error('boom'); };
    const res = await post({ ...valid, companyName: 'Half Done Ltd' });
    expect(res.status).toBe(500);
    expect(users()).toHaveLength(0);
    expect(h.db.company.rows).toHaveLength(0);
  });
});

describe('untrusted inputs cannot escalate privileges', () => {
  it.each([
    [{ role: 'ADMIN' }], [{ role: 'admin' }], [{ role: 'MANAGER' }], [{ role: 'CLIENT ' }],
    [{ status: 'ACTIVE' }], [{ status: 'SUSPENDED' }], [{ status: 'ADMIN' }],
  ])('%j is refused and nothing is written', async (extra) => {
    const res = await post({ ...valid, ...extra });
    expect(res.status).toBe(400);
    expect(users()).toHaveLength(0);
    expect(h.db.company.rows).toHaveLength(0);
  });
  it('an `admin: true` field is simply never used', async () => {
    await post({ ...valid, admin: true, passwordHash: 'x', sessionVersion: 9, id: 'chosen-id' });
    expect(users()[0]).toMatchObject({ admin: false, role: 'CLIENT', sessionVersion: 0 });
    expect(users()[0].passwordHash).toBeNull();
    expect(users()[0].id).not.toBe('chosen-id');
  });
  it('explicitly sending the safe values is accepted', async () => {
    expect((await post({ ...valid, role: 'CLIENT', status: 'INVITED' })).status).toBe(200);
  });
});

describe('validation', () => {
  it.each([
    [{ name: '', email: 'a@b.co' }], [{ name: 'A', email: '' }], [{ name: 'A', email: 'not-an-email' }],
    [{ name: 'A', email: 'a@b.co\r\nBcc: x@y.co' }], [{ name: 5, email: 'a@b.co' }],
  ])('rejects %j', async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(users()).toHaveLength(0);
  });
  it('strips control characters from names', async () => {
    await post({ name: 'Grace\r\nBcc: x', email: 'g@n.example' });
    expect(users()[0].name).not.toMatch(/[\r\n]/);
  });
});

describe('companies are chosen explicitly, never merged by name', () => {
  it('links the client to a company picked from the list, without creating another', async () => {
    h.db.company.rows.push({ id: CO, name: 'Navy Labs' });
    await post({ ...valid, companyId: CO });
    expect(h.db.company.rows).toHaveLength(1);
    expect(users()[0].companyId).toBe(CO);
  });
  it('typing a name that already exists asks for confirmation instead of merging or silently duplicating', async () => {
    h.db.company.rows.push({ id: CO, name: 'Navy Labs' });
    const res = await post({ ...valid, companyName: 'Navy Labs' });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body).toMatchObject({ code: 'COMPANY_EXISTS', company: { id: CO } });
    expect(users()).toHaveLength(0);
    expect(h.db.company.rows).toHaveLength(1);
    // The admin confirms it really is a different company:
    expect((await post({ ...valid, companyName: 'Navy Labs', confirmNewCompany: true })).status).toBe(200);
    expect(h.db.company.rows).toHaveLength(2);
    expect(users()[0].companyId).not.toBe(CO);
  });
  it('an unknown or malformed company id is refused', async () => {
    expect((await post({ ...valid, companyId: 'nope' })).status).toBe(400);
    expect((await post({ ...valid, companyId: '99999999-9999-4999-8999-999999999999' })).status).toBe(404);
    expect(users()).toHaveLength(0);
  });
});

describe('authorization', () => {
  it('anonymous 401, customer 403, nothing written', async () => {
    expect((await post(valid, null)).status).toBe(401);
    expect((await post(valid, cookieFor({ userId: CLIENT_ID, admin: false }))).status).toBe(403);
    expect(users()).toHaveLength(0);
  });
});
