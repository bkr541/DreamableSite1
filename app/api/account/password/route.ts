import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { passwordProblem } from '@/lib/passwordPolicy';
import { RULES, check, clear, consume, tooManyRequests } from '@/lib/rateLimit';
import { logRef, logSecurity } from '@/lib/securityLog';

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// Changing your own password. It needs the current password (re-authentication), applies the same strength rules as
// everywhere else, and signs out every OTHER device — this one stays signed in on a freshly issued session.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') return fail('Enter your current password and a new one.', 400);

  const me = auth.user.id;
  const blocked = await check(RULES.accountReauth, me);
  if (!blocked.allowed) {
    logSecurity('account.reauth_throttled', { ref: logRef(me) });
    return tooManyRequests(blocked, 'password attempts');
  }

  try {
    const row = await prisma.user.findUnique({ where: { id: me }, select: { passwordHash: true, email: true } });
    if (!row?.passwordHash || !(await verifyPassword(body.currentPassword, row.passwordHash))) {
      await consume(RULES.accountReauth, me);
      return fail('Your current password isn’t right.', 400);
    }
    await clear(RULES.accountReauth, me);

    const weak = passwordProblem(body.newPassword, { email: row.email });
    if (weak) return fail(weak, 400);
    if (body.newPassword === body.currentPassword) return fail('Choose a password you haven’t used for this account just now.', 400);

    const user = await prisma.user.update({
      where: { id: me },
      data: { passwordHash: await hashPassword(body.newPassword), sessionVersion: { increment: 1 }, templogincode: null, tempLoginCodeExpiresAt: null },
      select: { id: true, name: true, email: true, admin: true, sessionVersion: true },
    });
    // Every other session is now revoked. This one continues on a new cookie that carries the new version.
    const rememberMe = auth.claims.exp - Date.now() > 2 * 24 * 60 * 60 * 1000;
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, createSessionToken({ userId: user.id, name: user.name, email: user.email, admin: user.admin, sv: user.sessionVersion }, rememberMe), rememberMe);
    return res;
  } catch (err) {
    console.error('[account/password POST]', err);
    return fail('Could not change your password.', 500);
  }
}
