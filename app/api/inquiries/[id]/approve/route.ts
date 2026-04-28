import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const REQUIRED_FIELDS = ['name', 'email', 'service', 'description'] as const;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      include: { companyRecord: true, user: true, project: true },
    });

    if (!inquiry) {
      return NextResponse.json({ ok: false, error: 'Inquiry not found.' }, { status: 404 });
    }

    // Guard: required fields must be present before approval.
    const missing = REQUIRED_FIELDS.filter((f) => !inquiry[f]);
    if (missing.length) {
      return NextResponse.json(
        { ok: false, error: `Missing required fields: ${missing.join(', ')}.` },
        { status: 422 },
      );
    }

    // Idempotent: if all three records already exist, return them as-is.
    if (inquiry.companyRecord && inquiry.user && inquiry.project) {
      return NextResponse.json({
        ok: true,
        inquiry,
        company: inquiry.companyRecord,
        user: inquiry.user,
        project: inquiry.project,
      });
    }

    const now = new Date();

    const [updatedInquiry, company, user, project] = await prisma.$transaction(async (tx) => {
      const approved = await tx.inquiry.update({
        where: { id },
        data: { status: 'APPROVED', approvedAt: now },
      });

      const co = await tx.company.upsert({
        where: { inquiryId: id },
        update: {},
        create: {
          inquiryId: id,
          name: inquiry.company || inquiry.name,
          website: inquiry.website ?? undefined,
          status: 'ACTIVE',
        },
      });

      const usr = await tx.user.upsert({
        where: { inquiryId: id },
        update: {},
        create: {
          inquiryId: id,
          companyId: co.id,
          name: inquiry.name,
          email: inquiry.email,
          role: 'CLIENT',
          status: 'INVITED',
          invitedAt: now,
        },
      });

      const proj = await tx.project.upsert({
        where: { inquiryId: id },
        update: {},
        create: {
          inquiryId: id,
          companyId: co.id,
          primaryUserId: usr.id,
          name: `${inquiry.service} Project`,
          service: inquiry.service,
          description: inquiry.description,
          budgetRange: inquiry.budgetRange ?? undefined,
          timeline: inquiry.timeline ?? undefined,
          status: 'ONBOARDING',
        },
      });

      return [approved, co, usr, proj];
    });

    return NextResponse.json({ ok: true, inquiry: updatedInquiry, company, user, project });
  } catch (err: unknown) {
    // Unique constraint on users.email — someone with this email already exists.
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { ok: false, error: 'A user with this email already exists.' },
        { status: 409 },
      );
    }

    console.error('[approve] unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
