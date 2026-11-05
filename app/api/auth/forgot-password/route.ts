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

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ ok: false, error: 'Email is required.' }, { status: 400 });
    }
    const normalized = email.toLowerCase().trim();

    // One budget per mailbox and per source, shared by "email me a link" and "email me a code", so neither
    // route can be used to flood someone's inbox. The answer never depends on whether the account exists.
    const ip = getClientIp(req.headers);
    const sendBlocked = firstDenied(
      await consume(RULES.recoveryEmailIp, ip),
      await consume(RULES.recoveryEmail, normalized),
    );
    if (sendBlocked) {
      logSecurity('recovery.send_throttled', { ref: logRef(normalized), ip: logRef(ip) });
      return tooManyRequests(sendBlocked, 'reset requests for this account');
    }

    // Always answer ok so the response never reveals which emails exist or what state they are in. For a real
    // account we only queue a job (a reference, not the link): the link is created when the email is sent, so
    // no token ever sits in the queue, and the request takes the same time whether or not the account exists.
    const user = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true, email: true, status: true } });
    if (user && canUsePasswordFlow(user.status)) {
      await enqueueEmail(prisma, {
        eventType: 'auth.reset_link', recipient: user.email,
        dedupeKey: `reset-link:${user.id}:${Math.floor(Date.now() / 15_000)}`, // a double click within a few seconds is one email
        payload: { userId: user.id }, entityType: 'user', entityId: user.id,
      });
      dispatchOutbox();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[forgot-password] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
