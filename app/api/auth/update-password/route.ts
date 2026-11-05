import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { statusAfterPasswordFlow } from '@/lib/accountStatus';

const INVALID_CODE = { ok: false, error: 'Invalid or expired code.' };

// Password update re-verifies the reset code and expiry server-side — the frontend
// calling verify-code first is not sufficient to authorize this operation.
export async function POST(req: NextRequest) {
  try {
    const { email, code, password } = await req.json();

    if (typeof email !== 'string' || typeof code !== 'string' || typeof password !== 'string' || !email || !code || !password) {
      return NextResponse.json(INVALID_CODE, { status: 400 });
    }
    if (password.length < 8 || password.length > 200) {
      return NextResponse.json({ ok: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    const submitted = code.toUpperCase().trim();

    if (
      !user ||
      !user.templogincode ||
      user.templogincode.toUpperCase() !== submitted ||
      !user.tempLoginCodeExpiresAt ||
      user.tempLoginCodeExpiresAt < new Date()
    ) {
      return NextResponse.json(INVALID_CODE, { status: 400 });
    }

    // Suspended / unknown-status accounts can never be revived by a code.
    const nextStatus = statusAfterPasswordFlow(user.status);
    if (!nextStatus) return NextResponse.json(INVALID_CODE, { status: 400 });

    const passwordHash = await hashPassword(password);

    // Single conditional update: it only matches while the exact code is still stored, unexpired and the account
    // is still eligible, so a replayed or concurrent request updates zero rows.
    const { count } = await prisma.user.updateMany({
      where: {
        id: user.id,
        templogincode: user.templogincode,
        tempLoginCodeExpiresAt: { gt: new Date() },
        status: { in: ['ACTIVE', 'INVITED'] },
      },
      data: {
        passwordHash,
        status: nextStatus,
        templogincode: null,
        tempLoginCodeExpiresAt: null,
        sessionVersion: { increment: 1 },
      },
    });
    if (count !== 1) return NextResponse.json(INVALID_CODE, { status: 400 });

    // A password change also retires any emailed reset link.
    await prisma.passwordResetToken.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[update-password] error:', err);
    return NextResponse.json({ ok: false, error: 'Unable to update password.' }, { status: 500 });
  }
}
