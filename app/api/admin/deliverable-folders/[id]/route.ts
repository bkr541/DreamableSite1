import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { removeObjects } from '@/lib/storage';
import { recordAudit } from '@/lib/audit';
import { shareChange } from '@/lib/shareLinks';

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const { name, description, isPublic, commentsEnabled, commentsModerated } = await req.json();
    const data: { name?: string; description?: string | null; isPublic?: boolean; commentsEnabled?: boolean; commentsModerated?: boolean; shareToken?: string; shareRotatedAt?: Date } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) return fail('Folder name is required.');
      if (name.trim().length > 120) return fail('Folder name must be 120 characters or fewer.');
      data.name = name.trim();
    }
    if (description !== undefined) {
      data.description = typeof description === 'string' && description.trim() ? description.trim().slice(0, 1000) : null;
    }
    // Switching sharing off or on always replaces the link, so an old URL can never come back to life.
    let shareEvent: 'share_revoke' | 'share_enable' | null = null;
    if (isPublic !== undefined) {
      const current = await prisma.deliverableFolder.findUnique({ where: { id }, select: { isPublic: true } });
      if (!current) return fail('Folder not found.', 404);
      const next = isPublic === true;
      if (current.isPublic && !next) { Object.assign(data, shareChange('revoke')); shareEvent = 'share_revoke'; }
      else if (!current.isPublic && next) { Object.assign(data, shareChange('enable')); shareEvent = 'share_enable'; }
    }
    if (commentsEnabled !== undefined) data.commentsEnabled = commentsEnabled === true;
    if (commentsModerated !== undefined) data.commentsModerated = commentsModerated === true;

    await prisma.$transaction(async (tx) => {
      await tx.deliverableFolder.update({ where: { id }, data });
      if (shareEvent) await recordAudit(tx, { actorId: auth.user.id, action: `folder.${shareEvent}`, targetType: 'deliverable_folder', targetId: id });
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2025') {
      return fail('Folder not found.', 404);
    }
    console.error('[admin/deliverable-folders PATCH]', err);
    return fail('Internal server error.', 500);
  }
}

// Deleting a folder deletes its files too (cascade), and its share link stops working.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    // The database cascade removes the file rows; their stored objects must be removed explicitly.
    const files = await prisma.deliverable.findMany({ where: { folderId: id }, select: { storageKey: true } });
    await prisma.deliverableFolder.delete({ where: { id } });
    await removeObjects(files.map((f) => f.storageKey));
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2025') {
      return fail('Folder not found.', 404);
    }
    console.error('[admin/deliverable-folders DELETE]', err);
    return fail('Internal server error.', 500);
  }
}
