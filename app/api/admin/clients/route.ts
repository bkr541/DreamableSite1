import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { isUserStatus } from '@/lib/accountStatus';

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

    let companyId: string | null = null;
    if (companyName?.trim()) {
      const company = await prisma.company.create({
        data: {
          name: companyName.trim(),
          website: companyWebsite?.trim() || null,
          status: 'ACTIVE',
        },
      });
      companyId = company.id;
    }

    await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role,
        status,
        companyId,
      },
    });

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
