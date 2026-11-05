import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { statusAfterPasswordFlow } from '@/lib/accountStatus';
import { getClientIp } from '@/lib/clientIp';
import { RULES, check, consume, firstDenied, tooManyRequests } from '@/lib/rateLimit';
import { logRef, logSecurity } from '@/lib/securityLog';
import { recoveryCodeMatches } from '@/lib/recoveryCode';
import { passwordProblem } from '@/lib/passwordPolicy';
import { links, notify } from '@/lib/notifications';

const INVALID_CODE = { ok: false, error: 'Invalid or expired code.' };

// Password update re-verifies the reset code and expiry server-side — the frontend
// calling verify-code first is not sufficient to authorize this operation.
export async function POST(req: NextRequest) {
  try {
    const { email, code, password } = await req.json();

    if (typeof email !== 'string' || typeof code !== 'string' || typeof password !== 'string' || !email || !code || !password) {
      return NextResponse.json(INVALID_CODE, { status: 400 });
    }
    const weak = passwordProblem(password, { email });
    if (weak) return NextResponse.json({ ok: false, error: weak }, { status: 400 });

    const normalizedEmail = email.toLowerCase().trim();
    const ip = getClientIp(req.headers);

    // Same code-guessing budget as verify-code: this route accepts the code too.
    const blocked = firstDenied(
      await consume(RULES.codeIp, ip),
      await check(RULES.codeIpEmail, ip, normalizedEmail),
      await check(RULES.codeEmail, normalizedEmail),
    );
    if (blocked) {
      logSecurity('recovery.code_throttled', { ref: logRef(normalizedEmail), ip: logRef(ip) });
      return tooManyRequests(blocked, 'code attempts');
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (
      !user ||
      !recoveryCodeMatches(normalizedEmail, code, user.templogincode) ||
      !user.tempLoginCodeExpiresAt ||
      user.tempLoginCodeExpiresAt < new Date()
    ) {
      await consume(RULES.codeIpEmail, ip, normalizedEmail);
      await consume(RULES.codeEmail, normalizedEmail);
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
        templogincode: user.templogincode, // the stored hash: only matches while this exact code is still outstanding
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

    if (user.status === 'INVITED') {
      await notify(prisma, {
        type: 'client.activated', title: `${user.name} activated their account`, body: 'They set a password and can now sign in to the portal.',
        entityType: 'user', entityId: user.id, url: links.clients(), dedupeKey: `client.activated:${user.id}`,
      }).catch((e) => console.error('[update-password] notification failed', e instanceof Error ? e.message : e));
    }

    // A password change also retires any emailed reset link.
    await prisma.passwordResetToken.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[update-password] error:', err);
    return NextResponse.json({ ok: false, error: 'Unable to update password.' }, { status: 500 });
  }
}
