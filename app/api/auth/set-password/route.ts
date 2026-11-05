import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getClientIp } from '@/lib/clientIp';
import { RULES, consume, tooManyRequests } from '@/lib/rateLimit';
import { consumeResetToken, lookupResetToken } from '@/lib/resetTokens';
import { passwordProblem } from '@/lib/passwordPolicy';
import { links, notify } from '@/lib/notifications';

const INVALID = { ok: false, error: 'Reset link is invalid or expired.' };
const INVITE_USED = { ok: false, error: 'This invitation has already been used or is no longer valid. Sign in, or ask us to send a new one.' };

export async function POST(req: NextRequest) {
  try {
    const limited = await consume(RULES.linkIp, getClientIp(req.headers));
    if (!limited.allowed) return tooManyRequests(limited, 'attempts');

    const { token, password } = await req.json();

    if (typeof token !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ ok: false, error: 'A link and a password are required.' }, { status: 400 });
    }

    const found = await lookupResetToken(token);
    if (found.state !== 'valid') return NextResponse.json(INVALID, { status: 400 });

    // A link only works for the situation it was issued for. An invitation completes first-time setup of an
    // INVITED account; a reset link recovers an ACTIVE one. Neither can be used to move any other account
    // (suspended, already set up, …) anywhere — a link never reactivates a suspended client.
    const invite = found.purpose === 'INVITE';
    const requiredStatus = invite ? 'INVITED' : 'ACTIVE';
    if (found.user.status !== requiredStatus) return NextResponse.json(invite ? INVITE_USED : INVALID, { status: 400 });

    const account = await prisma.user.findUnique({ where: { id: found.user.id }, select: { email: true, name: true } });
    const weak = passwordProblem(password, { email: account?.email });
    if (weak) return NextResponse.json({ ok: false, error: weak }, { status: 400 });

    const wasInvited = invite;
    const passwordHash = await hashPassword(password);

    const done = await prisma.$transaction(async (tx) => {
      // Claim the link first. Of two simultaneous requests only one gets count === 1.
      if (!(await consumeResetToken(tx, found.id))) return false;

      const { count } = await tx.user.updateMany({
        where: { id: found.user.id, status: requiredStatus },   // re-checked here, so a suspension in between still wins
        data: {
          passwordHash,
          status: 'ACTIVE',
          templogincode: null,
          tempLoginCodeExpiresAt: null,
          sessionVersion: { increment: 1 }, // every existing session for this user dies
        },
      });
      if (count !== 1) throw new Rollback();

      // The first time an invited client sets a password they become active — staff want to know.
      if (wasInvited) {
        const u = await tx.user.findUnique({ where: { id: found.user.id }, select: { name: true } });
        await notify(tx, {
          type: 'client.activated', title: `${u?.name ?? 'A client'} activated their account`, body: 'They set a password and can now sign in to the portal.',
          entityType: 'user', entityId: found.user.id, url: links.clients(), dedupeKey: `client.activated:${found.user.id}`,
        });
      }

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
