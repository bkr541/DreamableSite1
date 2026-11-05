import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { DELIVERABLE_MAX_BYTES } from '@/lib/deliverables';
import { removeObjects } from '@/lib/storage';
import { finalizeUpload } from '@/lib/uploadFlow';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Step 3 of a direct upload: verify the stored bytes, then (and only then) make the file visible.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: 'File not found.' }, { status: 404 });

  try {
    const row = await prisma.deliverable.findUnique({
      where: { id },
      select: { id: true, status: true, storageKey: true, fileName: true, size: true, contentType: true },
    });
    if (!row || !row.storageKey) return NextResponse.json({ ok: false, error: 'File not found.' }, { status: 404 });
    if (row.status === 'READY') return NextResponse.json({ ok: true }); // a retried request

    const result = await finalizeUpload({
      key: row.storageKey, fileName: row.fileName, declaredSize: row.size, declaredType: row.contentType, maxBytes: DELIVERABLE_MAX_BYTES,
    });

    if (!result.ok) {
      // Rejected or incomplete: nothing may remain — not the row, not the object.
      await removeObjects([row.storageKey]);
      await prisma.deliverable.deleteMany({ where: { id, status: 'PENDING' } });
      return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
    }

    // Conditional on PENDING so a sweep that raced us can't resurrect a row whose object was removed.
    const { count } = await prisma.deliverable.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'READY', size: result.size, sha256: result.sha256, contentType: result.contentType },
    });
    if (count !== 1) return NextResponse.json({ ok: false, error: 'This upload expired. Please try again.' }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/deliverables complete]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
