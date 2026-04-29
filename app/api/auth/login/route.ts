import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { createSessionToken, setSessionCookie } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { email, password, rememberMe = false } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'Email and password are required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ ok: false, error: 'Invalid email or password.' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'Invalid email or password.' }, { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = createSessionToken({ userId: user.id, email: user.email, admin: user.admin }, rememberMe);
    const res = NextResponse.json({ ok: true, admin: user.admin });
    setSessionCookie(res, token, rememberMe);
    return res;
  } catch (err) {
    console.error('[login] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
