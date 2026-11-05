import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { isUserStatus } from '@/lib/accountStatus';
import { enqueueEmail } from '@/lib/emailOutbox';
import { dispatchOutbox } from '@/lib/dispatch';

function generateSecurePassword(): string {
  // 24-char random password — strong enough that the client should reset via forgot-password
  return randomBytes(18).toString('base64url');
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { name, email, role = 'CLIENT', status = 'INVITED', companyName, companyWebsite } =
    await req.json();

  if (role !== 'CLIENT' || !isUserStatus(status)) {
    return NextResponse.json({ ok: false, error: 'Invalid role or status.' }, { status: 400 });
  }

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'Name and email are required.' },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await hashPassword(generateSecurePassword());

    // Company, user and the invitation email are created together: either all exist or none do.
    const invited = await prisma.$transaction(async (tx) => {
      let companyId: string | null = null;
      if (companyName?.trim()) {
        const company = await tx.company.create({
          data: { name: companyName.trim(), website: companyWebsite?.trim() || null, status: 'ACTIVE' },
        });
        companyId = company.id;
      }

      const user = await tx.user.create({
        data: { name: name.trim(), email: email.toLowerCase().trim(), passwordHash, role, status, companyId },
        select: { id: true, email: true },
      });

      // Only someone who still has to finish setting up gets an invitation (the link is created when it is sent).
      if (status === 'INVITED') {
        await enqueueEmail(tx, {
          eventType: 'client.invitation', recipient: user.email, dedupeKey: `invite:${user.id}`,
          payload: { userId: user.id }, entityType: 'user', entityId: user.id,
        });
        return true;
      }
      return false;
    });
    if (invited) dispatchOutbox();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { ok: false, error: 'A user with that email already exists.' },
        { status: 409 },
      );
    }
    console.error('[admin/clients POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
