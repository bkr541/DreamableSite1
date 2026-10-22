import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import {
  getDeliverableCategories,
  DELIVERABLE_MAX_BYTES,
  DELIVERABLE_MAX_FILES,
} from '@/lib/deliverables';
import { UPLOAD_EXT } from '@/lib/serveFile';

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session?.admin) return fail('Unauthorized.', 401);

  try {
    const form = await req.formData();
    const targetType = String(form.get('targetType') ?? '');
    const targetId = String(form.get('targetId') ?? '');
    const category = String(form.get('category') ?? '');
    const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);

    if (targetType !== 'inquiry' && targetType !== 'project') return fail('Invalid target.', 400);
    if (!targetId) return fail('Invalid target.', 400);
    if (files.length === 0) return fail('Choose at least one file.', 400);
    if (files.length > DELIVERABLE_MAX_FILES) return fail(`Upload up to ${DELIVERABLE_MAX_FILES} files at a time.`, 400);

    const target =
      targetType === 'inquiry'
        ? await prisma.inquiry.findUnique({ where: { id: targetId }, select: { service: true } })
        : await prisma.project.findUnique({ where: { id: targetId }, select: { service: true } });
    if (!target) return fail('Target not found.', 404);

    if (!getDeliverableCategories(target.service).includes(category)) return fail('Invalid category.', 400);

    for (const f of files) {
      if (f.size > DELIVERABLE_MAX_BYTES) return fail(`${f.name} is larger than 25 MB.`, 400);
      if (!UPLOAD_EXT.test(f.name)) return fail(`${f.name} is not a supported file type.`, 400);
    }

    const rows = await Promise.all(
      files.map(async (f) => ({
        [targetType === 'inquiry' ? 'inquiryId' : 'projectId']: targetId,
        category,
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
