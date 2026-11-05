import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionSecret } from './secrets';

export const COOKIE_NAME = 'ds_session';
const SESSION_MS  =  1 * 24 * 60 * 60 * 1000; // 1 day  (no remember-me)
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (remember-me)

/**
 * What the signed cookie *claims*. These are hints captured at sign-in and are NOT authorization:
 * `admin` may be stale and `sv` must match the database. Use `requireUser` / `requireAdmin` from
 * lib/authz.ts for every access decision.
 */
export interface SessionPayload {
  userId: string;
  name: string;
  email: string;
  admin: boolean;
  /** users.session_version at sign-in; bumped to revoke every outstanding cookie for that user. */
  sv: number;
  exp: number;
}

function sign(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verify(token: string): SessionPayload | null {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(createHmac('sha256', getSessionSecret()).update(data).digest('base64url'));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    // Cookies from before session versioning have no `sv` and are rejected on purpose (forces a fresh sign-in).
    if (
      typeof p.userId !== 'string' || typeof p.email !== 'string' || typeof p.name !== 'string' ||
      typeof p.admin !== 'boolean' || !Number.isInteger(p.sv) || typeof p.exp !== 'number'
    ) return null;
    if (Date.now() > p.exp) return null;
    return p as SessionPayload;
  } catch {
    return null;
  }
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>, rememberMe = false): string {
  return sign({ ...payload, exp: Date.now() + (rememberMe ? REMEMBER_MS : SESSION_MS) });
}

/** Signature + expiry only. Not an authorization check — see SessionPayload. */
export function getSessionClaimsFromRequest(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verify(token);
}

/** Signature + expiry only. Not an authorization check — see SessionPayload. */
export async function getSessionClaims(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verify(token);
}

export const hasSessionCookie = (req: NextRequest) => !!req.cookies.get(COOKIE_NAME)?.value;

export function setSessionCookie(res: NextResponse, token: string, rememberMe = false) {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // No maxAge when rememberMe is false → session cookie (cleared when browser closes)
    ...(rememberMe ? { maxAge: 60 * 60 * 24 * 30 } : {}),
    path: '/',
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}
