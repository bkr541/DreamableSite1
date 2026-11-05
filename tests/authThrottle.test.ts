import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePg } from './pg';
import { setSecrets } from './helpers';

const h = vi.hoisted(() => ({ users: [] as any[], mails: [] as any[], updates: 0 }));

vi.mock('@/lib/prisma', () => {
  const find = (where: any) => h.users.find((u) => (where.email ? u.email === where.email : u.id === where.id)) ?? null;
  const prisma: any = {
    user: {
      findUnique: async ({ where }: any) => find(where),
      update: async ({ where, data }: any) => { Object.assign(find(where), data); h.updates++; return find(where); },
      updateMany: async ({ where, data }: any) => {
        const u = h.users.find((x) => x.id === where.id && (where.templogincode === undefined || x.templogincode === where.templogincode));
        if (!u) return { count: 0 };
        for (const [k, v] of Object.entries<any>(data)) u[k] = v && typeof v === 'object' && 'increment' in v ? u[k] + v.increment : v;
        return { count: 1 };
      },
    },
    passwordResetToken: { updateMany: async () => ({ count: 0 }), create: async () => ({}) },
    $transaction: async (a: any) => (typeof a === 'function' ? a(prisma) : Promise.all(a)),
  };
  return { prisma };
});
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: async (m: unknown) => { h.mails.push(m); } }) } }));
vi.mock('@/lib/auth', () => ({
  verifyPassword: vi.fn(async (p: string, hash: string) => hash === 'real-hash' && p === 'right-password'),
  hashPassword: vi.fn(async (p: string) => `hash:${p}`),
}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

let pg: Awaited<ReturnType<typeof makePg>>;
async function process_() {
  vi.resetModules();
  (await import('@/lib/rateLimit')).setRateLimitStore(pg.instance());
  return {
    login: (await import('@/app/api/auth/login/route')).POST,
    requestCode: (await import('@/app/api/auth/request-code/route')).POST,
    forgot: (await import('@/app/api/auth/forgot-password/route')).POST,
    verifyCode: (await import('@/app/api/auth/verify-code/route')).POST,
    update: (await import('@/app/api/auth/update-password/route')).POST,
  };
}
type P = Awaited<ReturnType<typeof process_>>;

const call = (fn: (r: never) => Promise<Response>, body: unknown, ip = '203.0.113.5') =>
  fn(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': ip }, body: JSON.stringify(body) }) as never);

beforeEach(async () => {
  setSecrets();
  process.env.VERCEL = '1';              // platform headers (x-real-ip) are trusted, as on Vercel
  Object.assign(process.env, { SMTP_HOST: 'smtp.test', SMTP_USER: 'u', SMTP_PASS: 'p' });
  pg = await makePg();
  h.mails.length = 0; h.updates = 0;
  h.users = [{ id: 'u1', name: 'Ann', email: 'ann@example.com', passwordHash: 'real-hash', status: 'ACTIVE', admin: false, sessionVersion: 0, templogincode: null, tempLoginCodeExpiresAt: null, lastLoginAt: null }];
});

const emailedCode = () => /letter-spacing:8px[^>]*>\s*([A-Z0-9]{8})\s*</.exec(h.mails.at(-1).html)![1];

describe('login throttling', () => {
  it('throttles repeated wrong passwords — identically for real and non-existent accounts', async () => {
    const p = await process_();
    const statuses = { real: [] as number[], ghost: [] as number[] };
    for (let i = 0; i < 7; i++) {
      statuses.real.push((await call(p.login, { email: 'ann@example.com', password: `wrong${i}` })).status);
      statuses.ghost.push((await call(p.login, { email: 'ghost@example.com', password: `wrong${i}` })).status);
    }
    expect(statuses.real).toEqual(statuses.ghost);        // no account-existence oracle
    expect(statuses.real.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses.real[5]).toBe(429);
  });

  it('while blocked even the right password is refused, then works again after the cooldown', async () => {
    const p = await process_();
    for (let i = 0; i < 5; i++) await call(p.login, { email: 'ann@example.com', password: 'nope' });
    const blocked = await call(p.login, { email: 'ann@example.com', password: 'right-password' });
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error).toMatch(/Please wait .* and try again/);
    expect(blocked.headers.get('set-cookie')).toBeNull();
    await pg.age(body.retryAfterSeconds + 5);
    const ok = await call(p.login, { email: 'ann@example.com', password: 'right-password' });
    expect(ok.status).toBe(200);
  });

  it('limits hold across separate processes', async () => {
    const a = await process_();
    for (let i = 0; i < 5; i++) await call(a.login, { email: 'ann@example.com', password: 'nope' });
    const b = await process_();
    expect((await call(b.login, { email: 'ann@example.com', password: 'right-password' })).status).toBe(429);
  });

  it('guessing from many addresses is still capped per account, and the cap expires (no permanent lockout)', async () => {
    const p = await process_();
    for (let i = 0; i < 10; i++) await call(p.login, { email: 'ann@example.com', password: 'nope' }, `198.51.100.${i + 1}`);
    const fresh = await call(p.login, { email: 'ann@example.com', password: 'right-password' }, '192.0.2.200');
    expect(fresh.status).toBe(429);
    await pg.age((await fresh.json()).retryAfterSeconds + 5);
    expect((await call(p.login, { email: 'ann@example.com', password: 'right-password' }, '192.0.2.200')).status).toBe(200);
  });

  it('a source trying many different accounts is capped by the per-IP budget', async () => {
    const p = await process_();
    let last = 0;
    for (let i = 0; i < 32; i++) last = (await call(p.login, { email: `user${i}@example.com`, password: 'x' })).status;
    expect(last).toBe(429);
  });

  it('a successful sign-in clears that person’s failure count', async () => {
    const p = await process_();
    for (let i = 0; i < 4; i++) await call(p.login, { email: 'ann@example.com', password: 'nope' });
    expect((await call(p.login, { email: 'ann@example.com', password: 'right-password' })).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await call(p.login, { email: 'ann@example.com', password: 'nope' })).status).toBe(401);
  });
});

describe('recovery emails cannot be used to flood a mailbox', () => {
  it('stops after a few requests for the same address — same answer whether or not it exists', async () => {
    const p = await process_();
    const real: number[] = [], ghost: number[] = [];
    for (let i = 0; i < 5; i++) {
      real.push((await call(p.requestCode, { email: 'ann@example.com' }, `198.51.100.${i + 1}`)).status);
      ghost.push((await call(p.requestCode, { email: 'ghost@example.com' }, `198.51.100.${i + 1}`)).status);
    }
    expect(real).toEqual(ghost);
    expect(real).toEqual([200, 200, 200, 429, 429]);
    expect(h.mails.length).toBe(3);
  });
  it('the emailed-link and emailed-code routes share one budget', async () => {
    const p = await process_();
    await call(p.requestCode, { email: 'ann@example.com' });
    await call(p.forgot, { email: 'ann@example.com' });
    await call(p.requestCode, { email: 'ann@example.com' });
    expect((await call(p.forgot, { email: 'ann@example.com' })).status).toBe(429);
    expect((await call(p.requestCode, { email: 'ann@example.com' })).status).toBe(429);
  });
  it('works again after the cooldown', async () => {
    const p = await process_();
    for (let i = 0; i < 3; i++) await call(p.requestCode, { email: 'ann@example.com' });
    const blocked = await call(p.requestCode, { email: 'ann@example.com' });
    await pg.age((await blocked.json()).retryAfterSeconds + 5);
    expect((await call(p.requestCode, { email: 'ann@example.com' })).status).toBe(200);
  });
});

describe('code guessing', () => {
  async function withCode(p: P) {
    await call(p.requestCode, { email: 'ann@example.com' });
    return emailedCode();
  }

  it('stores only a hash of the emailed code', async () => {
    const p = await process_();
    const code = await withCode(p);
    expect(h.users[0].templogincode).toMatch(/^[0-9a-f]{64}$/);
    expect(h.users[0].templogincode).not.toContain(code);
    expect((await call(p.verifyCode, { email: 'ann@example.com', code })).status).toBe(200);
    expect((await call(p.verifyCode, { email: 'ann@example.com', code: code.toLowerCase() })).status).toBe(200);
    expect((await call(p.verifyCode, { email: 'ann@example.com', code: 'AAAAAAAA' })).status).toBe(400);
  });

  it('repeated wrong codes are throttled, and then even the right code cannot reset the password', async () => {
    const p = await process_();
    const code = await withCode(p);
    for (let i = 0; i < 5; i++) expect((await call(p.verifyCode, { email: 'ann@example.com', code: `WRONG00${i}` })).status).toBe(400);
    expect((await call(p.verifyCode, { email: 'ann@example.com', code })).status).toBe(429);
    const reset = await call(p.update, { email: 'ann@example.com', code, password: 'brand-new-pass' });
    expect(reset.status).toBe(429);
    expect(h.users[0].passwordHash).toBe('real-hash');
  });

  it('update-password attempts count toward the same budget', async () => {
    const p = await process_();
    await withCode(p);
    for (let i = 0; i < 5; i++) await call(p.update, { email: 'ann@example.com', code: `WRONG00${i}`, password: 'brand-new-pass' });
    expect((await call(p.verifyCode, { email: 'ann@example.com', code: 'WRONG009' })).status).toBe(429);
  });

  it('the right code still works after the cooldown, and is single use', async () => {
    const p = await process_();
    const code = await withCode(p);
    for (let i = 0; i < 5; i++) await call(p.verifyCode, { email: 'ann@example.com', code: `WRONG00${i}` });
    const blocked = await call(p.verifyCode, { email: 'ann@example.com', code });
    await pg.age((await blocked.json()).retryAfterSeconds + 5);
    expect((await call(p.update, { email: 'ann@example.com', code, password: 'brand-new-pass' })).status).toBe(200);
    expect(h.users[0].passwordHash).toBe('hash:brand-new-pass');
    expect((await call(p.update, { email: 'ann@example.com', code, password: 'another-pass-1' })).status).toBe(400);
  });

  it('wrong-code limits hold across separate processes', async () => {
    const a = await process_();
    await withCode(a);
    for (let i = 0; i < 5; i++) await call(a.verifyCode, { email: 'ann@example.com', code: `WRONG00${i}` });
    const b = await process_();
    expect((await call(b.verifyCode, { email: 'ann@example.com', code: 'WRONG009' })).status).toBe(429);
  });
});
