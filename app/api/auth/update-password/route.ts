import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

// Password update re-verifies the reset code and expiry server-side — the frontend
// calling verify-code first is not sufficient to authorize this operation.
export async function POST(req: NextRequest) {
  try {
    const { email, code, password } = await req.json();

    if (!email || !code || !password) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired code.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (
      !user ||
      !user.templogincode ||
      user.templogincode.toUpperCase() !== code.toUpperCase().trim() ||
      !user.tempLoginCodeExpiresAt ||
      user.tempLoginCodeExpiresAt < new Date()
    ) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired code.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: 'ACTIVE',
        templogincode: null,
        tempLoginCodeExpiresAt: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[update-password] error:', err);
    return NextResponse.json({ ok: false, error: 'Unable to update password.' }, { status: 500 });
  }
}
