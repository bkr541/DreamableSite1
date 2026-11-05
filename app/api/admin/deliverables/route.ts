import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { DELIVERABLE_MAX_BYTES, DELIVERABLE_MAX_FILES } from '@/lib/deliverables';
import { UPLOAD_EXT } from '@/lib/serveFile';
import { canWatermark } from '@/lib/watermark';

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// Uploads files into an existing folder. A folder is required; files can't be added loose.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const form = await req.formData();
    const folderId = String(form.get('folderId') ?? '');
    // One flag per file, in the same order as `files`.
    const watermarks: unknown = JSON.parse(String(form.get('watermarks') ?? '[]'));
    const descriptions: unknown = JSON.parse(String(form.get('descriptions') ?? '[]'));
    const titles: unknown = JSON.parse(String(form.get('titles') ?? '[]'));
    const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);

    if (!folderId) return fail('Create or choose a folder first.', 400);
    if (files.length === 0) return fail('Choose at least one file.', 400);
    if (files.length > DELIVERABLE_MAX_FILES) return fail(`Upload up to ${DELIVERABLE_MAX_FILES} files at a time.`, 400);

    const folder = await prisma.deliverableFolder.findUnique({
      where: { id: folderId },
      select: { id: true, inquiryId: true, projectId: true },
    });
    if (!folder) return fail('Folder not found.', 404);

    for (const f of files) {
      if (f.size > DELIVERABLE_MAX_BYTES) return fail(`${f.name} is larger than 25 MB.`, 400);
      if (!UPLOAD_EXT.test(f.name)) return fail(`${f.name} is not a supported file type.`, 400);
    }

    const rows = await Promise.all(
      files.map(async (f, i) => ({
        folderId: folder.id,
        // Kept on the file too, so client-portal access checks don't need to look the folder up.
        inquiryId: folder.inquiryId,
        projectId: folder.projectId,
        watermark: Array.isArray(watermarks) && watermarks[i] === true && canWatermark(f.name),
        // The title is the artifact's display name; it defaults to the file name.
        title: (Array.isArray(titles) && typeof titles[i] === 'string' ? titles[i].trim().slice(0, 200) : '') || f.name,
        description:
          (Array.isArray(descriptions) && typeof descriptions[i] === 'string' ? descriptions[i].trim().slice(0, 500) : '') || null,
        fileName: f.name,
        contentType: f.type || 'application/octet-stream',
        size: f.size,
        data: new Uint8Array(await f.arrayBuffer()),
      })),
    );
    await prisma.deliverable.createMany({ data: rows });

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (err) {
    console.error('[admin/deliverables POST]', err);
    return fail('Internal server error.', 500);
  }
}
