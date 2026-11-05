import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canUsePasswordFlow } from '@/lib/accountStatus';
import { getClientIp } from '@/lib/clientIp';
import { RULES, check, consume, firstDenied, tooManyRequests } from '@/lib/rateLimit';
import { logRef, logSecurity } from '@/lib/securityLog';
import { recoveryCodeMatches } from '@/lib/recoveryCode';

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail, code } = await req.json();

    if (typeof rawEmail !== 'string' || typeof code !== 'string' || !rawEmail || !code) {
      return NextResponse.json({ ok: false, error: 'Email and code are required.' }, { status: 400 });
    }
    const email = rawEmail.toLowerCase().trim();
    const ip = getClientIp(req.headers);

    // Guessing a code is what these limits exist to stop: a handful of wrong tries per account, then a cooldown.
    const blocked = firstDenied(
      await consume(RULES.codeIp, ip),
      await check(RULES.codeIpEmail, ip, email),
      await check(RULES.codeEmail, email),
    );
    if (blocked) {
      logSecurity('recovery.code_throttled', { ref: logRef(email), ip: logRef(ip) });
      return tooManyRequests(blocked, 'code attempts');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { templogincode: true, tempLoginCodeExpiresAt: true, status: true },
    });

    if (
      !user ||
      !canUsePasswordFlow(user.status) ||
      !recoveryCodeMatches(email, code, user.templogincode) ||
      !user.tempLoginCodeExpiresAt ||
      user.tempLoginCodeExpiresAt < new Date()
    ) {
      await consume(RULES.codeIpEmail, ip, email);
      await consume(RULES.codeEmail, email);
      return NextResponse.json({ ok: false, error: 'Invalid or expired code.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[verify-code] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
