import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { headerText, safeEmailAddress } from '@/lib/html';

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// Updates the signed-in admin's own details and organisation. The user row and the company row change together or
// not at all, and the session cookie is only re-issued after that has committed.
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('We could not read that request.', 400);

  const name = typeof body.name === 'string' ? headerText(body.name, 120) : '';
  const email = typeof body.email === 'string' ? safeEmailAddress(body.email)?.toLowerCase() : null;
  const companyName = typeof body.companyName === 'string' ? headerText(body.companyName, 200) : '';
  const companyWebsite = typeof body.companyWebsite === 'string' ? headerText(body.companyWebsite, 300) : '';
  if (!name) return fail('Name is required.', 400);
  if (!email) return fail('A valid email is required.', 400);

  const me = auth.user.id;
  try {
    // Fast, friendly conflict check before any write. The transaction below still protects against a race.
    const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (clash && clash.id !== me) return fail('That email is already in use.', 409);

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: me }, select: { email: true, companyId: true } });
      if (!current) throw new Error('user vanished');

      let companyId = current.companyId;
      if (companyName || companyId) {
        // A company that other people belong to is never edited from one member's profile: that would change
        // someone else's organisation. In that case this admin gets a company of their own instead.
        const shared = companyId ? (await tx.user.count({ where: { companyId, id: { not: me } } })) > 0 : false;
        if (companyId && !shared) {
          await tx.company.update({ where: { id: companyId }, data: { ...(companyName ? { name: companyName } : {}), website: companyWebsite || null } });
        } else if (companyName) {
          companyId = (await tx.company.create({ data: { name: companyName, website: companyWebsite || null }, select: { id: true } })).id;
        }
      }

      const emailChanged = email !== current.email;
      return tx.user.update({
        where: { id: me },
        data: {
          name, email, companyId,
          // Signing in with a new address is a new identity: other sessions end, this one is re-issued below.
          ...(emailChanged ? { sessionVersion: { increment: 1 } } : {}),
        },
        select: { id: true, name: true, email: true, admin: true, sessionVersion: true },
      });
    });

    // Only now — everything above committed — does the cookie change. Role comes from the database, not the old cookie.
    const rememberMe = auth.claims.exp - Date.now() > 2 * 24 * 60 * 60 * 1000;
    const token = createSessionToken({ userId: updated.id, name: updated.name, email: updated.email, admin: updated.admin, sv: updated.sessionVersion }, rememberMe);
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, token, rememberMe);
    return res;
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') return fail('That email is already in use.', 409);
    console.error('[admin/profile PUT]', err);
    return fail('Failed to update profile.', 500);
  }
}
