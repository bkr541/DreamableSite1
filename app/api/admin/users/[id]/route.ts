import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { statusAfterUnsuspend } from '@/lib/accountStatus';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Admin-only account controls: suspend / unsuspend, and grant or remove admin. Every change revokes the
// user's sessions and writes an audit row in the same transaction.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: 'User not found.' }, { status: 404 });
  if (id === auth.user.id) {
    return NextResponse.json({ ok: false, error: 'You cannot change your own access.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const wantStatus = body.status as unknown;
  const wantAdmin = body.admin as unknown;
  if (wantStatus !== undefined && wantStatus !== 'ACTIVE' && wantStatus !== 'SUSPENDED') {
    return NextResponse.json({ ok: false, error: 'status must be ACTIVE or SUSPENDED.' }, { status: 400 });
  }
  if (wantAdmin !== undefined && typeof wantAdmin !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'admin must be true or false.' }, { status: 400 });
  }
  if (wantStatus === undefined && wantAdmin === undefined) {
    return NextResponse.json({ ok: false, error: 'Nothing to change.' }, { status: 400 });
  }

  try {
    const target = await prisma.user.findUnique({ where: { id }, select: { status: true, admin: true, lastLoginAt: true } });
    if (!target) return NextResponse.json({ ok: false, error: 'User not found.' }, { status: 404 });

    const data: { status?: string; admin?: boolean; role?: string; sessionVersion: { increment: number } } = { sessionVersion: { increment: 1 } };
    if (wantStatus === 'SUSPENDED') data.status = 'SUSPENDED';
    if (wantStatus === 'ACTIVE') data.status = target.status === 'SUSPENDED' ? statusAfterUnsuspend(target.lastLoginAt) : target.status;
    if (typeof wantAdmin === 'boolean') { data.admin = wantAdmin; data.role = wantAdmin ? 'ADMIN' : 'CLIENT'; }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id }, data, select: { id: true, status: true, admin: true } });
      await recordAudit(tx, {
        actorId: auth.user.id, action: 'user.access_change', targetType: 'user', targetId: id,
        metadata: { from: { status: target.status, admin: target.admin }, to: { status: u.status, admin: u.admin } },
      });
      return u;
    });
    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    console.error('[admin/users PATCH]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
