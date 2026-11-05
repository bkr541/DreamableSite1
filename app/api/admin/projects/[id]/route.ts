import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { removeObjects } from '@/lib/storage';

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
