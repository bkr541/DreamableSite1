import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Signs the user out everywhere: every cookie issued before this moment stops working on its next request.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: 'User not found.' }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { sessionVersion: { increment: 1 } } });
      await recordAudit(tx, { actorId: auth.user.id, action: 'user.revoke_sessions', targetType: 'user', targetId: id });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2025') {
      return NextResponse.json({ ok: false, error: 'User not found.' }, { status: 404 });
    }
    console.error('[admin/users revoke]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
