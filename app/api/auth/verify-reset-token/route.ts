import { NextRequest, NextResponse } from 'next/server';
import { lookupResetToken } from '@/lib/resetTokens';
import { getClientIp } from '@/lib/clientIp';
import { RULES, consume, tooManyRequests } from '@/lib/rateLimit';

// Read-only: tells the reset page whether to show the form. Never consumes the token and never returns account details.
export async function POST(req: NextRequest) {
  try {
    const limited = await consume(RULES.linkIp, getClientIp(req.headers));
    if (!limited.allowed) {
      return NextResponse.json({ valid: false, expired: false, rateLimited: true, retryAfterSeconds: limited.retryAfterSec }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } });
    }

    const { token } = await req.json();
    const found = await lookupResetToken(token);
    if (found.state === 'expired') return NextResponse.json({ valid: false, expired: true });
    // Valid only for the state it was issued for (an invitation for an invited account, a reset for an active one).
    if (found.state !== 'valid' || found.user.status !== (found.purpose === 'INVITE' ? 'INVITED' : 'ACTIVE')) {
      return NextResponse.json({ valid: false, expired: false });
    }
    return NextResponse.json({ valid: true, expired: false, purpose: found.purpose === 'INVITE' ? 'invite' : 'reset' });
  } catch (err) {
    console.error('[verify-reset-token] error:', err);
    return NextResponse.json({ valid: false, expired: false });
  }
}
