import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { DELIVERABLE_MAX_BYTES, DELIVERABLE_MAX_FILES } from '@/lib/deliverables';
import { UPLOAD_EXT, fileTypeFor, safeFileName } from '@/lib/fileTypes';
import { canWatermark } from '@/lib/watermark';
import { storage, storageConfigured } from '@/lib/storage';
import { maybeSweep } from '@/lib/uploadFlow';

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// Step 1 of a direct upload: record the files as PENDING and return one-object upload URLs.
// With no object storage configured it answers { mode: 'legacy' } and the browser uses the old multipart route.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => null);
    const folderId = typeof body?.folderId === 'string' ? body.folderId : '';
    const files: unknown = body?.files;

    if (!storageConfigured()) return NextResponse.json({ ok: true, mode: 'legacy' });

    if (!folderId) return fail('Create or choose a folder first.', 400);
    if (!Array.isArray(files) || files.length === 0) return fail('Choose at least one file.', 400);
    if (files.length > DELIVERABLE_MAX_FILES) return fail(`Upload up to ${DELIVERABLE_MAX_FILES} files at a time.`, 400);

    const folder = await prisma.deliverableFolder.findUnique({ where: { id: folderId }, select: { id: true, inquiryId: true, projectId: true } });
    if (!folder) return fail('Folder not found.', 404);

    const planned = [];
    for (const f of files) {
      const name = typeof f?.name === 'string' ? safeFileName(f.name) : '';
      const size = Number(f?.size);
      if (!name || !UPLOAD_EXT.test(name) || !fileTypeFor(name)) return fail(`${name || 'That file'} is not a supported file type.`, 400);
      if (!Number.isInteger(size) || size <= 0) return fail(`${name} is empty.`, 400);
      if (size > DELIVERABLE_MAX_BYTES) return fail(`${name} is larger than 25 MB.`, 400);
      const id = randomUUID();
      planned.push({
        id, key: `deliverables/${id}`, name, size,
        declaredType: typeof f?.contentType === 'string' ? f.contentType.slice(0, 120) : '',
        title: (typeof f?.title === 'string' ? f.title.trim().slice(0, 200) : '') || name,
        description: (typeof f?.description === 'string' ? f.description.trim().slice(0, 500) : '') || null,
        watermark: f?.watermark === true && canWatermark(name),
      });
    }

    // Grants first: if storage refuses, nothing has been recorded yet.
    const grants: string[] = [];
    try {
      for (const p of planned) grants.push((await storage().createUpload(p.key)).url);
    } catch (err) {
      console.error('[admin/deliverables/uploads] grant failed', err instanceof Error ? err.message : err);
      return fail('File storage is unavailable right now. Please try again.', 503);
    }

    await prisma.deliverable.createMany({
      data: planned.map((p) => ({
        id: p.id, folderId: folder.id, inquiryId: folder.inquiryId, projectId: folder.projectId,
        title: p.title, description: p.description, watermark: p.watermark,
        fileName: p.name, contentType: p.declaredType || 'application/octet-stream', size: p.size,
        storageKey: p.key, status: 'PENDING',
      })),
    });
    maybeSweep();

    return NextResponse.json({
      ok: true,
      mode: 'direct',
      files: planned.map((p, i) => ({ id: p.id, uploadUrl: grants[i], contentType: p.declaredType || 'application/octet-stream' })),
    });
  } catch (err) {
    console.error('[admin/deliverables/uploads POST]', err);
    return fail('Internal server error.', 500);
  }
}

