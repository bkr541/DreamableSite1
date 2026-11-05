import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { canWatermark } from '@/lib/watermark';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    await prisma.deliverable.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/deliverables DELETE]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const { title, description, watermark } = await req.json();
    const data: { title?: string; description?: string | null; watermark?: boolean } = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return NextResponse.json({ ok: false, error: 'Title is required.' }, { status: 400 });
      }
      data.title = title.trim().slice(0, 200);
    }
    if (description !== undefined) {
      data.description = typeof description === 'string' && description.trim() ? description.trim().slice(0, 500) : null;
    }
    if (watermark !== undefined) {
      if (watermark === true) {
        const file = await prisma.deliverable.findUnique({ where: { id }, select: { fileName: true } });
        if (!file) return NextResponse.json({ ok: false, error: 'File not found.' }, { status: 404 });
        if (!canWatermark(file.fileName)) {
          return NextResponse.json({ ok: false, error: 'A watermark can only be added to images and PDFs.' }, { status: 400 });
        }
      }
      data.watermark = watermark === true;
    }

    await prisma.deliverable.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2025') {
      return NextResponse.json({ ok: false, error: 'File not found.' }, { status: 404 });
    }
    console.error('[admin/deliverables PATCH]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
