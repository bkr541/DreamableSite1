import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => NextResponse.json({ ok: false, error: 'Comment not found.' }, { status: 404 });

// Moderation: approve a held comment, or hide one from the public link without deleting it.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return notFound();

  const { status } = await req.json().catch(() => ({}));
  if (status !== 'APPROVED' && status !== 'HIDDEN') {
    return NextResponse.json({ ok: false, error: 'status must be APPROVED or HIDDEN.' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.deliverableComment.findUnique({ where: { id }, select: { status: true, deliverableId: true } });
      if (!before) return null;
      await tx.deliverableComment.update({ where: { id }, data: { status } });
      await recordAudit(tx, {
        actorId: auth.user.id, action: 'comment.moderate', targetType: 'deliverable_comment', targetId: id,
        metadata: { from: before.status, to: status, deliverableId: before.deliverableId },
      });
      return status as string;
    });
    return result ? NextResponse.json({ ok: true, status: result }) : notFound();
  } catch (err) {
    console.error('[admin/deliverable-comments PATCH]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return notFound();

  try {
    const done = await prisma.$transaction(async (tx) => {
      const before = await tx.deliverableComment.findUnique({ where: { id }, select: { status: true, deliverableId: true, authorName: true } });
      if (!before) return false;
      await tx.deliverableComment.delete({ where: { id } });
      // The commenter's words are not copied into the audit trail — only that a comment was removed.
      await recordAudit(tx, {
        actorId: auth.user.id, action: 'comment.delete', targetType: 'deliverable_comment', targetId: id,
        metadata: { status: before.status, deliverableId: before.deliverableId },
      });
      return true;
    });
    return done ? NextResponse.json({ ok: true }) : notFound();
  } catch (err) {
    console.error('[admin/deliverable-comments DELETE]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
