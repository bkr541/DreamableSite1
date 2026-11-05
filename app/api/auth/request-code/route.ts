import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canUsePasswordFlow } from '@/lib/accountStatus';
import { getClientIp } from '@/lib/clientIp';
import { RULES, consume, firstDenied, tooManyRequests } from '@/lib/rateLimit';
import { logRef, logSecurity } from '@/lib/securityLog';
import { enqueueEmail } from '@/lib/emailOutbox';
import { dispatchOutbox } from '@/lib/dispatch';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'A valid email is required.' }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();

    // Shared budget with forgot-password (see there). The answer never depends on whether the account exists.
    const ip = getClientIp(req.headers);
    const sendBlocked = firstDenied(
      await consume(RULES.recoveryEmailIp, ip),
      await consume(RULES.recoveryEmail, normalized),
    );
    if (sendBlocked) {
      logSecurity('recovery.send_throttled', { ref: logRef(normalized), ip: logRef(ip) });
      return tooManyRequests(sendBlocked, 'reset requests for this account');
    }

    // The code itself is generated (and only its hash stored) when the email is sent, so it never sits in the queue.
    const user = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true, email: true, status: true } });
    if (user && canUsePasswordFlow(user.status)) {
      await enqueueEmail(prisma, {
        eventType: 'auth.recovery_code', recipient: user.email,
        dedupeKey: `recovery-code:${user.id}:${Math.floor(Date.now() / 15_000)}`,
        payload: { userId: user.id }, entityType: 'user', entityId: user.id,
      });
      dispatchOutbox();
    }

    // Always return ok — don't reveal whether the email exists.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[request-code] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
