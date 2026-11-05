import { NextRequest, NextResponse } from 'next/server';
import { lookupResetToken } from '@/lib/resetTokens';
import { canUsePasswordFlow } from '@/lib/accountStatus';

// Read-only: tells the reset page whether to show the form. Never consumes the token and never returns account details.
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    const found = await lookupResetToken(token);
    if (found.state === 'expired') return NextResponse.json({ valid: false, expired: true });
    if (found.state !== 'valid' || !canUsePasswordFlow(found.user.status)) {
      return NextResponse.json({ valid: false, expired: false });
    }
    return NextResponse.json({ valid: true, expired: false });
  } catch (err) {
    console.error('[verify-reset-token] error:', err);
    return NextResponse.json({ valid: false, expired: false });
  }
}
