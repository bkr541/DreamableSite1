import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import { canSignIn } from '@/lib/accountStatus';
import { getClientIp } from '@/lib/clientIp';
import { RULES, check, clear, consume, firstDenied, tooManyRequests } from '@/lib/rateLimit';
import { logRef, logSecurity } from '@/lib/securityLog';

// Verified against when the email doesn't exist, so "no such user" costs the same time as "wrong password".
const DECOY_HASH = '00000000000000000000000000000000:' + '0'.repeat(128);

const INVALID = () => NextResponse.json({ ok: false, error: 'Invalid email or password.' }, { status: 401 });

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail, password, rememberMe = false } = await req.json();

    if (typeof rawEmail !== 'string' || typeof password !== 'string' || !rawEmail || !password) {
      return NextResponse.json({ ok: false, error: 'Email and password are required.' }, { status: 400 });
    }

    const email = rawEmail.toLowerCase().trim();
    const ip = getClientIp(req.headers);

    // Throttle before touching the database or hashing anything. The answer depends only on the request
    // counters, never on whether the account exists. Account budgets count *failures*, so the owner's own
    // correct password isn't used up by someone else's guesses, and every block expires on its own.
    const blocked = firstDenied(
      await consume(RULES.loginIp, ip),
      await check(RULES.loginIpEmail, ip, email),
      await check(RULES.loginEmail, email),
    );
    if (blocked) {
      logSecurity('login.throttled', { ref: logRef(email), ip: logRef(ip) });
      return tooManyRequests(blocked, 'sign-in attempts');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = await verifyPassword(password, user?.passwordHash ?? DECOY_HASH);

    if (!user || !user.passwordHash || !valid) {
      await consume(RULES.loginIpEmail, ip, email);
      await consume(RULES.loginEmail, email);
      return INVALID();
    }

    // The password was right, so this person is not guessing: wipe their failure counters.
    await Promise.all([clear(RULES.loginIpEmail, ip, email), clear(RULES.loginEmail, email)]);

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
