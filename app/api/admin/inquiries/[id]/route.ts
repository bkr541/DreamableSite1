import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// Archive / restore. Archiving only hides the lead from the open list: its project, client, folders, files,
// comments and share links are not touched, so the client keeps everything. There is deliberately no DELETE
// here — permanent removal is a separate, guarded action (see ./purge).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return fail('Inquiry not found.', 404);

  const { archived } = await req.json().catch(() => ({}));
  if (typeof archived !== 'boolean') return fail('archived must be true or false.', 400);

  try {
    const done = await prisma.$transaction(async (tx) => {
      const current = await tx.inquiry.findUnique({ where: { id }, select: { archivedAt: true } });
      if (!current) return null;
      if (!!current.archivedAt === archived) return { archivedAt: current.archivedAt }; // already in that state
      const updated = await tx.inquiry.update({
        where: { id },
        data: archived ? { archivedAt: new Date(), archivedById: auth.user.id } : { archivedAt: null, archivedById: null },
        select: { archivedAt: true },
      });
      await recordAudit(tx, { actorId: auth.user.id, action: archived ? 'inquiry.archive' : 'inquiry.restore', targetType: 'inquiry', targetId: id });
      return updated;
    });
    if (!done) return fail('Inquiry not found.', 404);
    return NextResponse.json({ ok: true, archivedAt: done.archivedAt?.toISOString() ?? null });
  } catch (err) {
    console.error('[admin/inquiries PATCH]', err);
    return fail('Internal server error.', 500);
  }
}
