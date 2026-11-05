import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { toApprovalResponse } from '@/lib/approvalDto';

const REQUIRED_FIELDS = ['name', 'email', 'service', 'description'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INCLUDE = { companyRecord: true, user: true, project: true } as const;

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

      const missing = REQUIRED_FIELDS.filter((f) => !inquiry[f]);
      if (missing.length) return { kind: 'missing' as const, missing };

      // Idempotent: everything already exists, so change nothing and write no audit row.
      if (inquiry.companyRecord && inquiry.user && inquiry.project) {
        return { kind: 'ok' as const, body: toApprovalResponse(inquiry) };
      }

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
          inquiryId: id, companyId: company.id, name: inquiry.name, email: inquiry.email,
          role: 'CLIENT', status: 'INVITED', invitedAt: now,
        },
      });
      const project = await tx.project.upsert({
        where: { inquiryId: id },
        update: {},
        create: {
          inquiryId: id, companyId: company.id, primaryUserId: user.id,
          name: `${inquiry.service} Project`, service: inquiry.service, description: inquiry.description,
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

      return { kind: 'ok' as const, body: toApprovalResponse({ ...approved, companyRecord: company, user, project }) };
    });

    if (result.kind === 'not_found') return NextResponse.json({ ok: false, error: 'Inquiry not found.' }, { status: 404 });
    if (result.kind === 'missing') {
      return NextResponse.json({ ok: false, error: `Missing required fields: ${result.missing.join(', ')}.` }, { status: 422 });
    }
    return NextResponse.json(result.body);
  } catch (err: unknown) {
    // Unique constraint on users.email — someone with this email already exists. The transaction rolled back.
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'A user with this email already exists.' }, { status: 409 });
    }
    console.error('[approve] unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
