import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { consumeResetToken, lookupResetToken } from '@/lib/resetTokens';
import { statusAfterPasswordFlow } from '@/lib/accountStatus';

const INVALID = { ok: false, error: 'Reset link is invalid or expired.' };

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (typeof token !== 'string' || typeof password !== 'string' || password.length < 8 || password.length > 200) {
      return NextResponse.json({ ok: false, error: 'Token and a password of at least 8 characters are required.' }, { status: 400 });
    }

    const found = await lookupResetToken(token);
    if (found.state !== 'valid') return NextResponse.json(INVALID, { status: 400 });

    const nextStatus = statusAfterPasswordFlow(found.user.status);
    if (!nextStatus) return NextResponse.json(INVALID, { status: 400 }); // suspended etc.: a link never reactivates

    const passwordHash = await hashPassword(password);

    const done = await prisma.$transaction(async (tx) => {
      // Claim the link first. Of two simultaneous requests only one gets count === 1.
      if (!(await consumeResetToken(tx, found.id))) return false;

      // Re-check the status inside the same transaction so a suspension between lookup and now still wins.
      const { count } = await tx.user.updateMany({
        where: { id: found.user.id, status: { in: ['ACTIVE', 'INVITED'] } },
        data: {
          passwordHash,
          status: nextStatus,
          templogincode: null,
          tempLoginCodeExpiresAt: null,
          sessionVersion: { increment: 1 }, // every existing session for this user dies
        },
      });
      if (count !== 1) throw new Rollback();

      // Any other link for this user is now stale.
      await tx.passwordResetToken.updateMany({ where: { userId: found.user.id, consumedAt: null }, data: { consumedAt: new Date() } });
      return true;
    }).catch((e) => (e instanceof Rollback ? false : Promise.reject(e)));

    if (!done) return NextResponse.json(INVALID, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[set-password] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

class Rollback extends Error {}
