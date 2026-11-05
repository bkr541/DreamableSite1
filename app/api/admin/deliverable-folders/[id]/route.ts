import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const { name, description, isPublic } = await req.json();
    const data: { name?: string; description?: string | null; isPublic?: boolean } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) return fail('Folder name is required.');
      if (name.trim().length > 120) return fail('Folder name must be 120 characters or fewer.');
      data.name = name.trim();
    }
    if (description !== undefined) {
      data.description = typeof description === 'string' && description.trim() ? description.trim().slice(0, 1000) : null;
    }
    if (isPublic !== undefined) data.isPublic = isPublic === true;

    await prisma.deliverableFolder.update({ where: { id }, data });
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
    await prisma.deliverableFolder.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2025') {
      return fail('Folder not found.', 404);
    }
    console.error('[admin/deliverable-folders DELETE]', err);
    return fail('Internal server error.', 500);
  }
}
