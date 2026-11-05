import { NextRequest } from 'next/server';
import { createSessionToken } from '@/lib/session';

export const SESSION = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9';
export const RESET = '0f9e8d7c6b5a49382716f5e4d3c2b1a00f9e8d7c6b5a49382716f5e4d3c2b1a0';

export function setSecrets() {
  process.env.SESSION_SECRET = SESSION;
  process.env.RESET_SECRET = RESET;
}

export const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
export const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
export const INQUIRY_ID = '33333333-3333-4333-8333-333333333333';

export function cookieFor(claims: { userId: string; admin: boolean; sv?: number }) {
  const token = createSessionToken({ userId: claims.userId, name: 'T', email: 't@example.com', admin: claims.admin, sv: claims.sv ?? 0 });
  return `ds_session=${token}`;
}

export function req(url: string, init: { method?: string; cookie?: string; body?: unknown } = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method: init.method ?? 'POST',
    headers: { 'content-type': 'application/json', ...(init.cookie ? { cookie: init.cookie } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/** Every key at every depth, so a test can assert nothing sensitive is serialised anywhere. */
export function allKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out));
  else if (v && typeof v === 'object' && !(v instanceof Date)) {
    for (const [k, x] of Object.entries(v)) { out.add(k); allKeys(x, out); }
  }
  return out;
}
