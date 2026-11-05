import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { canReview } from '@/lib/inquiryReview';
import { headerText } from '@/lib/html';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status: number, extra: object = {}) => NextResponse.json({ ok: false, error, ...extra }, { status });

// Closes an unapproved inquiry. It creates nothing, deletes nothing (attachments and files stay) and emails nobody.
// The reason is an internal note: it is stored for staff and never sent anywhere.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return fail('Inquiry not found.', 404);

  const body = await req.json().catch(() => ({}));
  if (body.reason !== undefined && typeof body.reason !== 'string') return fail('The reason must be text.', 400);
  const reason = body.reason ? headerText(body.reason, 500) || null : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.inquiry.findUnique({ where: { id }, select: { status: true, archivedAt: true } });
      if (!current) return { kind: 'missing' as const };
      if (current.status === 'REJECTED' && !current.archivedAt) return { kind: 'already' as const };   // a repeated click

      const verdict = canReview(current, 'reject');
      if (!verdict.ok) return { kind: 'blocked' as const, verdict };

      // Conditional on still being a plain open inquiry, so a rejection can't race an approval.
      const { count } = await tx.inquiry.updateMany({
        where: { id, status: 'INQUIRY', archivedAt: null },
        data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: auth.user.id, rejectionReason: reason },
      });
      if (count !== 1) return { kind: 'changed' as const };
      await recordAudit(tx, { actorId: auth.user.id, action: 'inquiry.reject', targetType: 'inquiry', targetId: id, metadata: { hasReason: !!reason } });
      return { kind: 'done' as const };
    });

    if (result.kind === 'missing') return fail('Inquiry not found.', 404);
    if (result.kind === 'blocked') return fail(result.verdict.error, 409, { code: result.verdict.code });
    if (result.kind === 'changed') return fail('This inquiry was just updated by someone else. Refresh and try again.', 409, { code: 'CHANGED' });
    return NextResponse.json({ ok: true, alreadyRejected: result.kind === 'already' });
  } catch (err) {
    console.error('[admin/inquiries reject]', err);
    return fail('Internal server error.', 500);
  }
}
