import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { removeObjects } from '@/lib/storage';
import { recordAudit } from '@/lib/audit';
import { normalizeExternalLink } from '@/lib/externalLink';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sets or clears a project's external download link (Dropbox, Google Drive, …).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: 'Project not found.' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (!('externalLink' in body)) return NextResponse.json({ ok: false, error: 'Nothing to change.' }, { status: 400 });
  const link = normalizeExternalLink(body.externalLink);
  if (!link.ok) return NextResponse.json({ ok: false, field: 'externalLink', error: link.error }, { status: 422 });

  try {
    const before = await prisma.project.findUnique({ where: { id }, select: { externalLink: true } });
    if (!before) return NextResponse.json({ ok: false, error: 'Project not found.' }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id }, data: { externalLink: link.value } });
      await recordAudit(tx, { actorId: auth.user.id, action: 'project.update_external_link', targetType: 'project', targetId: id, metadata: { from: before.externalLink, to: link.value } });
    });
    return NextResponse.json({ ok: true, externalLink: link.value });
  } catch (err) {
    console.error('[admin/projects PATCH]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const files = await prisma.deliverable.findMany({
      where: { OR: [{ projectId: id }, { folder: { projectId: id } }] },
      select: { storageKey: true },
    });
    await prisma.project.delete({ where: { id } });
    await removeObjects(files.map((f) => f.storageKey));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/projects DELETE]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
