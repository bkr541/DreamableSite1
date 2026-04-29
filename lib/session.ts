import { createHmac } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'ds_session';
const SESSION_MS  =  1 * 24 * 60 * 60 * 1000; // 1 day  (no remember-me)
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (remember-me)

export interface SessionPayload {
  userId: string;
  email: string;
  admin: boolean;
  exp: number;
}

function secret() {
  return process.env.SESSION_SECRET ?? 'change-me-in-production';
}

function sign(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verify(token: string): SessionPayload | null {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', secret()).update(data).digest('base64url');
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>, rememberMe = false): string {
  return sign({ ...payload, exp: Date.now() + (rememberMe ? REMEMBER_MS : SESSION_MS) });
}

export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verify(token);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verify(token);
}

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
