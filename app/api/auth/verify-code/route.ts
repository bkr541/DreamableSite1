import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canUsePasswordFlow } from '@/lib/accountStatus';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (typeof email !== 'string' || typeof code !== 'string' || !email || !code) {
      return NextResponse.json({ ok: false, error: 'Email and code are required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { templogincode: true, tempLoginCodeExpiresAt: true, status: true },
    });

    if (
      !user?.templogincode ||
      !canUsePasswordFlow(user.status) ||
      user.templogincode.toUpperCase() !== code.toUpperCase().trim() ||
      !user.tempLoginCodeExpiresAt ||
      user.tempLoginCodeExpiresAt < new Date()
    ) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired code.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[verify-code] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
