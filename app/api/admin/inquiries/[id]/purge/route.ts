import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { removeObjects } from '@/lib/storage';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status: number, extra: object = {}) => NextResponse.json({ ok: false, error, ...extra }, { status });

async function dependencies(id: string) {
  const [inquiry, folders, deliverables, attachments] = await Promise.all([
    prisma.inquiry.findUnique({
      where: { id },
      select: { archivedAt: true, companyRecord: { select: { id: true } }, user: { select: { id: true } }, project: { select: { id: true } } },
    }),
    prisma.deliverableFolder.count({ where: { inquiryId: id } }),
    prisma.deliverable.count({ where: { inquiryId: id } }),
    prisma.inquiryAttachment.count({ where: { inquiryId: id } }),
  ]);
  if (!inquiry) return null;
  const approved = !!(inquiry.companyRecord || inquiry.user || inquiry.project);
  const blockers: string[] = [];
  if (!inquiry.archivedAt) blockers.push('Archive the inquiry first.');
  if (approved) blockers.push('It has a client, company or project linked to it — those would lose their link to the original request. Archive it instead.');
  if (folders || deliverables) blockers.push('It has delivery folders or files, which belong to the client and are never deleted with a lead.');
  return { archived: !!inquiry.archivedAt, approved, folders, deliverables, attachments, blockers, allowed: blockers.length === 0 };
}

// Preview: what a permanent delete would remove, and whether it is allowed at all.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID.test(id)) return fail('Inquiry not found.', 404);
  const deps = await dependencies(id);
  return deps ? NextResponse.json({ ok: true, ...deps }) : fail('Inquiry not found.', 404);
}

// Permanent delete. Only for an ARCHIVED lead that never became a client and has no delivered work, and only
// with the inquiry's id typed back as confirmation. Recorded in the audit log.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID.test(id)) return fail('Inquiry not found.', 404);

  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== id) return fail('Type the inquiry id to confirm a permanent delete.', 400);

  try {
    const deps = await dependencies(id);
    if (!deps) return fail('Inquiry not found.', 404);
    if (!deps.allowed) return fail('This inquiry can’t be permanently deleted.', 409, { blockers: deps.blockers });

    const files = await prisma.inquiryAttachment.findMany({ where: { inquiryId: id }, select: { storageKey: true } });
    await prisma.$transaction(async (tx) => {
      await tx.inquiry.delete({ where: { id } }); // the database itself still refuses if any folder/file appeared meanwhile
      await recordAudit(tx, { actorId: auth.user.id, action: 'inquiry.purge', targetType: 'inquiry', targetId: id, metadata: { attachments: deps.attachments } });
    });
    await removeObjects(files.map((f) => f.storageKey));
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && ['P2003', 'P2014'].includes((err as { code: string }).code)) {
      return fail('This inquiry still has linked records and can’t be permanently deleted.', 409);
    }
    console.error('[admin/inquiries purge]', err);
    return fail('Internal server error.', 500);
  }
}
