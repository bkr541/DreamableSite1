import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import { canSignIn } from '@/lib/accountStatus';

export async function POST(req: NextRequest) {
  try {
    const { email, password, rememberMe = false } = await req.json();

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return NextResponse.json({ ok: false, error: 'Email and password are required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ ok: false, error: 'Invalid email or password.' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'Invalid email or password.' }, { status: 401 });
    }

    // Only checked after the password is correct, so wrong guesses learn nothing about the account.
    if (!canSignIn(user.status)) {
      const error = user.status === 'INVITED'
        ? 'Your account setup is not finished. Use "Forgot password" to set your password.'
        : 'This account is not able to sign in. Please contact Dreamable.studio.';
      return NextResponse.json({ ok: false, error }, { status: 403 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = createSessionToken(
      { userId: user.id, name: user.name, email: user.email, admin: user.admin, sv: user.sessionVersion },
      rememberMe === true,
    );
    const res = NextResponse.json({ ok: true, admin: user.admin });
    setSessionCookie(res, token, rememberMe === true);
    return res;
  } catch (err) {
    console.error('[login] error:', err);
    // Details stay in the server log; never send database or stack text to the browser.
    return NextResponse.json({ ok: false, error: 'We could not sign you in right now. Please try again in a few minutes.' }, { status: 500 });
  }
}
