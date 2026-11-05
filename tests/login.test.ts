import { beforeEach, describe, expect, it, vi } from 'vitest';
import { req, setSecrets } from './helpers';

const db = vi.hoisted(() => ({ user: null as any }));
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn(async () => db.user), update: vi.fn(async () => ({})) } },
}));
vi.mock('@/lib/auth', () => ({ verifyPassword: vi.fn(async (p: string) => p === 'right-password') }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { POST } from '@/app/api/auth/login/route';
import { prisma } from '@/lib/prisma';

const login = (password = 'right-password') => POST(req('/x', { body: { email: 'a@x.com', password } }));
const u = (status: string) => ({ id: 'u1', name: 'A', email: 'a@x.com', admin: false, status, passwordHash: 'h', sessionVersion: 4 });

beforeEach(() => { setSecrets(); vi.clearAllMocks(); });

describe('login honours account status', () => {
  it('ACTIVE signs in and the cookie carries the current session version', async () => {
    db.user = u('ACTIVE');
    const res = await login();
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie')!;
    const payload = JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0], 'base64url').toString());
    expect(payload.sv).toBe(4);
  });
  it.each(['SUSPENDED', 'INVITED', 'DISABLED', 'CLOSED', 'weird'])('%s cannot sign in and gets no cookie', async (status) => {
    db.user = u(status);
    const res = await login();
    expect(res.status).toBe(403);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it('wrong password on a suspended account is indistinguishable from any other wrong password', async () => {
    db.user = u('SUSPENDED');
    const res = await login('nope');
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Invalid email or password.');
  });
  it('a weak SESSION_SECRET refuses to issue sessions', async () => {
    process.env.SESSION_SECRET = 'change-me-in-production';
    db.user = u('ACTIVE');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await login();
    expect(res.status).toBe(500);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});
