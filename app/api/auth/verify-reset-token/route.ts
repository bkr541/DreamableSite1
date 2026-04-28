import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ valid: false, expired: false });
    }

    const secret = process.env.RESET_SECRET ?? 'change-me-in-production';
    const parts = token.split('.');
    if (parts.length !== 2) return NextResponse.json({ valid: false, expired: false });

    const [payload, sig] = parts;

    // Verify signature using timing-safe comparison.
    const expected = createHmac('sha256', secret).update(payload).digest('base64url');
    let sigMatch = false;
    try {
      sigMatch = timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return NextResponse.json({ valid: false, expired: false });
    }

    if (!sigMatch) return NextResponse.json({ valid: false, expired: false });

    // Decode payload and check expiry.
    const { email, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (Date.now() > exp) return NextResponse.json({ valid: false, expired: true });

    return NextResponse.json({ valid: true, expired: false, email });
  } catch {
    return NextResponse.json({ valid: false, expired: false });
  }
}
