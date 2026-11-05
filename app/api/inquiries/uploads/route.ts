import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/clientIp';
import { RULES, consume, tooManyRequests } from '@/lib/rateLimit';
import { INQUIRY_EXT, fileTypeFor, safeFileName } from '@/lib/fileTypes';
import { storage, storageConfigured } from '@/lib/storage';
import { INQUIRY_UPLOAD_MAX_BYTES, INQUIRY_UPLOAD_MAX_FILES, maybeSweep } from '@/lib/uploadFlow';

const MAX_PENDING_ROWS = 300; // global ceiling on unclaimed uploads, so storage can't be filled by a flood
const fail = (message: string, status: number) => NextResponse.json({ ok: false, message, error: message }, { status });

// Public. Step 1 of attaching files to an inquiry: returns one-object upload URLs so large files go straight
// to storage instead of through the form submission. The files stay invisible (PENDING) until the inquiry is
// submitted and each file's bytes are verified; unclaimed ones are swept after an hour.
export async function POST(req: NextRequest) {
  try {
    const limited = await consume(RULES.inquiryUploadIp, getClientIp(req.headers));
    if (!limited.allowed) return tooManyRequests(limited, 'upload requests');

    if (!storageConfigured()) return NextResponse.json({ ok: true, mode: 'legacy' });
    if (Number(req.headers.get('content-length') ?? 0) > 16 * 1024) return fail('That request is too large.', 413);

    const body = await req.json().catch(() => null);
    const files: unknown = body?.files;
    if (!Array.isArray(files) || files.length === 0) return fail('Choose at least one file.', 400);
    if (files.length > INQUIRY_UPLOAD_MAX_FILES) return fail(`You can attach up to ${INQUIRY_UPLOAD_MAX_FILES} files.`, 400);

    const planned = [];
    for (const f of files) {
      const name = typeof f?.name === 'string' ? safeFileName(f.name) : '';
      const size = Number(f?.size);
      if (!name || !INQUIRY_EXT.test(name) || !fileTypeFor(name)) return fail(`${name || 'That file'} is not a supported file type.`, 400);
      if (!Number.isInteger(size) || size <= 0) return fail(`${name} is empty.`, 400);
      if (size > INQUIRY_UPLOAD_MAX_BYTES) return fail(`${name} is larger than 10 MB.`, 400);
      const id = randomUUID();
      planned.push({ id, key: `inquiries/${id}`, name, size, declaredType: typeof f?.contentType === 'string' ? f.contentType.slice(0, 120) : '' });
    }

    if ((await prisma.inquiryAttachment.count({ where: { status: 'PENDING' } })) + planned.length > MAX_PENDING_ROWS) {
      return fail('Uploads are busy right now. Please try again in a few minutes.', 503);
    }

    const grants: string[] = [];
    try {
      for (const p of planned) grants.push((await storage().createUpload(p.key)).url);
    } catch (err) {
      console.error('[inquiries/uploads] grant failed', err instanceof Error ? err.message : err);
      return fail('File uploads are unavailable right now. Please try again.', 503);
    }

    await prisma.inquiryAttachment.createMany({
      data: planned.map((p) => ({
        id: p.id, inquiryId: null, fileName: p.name, size: p.size, storageKey: p.key, status: 'PENDING',
        contentType: p.declaredType || 'application/octet-stream',
      })),
    });
    maybeSweep();

    return NextResponse.json({
      ok: true,
      mode: 'direct',
      files: planned.map((p, i) => ({ id: p.id, uploadUrl: grants[i], contentType: p.declaredType || 'application/octet-stream' })),
    });
  } catch (err) {
    console.error('[inquiries/uploads POST]', err);
    return fail('Something went wrong. Please try again later.', 500);
  }
}
