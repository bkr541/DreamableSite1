import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { headerText } from '@/lib/html';

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// Self-service profile for the signed-in customer. The account is always the session's user — there is no id in
// the request to tamper with — and the only thing a customer can change here is their display name. Anything else
// (email, role, admin, status, company, …) is refused outright rather than quietly ignored.
const ALLOWED = new Set(['name']);

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('We could not read that request.', 400);
  const extra = Object.keys(body).filter((k) => !ALLOWED.has(k));
  if (extra.length) return fail('Only your name can be changed here. To change your email address, contact Dreamable.studio.', 403);

  const name = typeof body.name === 'string' ? headerText(body.name, 120) : '';
  if (!name) return fail('Name is required.', 400);

  try {
    const user = await prisma.user.update({
      where: { id: auth.user.id },
      data: { name },
      select: { id: true, name: true, email: true, admin: true, sessionVersion: true },
    });
    // Name isn't a security change, so sessions stay valid; the cookie is refreshed so the header shows the new name.
    const rememberMe = auth.claims.exp - Date.now() > 2 * 24 * 60 * 60 * 1000;
    const res = NextResponse.json({ ok: true, name: user.name });
    setSessionCookie(res, createSessionToken({ userId: user.id, name: user.name, email: user.email, admin: user.admin, sv: user.sessionVersion }, rememberMe), rememberMe);
    return res;
  } catch (err) {
    console.error('[account/profile PATCH]', err);
    return fail('Could not save your changes.', 500);
  }
}
