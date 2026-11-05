import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { toApprovalResponse } from '@/lib/approvalDto';
import { enqueueEmail } from '@/lib/emailOutbox';
import { dispatchOutbox } from '@/lib/dispatch';
import { links, notify } from '@/lib/notifications';
import { canReview } from '@/lib/inquiryReview';
import { canonicalServiceLabel } from '@/lib/services';

const REQUIRED_FIELDS = ['name', 'email', 'service', 'description'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INCLUDE = { companyRecord: true, user: true, project: true } as const;
const EMAIL_TAKEN = 'A client account with this email address already exists, so a second one can’t be created. Open Clients to review it before approving this request.';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Authorize before anything else: no lookup, no validation detail and no write for unauthorized callers.
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ ok: false, error: 'Inquiry not found.' }, { status: 404 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialise concurrent approvals of the same inquiry: the second caller waits here, then sees the first one's rows.
      await tx.$queryRaw`SELECT id FROM inquiries WHERE id = ${id}::uuid FOR UPDATE`;

      const inquiry = await tx.inquiry.findUnique({ where: { id }, include: INCLUDE });
      if (!inquiry) return { kind: 'not_found' as const };

      // Idempotent: everything already exists, so change nothing, write no audit row, queue no second invitation.
      if (inquiry.companyRecord && inquiry.user && inquiry.project) {
        return { kind: 'ok' as const, body: { ...toApprovalResponse(inquiry), alreadyApproved: true } };
      }

      // Rejected and archived inquiries can't be approved by accident (see lib/inquiryReview.ts).
      const verdict = canReview(inquiry, 'approve');
      if (!verdict.ok) return { kind: 'blocked' as const, verdict };

      const missing = REQUIRED_FIELDS.filter((f) => !inquiry[f]);
      if (missing.length) return { kind: 'missing' as const, missing };

      // An existing account is never overwritten or re-pointed at a different request.
      const email = inquiry.email.toLowerCase().trim();
      const existing = await tx.user.findUnique({ where: { email }, select: { inquiryId: true, name: true, status: true } });
      if (existing && existing.inquiryId !== id) return { kind: 'email_taken' as const, name: existing.name, status: existing.status };

      const now = new Date();
      const approved = await tx.inquiry.update({
        where: { id },
        data: { status: 'APPROVED', approvedAt: now, approvedById: auth.user.id },
      });
      const company = await tx.company.upsert({
        where: { inquiryId: id },
        update: {},
        create: { inquiryId: id, name: inquiry.company || inquiry.name, website: inquiry.website ?? undefined, status: 'ACTIVE' },
      });
      const user = await tx.user.upsert({
        where: { inquiryId: id },
        update: {},
        create: {
          inquiryId: id, companyId: company.id, name: inquiry.name, email,
          role: 'CLIENT', status: 'INVITED', invitedAt: now,
        },
      });
      const project = await tx.project.upsert({
        where: { inquiryId: id },
        update: {},
        create: {
          inquiryId: id, companyId: company.id, primaryUserId: user.id,
          name: `${canonicalServiceLabel(inquiry.service)} Project`, service: canonicalServiceLabel(inquiry.service), description: inquiry.description,
          budgetRange: inquiry.budgetRange ?? undefined, timeline: inquiry.timeline ?? undefined, status: 'ONBOARDING',
        },
      });

      // Same transaction: if this fails, nothing above is kept.
      await recordAudit(tx, {
        actorId: auth.user.id,
        action: 'inquiry.approve',
        targetType: 'inquiry',
        targetId: id,
        metadata: { companyId: company.id, userId: user.id, projectId: project.id },
      });

      // The client's invitation and the staff notification are part of the same transaction as the approval.
      await enqueueEmail(tx, {
        eventType: 'client.invitation', recipient: user.email, dedupeKey: `invite:${user.id}`,
        payload: { userId: user.id }, entityType: 'user', entityId: user.id,
      });
      await notify(tx, {
        type: 'inquiry.approved', title: `Inquiry approved: ${inquiry.name}`, body: `${inquiry.service} — a client portal invitation was queued`,
        entityType: 'inquiry', entityId: id, url: links.inquiry(id), actorId: auth.user.id, dedupeKey: `inquiry.approved:${id}`,
      });

      return { kind: 'ok' as const, body: toApprovalResponse({ ...approved, companyRecord: company, user, project }), first: true as const };
    });

    if (result.kind === 'blocked') return NextResponse.json({ ok: false, code: result.verdict.code, error: result.verdict.error }, { status: 409 });
    if (result.kind === 'email_taken') return NextResponse.json({ ok: false, code: 'EMAIL_EXISTS', error: EMAIL_TAKEN }, { status: 409 });
    if (result.kind === 'not_found') return NextResponse.json({ ok: false, error: 'Inquiry not found.' }, { status: 404 });
    if (result.kind === 'missing') {
      return NextResponse.json({ ok: false, error: `Missing required fields: ${result.missing.join(', ')}.` }, { status: 422 });
    }
    if ('first' in result && result.first) dispatchOutbox();
    return NextResponse.json(result.body);
  } catch (err: unknown) {
    // Unique constraint on users.email — someone with this email already exists. The transaction rolled back.
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json({ ok: false, code: 'EMAIL_EXISTS', error: EMAIL_TAKEN }, { status: 409 });
    }
    console.error('[approve] unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
