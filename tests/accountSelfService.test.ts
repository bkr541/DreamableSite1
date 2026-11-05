import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, cookieFor, setSecrets } from './helpers';
import { makeOnboardingDb } from './onboardingDb';
import { makePg } from './pg';
import { hashPassword } from '@/lib/auth';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { setRateLimitStore } from '@/lib/rateLimit';
import { requireUser } from '@/lib/authz';
import { PATCH as patchProfile } from '@/app/api/account/profile/route';
import { POST as changePassword } from '@/app/api/account/password/route';

const CURRENT = 'my current passphrase';
const NEW = 'a brand new passphrase';
let pg: Awaited<ReturnType<typeof makePg>>;

const me = () => h.db.user.rows.find((u: any) => u.id === CLIENT_ID);
const other = () => h.db.user.rows.find((u: any) => u.id === ADMIN_ID);
const cookieOf = (res: Response) => /ds_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
const as = (cookie?: string) => cookie ?? cookieFor({ userId: CLIENT_ID, admin: false, sv: me().sessionVersion });
const patch = (body: unknown, cookie?: string | null) =>
  patchProfile(new NextRequest('http://localhost/x', { method: 'PATCH', headers: { 'content-type': 'application/json', ...(cookie === null ? {} : { cookie: as(cookie) }) }, body: JSON.stringify(body) }) as never);
const pw = (body: unknown, cookie?: string | null) =>
  changePassword(new NextRequest('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie === null ? {} : { cookie: as(cookie) }) }, body: JSON.stringify(body) }) as never);

beforeEach(async () => {
  setSecrets();
  pg = await makePg();
  setRateLimitStore(pg.instance());
  h.db = makeOnboardingDb();
  me().passwordHash = await hashPassword(CURRENT);
  me().email = 'client@example.com';
  me().name = 'Casey Client';
});

describe('profile', () => {
  it('lets a customer change their own name — and only theirs', async () => {
    const before = JSON.stringify(other());
    const res = await patch({ name: '  Casey   Customer ' });
    expect(res.status).toBe(200);
    expect(me().name).toBe('Casey Customer');
    expect(JSON.stringify(other())).toBe(before);
  });

  it('refreshes the session cookie so the header shows the new name, without ending the session', async () => {
    const res = await patch({ name: 'New Name' });
    const cookie = cookieOf(res)!;
    const payload = JSON.parse(Buffer.from(cookie.split('.')[0], 'base64url').toString());
    expect(payload).toMatchObject({ name: 'New Name', userId: CLIENT_ID, admin: false, sv: 0 });
    expect(me().sessionVersion).toBe(0);
  });

  it.each(['email', 'role', 'admin', 'status', 'companyId', 'id', 'userId', 'sessionVersion', 'passwordHash', 'inquiryId'])(
    'refuses to change %s and writes nothing', async (field) => {
      const before = JSON.stringify(me());
      const res = await patch({ name: 'Fine Name', [field]: field === 'admin' ? true : 'x' });
      expect(res.status).toBe(403);
      expect(JSON.stringify(me())).toBe(before);
    });

  it('the account edited is always the signed-in one: a customer cannot target someone else', async () => {
    const res = await patch({ name: 'Hijack', userId: ADMIN_ID });
    expect(res.status).toBe(403);
    expect(other().name).toBe('Admin');
  });

  it('a forged admin flag in the cookie gives no extra power (the database decides)', async () => {
    const forged = cookieFor({ userId: CLIENT_ID, admin: true, sv: 0 });
    const res = await patch({ name: 'Still Client' }, forged);
    expect(res.status).toBe(200);
    expect(me()).toMatchObject({ name: 'Still Client', admin: false, role: 'CLIENT' });
  });

  it('validates the name and requires sign-in', async () => {
    expect((await patch({ name: '   ' })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ name: 'x' }, null)).status).toBe(401);
    expect((await patch([] as never)).status).toBe(400);
    expect(me().name).toBe('Casey Client');
  });
});

describe('changing the password', () => {
  it('needs the current password; a wrong one changes nothing', async () => {
    const before = me().passwordHash;
    const res = await pw({ currentPassword: 'not my password', newPassword: NEW });
    expect(res.status).toBe(400);
    expect(me().passwordHash).toBe(before);
    expect(me().sessionVersion).toBe(0);
  });

  it('applies the shared strength rules to the new password', async () => {
    for (const bad of ['short', 'password123', 'client@example.com', CURRENT]) {
      expect((await pw({ currentPassword: CURRENT, newPassword: bad })).status).toBe(400);
    }
    expect(me().sessionVersion).toBe(0);
  });

  it('on success: new password works, every OTHER session is revoked, and this one carries on', async () => {
    const oldCookie = cookieFor({ userId: CLIENT_ID, admin: false, sv: 0 });
    const res = await pw({ currentPassword: CURRENT, newPassword: NEW }, oldCookie);
    expect(res.status).toBe(200);
    const { verifyPassword } = await import('@/lib/auth');
    expect(await verifyPassword(NEW, me().passwordHash)).toBe(true);
    expect(await verifyPassword(CURRENT, me().passwordHash)).toBe(false);
    expect(me().sessionVersion).toBe(1);

    const probe = (cookie: string) => requireUser(new NextRequest('http://localhost/x', { headers: { cookie: `ds_session=${cookie}` } }));
    expect((await requireUser(new NextRequest('http://localhost/x', { headers: { cookie: oldCookie } }))).ok).toBe(false);   // a stolen/old cookie is dead
    expect((await probe(cookieOf(res)!)).ok).toBe(true);                                                                       // this device stays signed in
  });

  it('guessing the current password is throttled, then recovers — and the right password is not enough while blocked', async () => {
    for (let i = 0; i < 5; i++) expect((await pw({ currentPassword: `wrong guess ${i}`, newPassword: NEW })).status).toBe(400);
    const blocked = await pw({ currentPassword: CURRENT, newPassword: NEW });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect(me().sessionVersion).toBe(0);
    await pg.age((await blocked.json()).retryAfterSeconds + 5);
    expect((await pw({ currentPassword: CURRENT, newPassword: NEW })).status).toBe(200);
  });

  it('requires sign-in and a well-formed request', async () => {
    expect((await pw({ currentPassword: CURRENT, newPassword: NEW }, null)).status).toBe(401);
    expect((await pw({ currentPassword: CURRENT })).status).toBe(400);
    expect((await pw({ currentPassword: 1, newPassword: 2 })).status).toBe(400);
  });

  it('cannot be aimed at another account', async () => {
    const adminBefore = other().passwordHash;
    await pw({ currentPassword: CURRENT, newPassword: NEW, userId: ADMIN_ID, id: ADMIN_ID });
    expect(other().passwordHash).toBe(adminBefore);
  });
});
