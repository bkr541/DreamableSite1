import { NextRequest, NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';
import {
  SessionPayload, clearSessionCookie, getSessionClaims, getSessionClaimsFromRequest, hasSessionCookie,
} from './session';
import { ConfigError } from './secrets';
import { canSignIn } from './accountStatus';

// The single place that decides "who is this and what may they do".
// A valid cookie is only a claim: every check re-reads the user row, so a deleted, suspended, demoted
// or revoked account loses access on its very next request.
//
//   401  no session, or the session is no longer valid (expired, revoked, user gone/suspended)
//   403  valid session, but not allowed to do this (not an admin)

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  admin: boolean;
  role: string;
  inquiryId: string | null;
}

export type AuthResult =
  | { ok: true; user: AuthUser; claims: SessionPayload }
  | { ok: false; response: NextResponse };

const USER_SELECT = { id: true, name: true, email: true, admin: true, role: true, status: true, sessionVersion: true, inquiryId: true } as const;

async function resolve(claims: SessionPayload | null): Promise<{ user: AuthUser; claims: SessionPayload } | null> {
  if (!claims) return null;
  const row = await prisma.user.findUnique({ where: { id: claims.userId }, select: USER_SELECT });
  if (!row) return null;
  if (!canSignIn(row.status)) return null;
  if (row.sessionVersion !== claims.sv) return null;
  const { status: _status, sessionVersion: _sv, ...user } = row;
  return { user, claims };
}

const json = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

function deny(req: NextRequest, status: 401 | 403, error: string): AuthResult {
  const res = json(error, status);
  // Drop a cookie that is no longer good so the browser stops sending it.
  if (status === 401 && hasSessionCookie(req)) clearSessionCookie(res);
  return { ok: false, response: res };
}

/** API routes: any signed-in, currently ACTIVE user with an unrevoked session. */
export async function requireUser(req: NextRequest): Promise<AuthResult> {
  try {
    const found = await resolve(getSessionClaimsFromRequest(req));
    if (!found) return deny(req, 401, 'Unauthorized.');
    return { ok: true, ...found };
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[authz]', err.message);
      return { ok: false, response: json('Service temporarily unavailable.', 503) };
    }
    throw err;
  }
}

/** API routes: the caller must be a currently ACTIVE administrator (checked against the database). */
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const result = await requireUser(req);
  if (!result.ok) return result;
  if (!result.user.admin) return deny(req, 403, 'Forbidden.');
  return result;
}

/** Server components: the current user, or null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const found = await resolve(await getSessionClaims());
  return found?.user ?? null;
}

/** Server components: admin pages. Signed-out or revoked → /portal; signed-in non-admin → /dashboard. */
export async function requireAdminPage(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/portal');
  if (!user.admin) redirect('/dashboard');
  return user;
}

/** Server components: customer pages. Signed-out or revoked → /portal; admins → /admin. */
export async function requireClientPage(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/portal');
  if (user.admin) redirect('/admin');
  return user;
}
