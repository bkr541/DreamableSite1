import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { name, email, companyName, companyWebsite } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ ok: false, error: 'Name is required.' }, { status: 400 });
  }
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ ok: false, error: 'A valid email is required.' }, { status: 400 });
  }

  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { companyId: true },
    });

    // Handle company create-or-update if a name was provided.
    if (companyName?.trim()) {
      if (currentUser?.companyId) {
        await prisma.company.update({
          where: { id: currentUser.companyId },
          data: {
            name: companyName.trim(),
            website: companyWebsite?.trim() || null,
          },
        });
      } else {
        const company = await prisma.company.create({
          data: {
            name: companyName.trim(),
            website: companyWebsite?.trim() || null,
          },
        });
        await prisma.user.update({
          where: { id: auth.user.id },
          data: { companyId: company.id },
        });
      }
    } else if (currentUser?.companyId) {
      // Company name cleared — update website only, keep the record.
      await prisma.company.update({
        where: { id: currentUser.companyId },
        data: { website: companyWebsite?.trim() || null },
      });
    }

    const user = await prisma.user.update({
      where: { id: auth.user.id },
      data: { name: name.trim(), email: email.toLowerCase().trim() },
    });

    // Re-issue the session cookie so the header reflects the new name/email immediately.
    // Preserve the original remember-me duration if the session has more than 2 days remaining.
    const rememberMe = auth.claims.exp - Date.now() > 2 * 24 * 60 * 60 * 1000;
    const token = createSessionToken(
      { userId: user.id, name: user.name, email: user.email, admin: user.admin, sv: user.sessionVersion },
      rememberMe,
    );
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, token, rememberMe);
    return res;
  } catch (err) {
    console.error('[admin/profile PUT]', err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return NextResponse.json({ ok: false, error: 'That email is already in use.' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: 'Failed to update profile.' }, { status: 500 });
  }
}
