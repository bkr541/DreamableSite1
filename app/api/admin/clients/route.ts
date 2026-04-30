import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session?.admin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { name, email, password, role = 'CLIENT', status = 'INVITED', companyName, companyWebsite } =
    await req.json();

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json(
      { ok: false, error: 'Name, email, and password are required.' },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await hashPassword(password);

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
