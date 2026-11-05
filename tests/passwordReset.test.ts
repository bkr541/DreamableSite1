import { beforeEach, describe, expect, it, vi } from 'vitest';
import { req, setSecrets, RESET } from './helpers';

type Tok = { id: string; userId: string; tokenHash: string; expiresAt: Date; consumedAt: Date | null };
type Usr = Record<string, any>;

const mem = vi.hoisted(() => ({ tokens: [] as any[], users: [] as any[], n: 0 }));

// A small stateful stand-in for the Prisma calls the reset flow uses. Conditional updateMany calls are
// evaluated and applied synchronously, which mirrors the single-statement atomicity of the real UPDATE.
vi.mock('@/lib/prisma', () => {
  const match = (row: any, where: any): boolean =>
    Object.entries(where).every(([k, v]: [string, any]) => {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('in' in v) return v.in.includes(row[k]);
        if ('gt' in v) return row[k] != null && row[k] > v.gt;
        return false;
      }
      return row[k] === v;
    });
  const apply = (row: any, data: any) => {
    for (const [k, v] of Object.entries<any>(data)) row[k] = v && typeof v === 'object' && 'increment' in v ? row[k] + v.increment : v;
  };
  const model = (rows: () => any[]) => ({
    updateMany: async ({ where, data }: any) => { const hit = rows().filter((r) => match(r, where)); hit.forEach((r) => apply(r, data)); return { count: hit.length }; },
    create: async ({ data }: any) => { const r = { id: `t${++mem.n}`, consumedAt: null, ...data }; rows().push(r); return r; },
    findUnique: async ({ where }: any) => {
      const r = rows().find((x) => match(x, where));
      if (!r) return null;
      return r.userId ? { ...r, user: mem.users.find((u) => u.id === r.userId) } : r;
    },
  });
  const prisma: any = { passwordResetToken: model(() => mem.tokens), user: model(() => mem.users) };
  prisma.$transaction = async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg));
  return { prisma };
});

vi.mock('@/lib/auth', () => ({ hashPassword: vi.fn(async (p: string) => `hash:${p}`) }));

import { issueResetToken } from '@/lib/resetTokens';
import { POST as setPassword } from '@/app/api/auth/set-password/route';
import { POST as verifyToken } from '@/app/api/auth/verify-reset-token/route';
import { POST as updateWithCode } from '@/app/api/auth/update-password/route';

const user = (over: Partial<Usr> = {}): Usr => ({ id: 'u1', email: 'a@x.com', status: 'ACTIVE', passwordHash: 'old', sessionVersion: 0, templogincode: null, tempLoginCodeExpiresAt: null, ...over });
const set = (token: string, password = 'new-password-1') => setPassword(req('/x', { body: { token, password } }));
const verify = async (token: string) => (await verifyToken(req('/x', { body: { token } }))).json();

beforeEach(() => {
  setSecrets();
  mem.tokens.length = 0; mem.users.length = 0; mem.n = 0;
  mem.users.push(user());
});

describe('reset links are single use', () => {
  it('works exactly once, then fails', async () => {
    const t = await issueResetToken('u1');
    expect((await set(t)).status).toBe(200);
    expect(mem.users[0].passwordHash).toBe('hash:new-password-1');
    expect((await set(t, 'another-pass-2')).status).toBe(400);
    expect(mem.users[0].passwordHash).toBe('hash:new-password-1');
  });
  it('only one of several simultaneous requests wins', async () => {
    const t = await issueResetToken('u1');
    const results = await Promise.all([set(t, 'pass-aaaaaa'), set(t, 'pass-bbbbbb'), set(t, 'pass-cccccc')]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400, 400]);
    expect(mem.users[0].sessionVersion).toBe(1);
  });
  it('a newer request invalidates the older link', async () => {
    const first = await issueResetToken('u1');
    const second = await issueResetToken('u1');
    expect((await verify(first)).valid).toBe(false);
    expect((await set(first)).status).toBe(400);
    expect((await set(second)).status).toBe(200);
  });
  it('verify does not consume the token', async () => {
    const t = await issueResetToken('u1');
    expect((await verify(t)).valid).toBe(true);
    expect((await verify(t)).valid).toBe(true);
    expect((await set(t)).status).toBe(200);
  });
  it('verify never returns the account email', async () => {
    const t = await issueResetToken('u1');
    expect(JSON.stringify(await verify(t))).not.toContain('a@x.com');
  });
  it('stores only a hash, never the raw token', async () => {
    const t = await issueResetToken('u1');
    expect(JSON.stringify(mem.tokens)).not.toContain(t);
  });
  it('expired links fail and report expired', async () => {
    const t = await issueResetToken('u1');
    mem.tokens[0].expiresAt = new Date(Date.now() - 1000);
    expect(await verify(t)).toEqual({ valid: false, expired: true });
    expect((await set(t)).status).toBe(400);
  });
  it.each(['garbage', 'a.b', '', 'x'.repeat(500)])('malformed token %j is rejected', async (t) => {
    expect((await set(t)).status).toBe(400);
    expect((await verify(t)).valid).toBe(false);
  });
  it('a token from before a RESET_SECRET rotation no longer works', async () => {
    const t = await issueResetToken('u1');
    process.env.RESET_SECRET = 'bbbb1111cccc2222dddd3333eeee4444ffff5555aaaa6666bbbb7777cccc8888';
    expect((await set(t)).status).toBe(400);
    process.env.RESET_SECRET = RESET;
  });
  it('success revokes existing sessions and clears codes', async () => {
    mem.users[0].templogincode = 'ABCD1234';
    const t = await issueResetToken('u1');
    await set(t);
    expect(mem.users[0].sessionVersion).toBe(1);
    expect(mem.users[0].templogincode).toBeNull();
  });
});

describe('account state is respected by both reset flows', () => {
  it('a suspended account is never reactivated by a link', async () => {
    const t = await issueResetToken('u1');
    mem.users[0].status = 'SUSPENDED';
    expect((await set(t)).status).toBe(400);
    expect(mem.users[0].status).toBe('SUSPENDED');
    expect(mem.users[0].passwordHash).toBe('old');
    expect(mem.tokens[0].consumedAt).toBeNull(); // rejected before the token is touched
  });
  it('an invited account is activated by completing its emailed setup link', async () => {
    mem.users[0].status = 'INVITED';
    const t = await issueResetToken('u1');
    expect((await set(t)).status).toBe(200);
    expect(mem.users[0].status).toBe('ACTIVE');
  });
  it('an active account stays active', async () => {
    const t = await issueResetToken('u1');
    await set(t);
    expect(mem.users[0].status).toBe('ACTIVE');
  });
  it('code flow: suspended account is not reactivated and the password is unchanged', async () => {
    mem.users[0] = user({ status: 'SUSPENDED', templogincode: 'ABCD1234', tempLoginCodeExpiresAt: new Date(Date.now() + 1e5) });
    const res = await updateWithCode(req('/x', { body: { email: 'a@x.com', code: 'abcd1234', password: 'new-password-1' } }));
    expect(res.status).toBe(400);
    expect(mem.users[0].status).toBe('SUSPENDED');
    expect(mem.users[0].passwordHash).toBe('old');
  });
  it('code flow: code works once, concurrent replays fail, sessions are revoked', async () => {
    mem.users[0] = user({ templogincode: 'ABCD1234', tempLoginCodeExpiresAt: new Date(Date.now() + 1e5) });
    const go = () => updateWithCode(req('/x', { body: { email: 'a@x.com', code: 'ABCD1234', password: 'new-password-1' } }));
    const statuses = (await Promise.all([go(), go()])).map((r) => r.status).sort();
    expect(statuses).toEqual([200, 400]);
    expect(mem.users[0].sessionVersion).toBe(1);
  });
});
