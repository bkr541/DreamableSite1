import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

function verifyToken(token: string): { email: string } | null {
  const secret = process.env.RESET_SECRET ?? 'change-me-in-production';
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const { email, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (Date.now() > exp) return null;
  return { email };
}

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password || password.length < 8) {
      return NextResponse.json({ ok: false, error: 'Token and a password of at least 8 characters are required.' }, { status: 400 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ ok: false, error: 'Reset link is invalid or expired.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { email: decoded.email },
      data: { passwordHash, status: 'ACTIVE' },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[set-password] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
