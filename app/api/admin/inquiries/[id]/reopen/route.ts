import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { canReview } from '@/lib/inquiryReview';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status: number, extra: object = {}) => NextResponse.json({ ok: false, error, ...extra }, { status });

// The only way back from REJECTED, so an approval can never quietly override a rejection.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return fail('Inquiry not found.', 404);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.inquiry.findUnique({ where: { id }, select: { status: true, archivedAt: true } });
      if (!current) return { kind: 'missing' as const };
      if (current.status === 'INQUIRY' && !current.archivedAt) return { kind: 'already' as const };
      const verdict = canReview(current, 'reopen');
      if (!verdict.ok) return { kind: 'blocked' as const, verdict };

      const { count } = await tx.inquiry.updateMany({
        where: { id, status: 'REJECTED', archivedAt: null },
        data: { status: 'INQUIRY', rejectedAt: null, rejectedById: null, rejectionReason: null },
      });
      if (count !== 1) return { kind: 'changed' as const };
      await recordAudit(tx, { actorId: auth.user.id, action: 'inquiry.reopen', targetType: 'inquiry', targetId: id });
      return { kind: 'done' as const };
    });

    if (result.kind === 'missing') return fail('Inquiry not found.', 404);
    if (result.kind === 'blocked') return fail(result.verdict.error, 409, { code: result.verdict.code });
    if (result.kind === 'changed') return fail('This inquiry was just updated by someone else. Refresh and try again.', 409, { code: 'CHANGED' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/inquiries reopen]', err);
    return fail('Internal server error.', 500);
  }
}
