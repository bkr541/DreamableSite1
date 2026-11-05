import { prisma } from './prisma';
import { validateUpload } from './fileValidation';
import { removeObjects, storage } from './storage';

// Direct-to-storage uploads happen in three steps, so nothing is shown or served until the bytes are verified:
//   1. init     – the server records a PENDING file and hands the browser a one-object upload URL
//   2. upload   – the browser PUTs the bytes straight to storage (never through a serverless function)
//   3. complete – the server checks the object exists, is the declared size and is really the declared type,
//                 records its SHA-256, and only then marks the file READY
// A step that fails or is abandoned leaves a PENDING row and an object that the sweeper removes.

export const PENDING_MAX_AGE_MS = 60 * 60 * 1000;

export type Finalized =
  | { ok: true; size: number; sha256: string; contentType: string }
  | { ok: false; error: string };

export async function finalizeUpload(file: {
  key: string; fileName: string; declaredSize: number; declaredType: string; maxBytes: number;
}): Promise<Finalized> {
  try {
    const stat = await storage().stat(file.key);
    if (!stat) return { ok: false, error: `${file.fileName} didn't finish uploading. Please try again.` };
    if (stat.size > file.maxBytes) return { ok: false, error: `${file.fileName} is larger than the allowed size.` };
    if (stat.size !== file.declaredSize) return { ok: false, error: `${file.fileName} didn't upload completely. Please try again.` };

    const bytes = await storage().read(file.key, file.maxBytes);
    if (bytes.length !== file.declaredSize) return { ok: false, error: `${file.fileName} didn't upload completely. Please try again.` };

    const v = await validateUpload({ fileName: file.fileName, declaredType: file.declaredType, bytes });
    if (!v.ok) return { ok: false, error: v.error };
    return { ok: true, size: bytes.length, sha256: v.sha256, contentType: v.contentType };
  } catch (err) {
    console.error('[uploadFlow] could not verify upload', file.key, err instanceof Error ? err.message : err);
    return { ok: false, error: `${file.fileName} could not be verified. Please try again.` };
  }
}

/** Removes uploads that were started but never completed (closed tab, failed PUT, rejected file). */
export async function sweepAbandonedUploads(olderThanMs = PENDING_MAX_AGE_MS, limit = 200): Promise<{ deliverables: number; attachments: number }> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const [d, a] = await Promise.all([
    prisma.deliverable.findMany({ where: { status: 'PENDING', createdAt: { lt: cutoff } }, select: { id: true, storageKey: true }, take: limit }),
    prisma.inquiryAttachment.findMany({ where: { status: 'PENDING', createdAt: { lt: cutoff } }, select: { id: true, storageKey: true }, take: limit }),
  ]);
  await removeObjects([...d.map((x) => x.storageKey), ...a.map((x) => x.storageKey)]);
  // Rows go only after the objects were asked to be removed; a re-check on status guards against a late completion.
  if (d.length) await prisma.deliverable.deleteMany({ where: { id: { in: d.map((x) => x.id) }, status: 'PENDING' } });
  if (a.length) await prisma.inquiryAttachment.deleteMany({ where: { id: { in: a.map((x) => x.id) }, status: 'PENDING' } });
  return { deliverables: d.length, attachments: a.length };
}

/** Fire-and-forget sweep, run occasionally from busy paths. The daily cron is the guarantee. */
export function maybeSweep() {
  if (Math.random() < 0.1) sweepAbandonedUploads().catch((e) => console.error('[uploadFlow] sweep failed', e));
}

export const INQUIRY_UPLOAD_MAX_FILES = 5;
export const INQUIRY_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export type Claimed =
  | { ok: true; files: { id: string; fileName: string; size: number; sha256: string; contentType: string }[] }
  | { ok: false; error: string };

/**
 * Verifies the files a visitor uploaded for an inquiry they are submitting. Every file must exist, be the
 * declared size and really be the declared type; if any fails, all of them are removed and nothing is attached.
 */
export async function verifyInquiryUploads(ids: string[]): Promise<Claimed> {
  const rows = await prisma.inquiryAttachment.findMany({
    where: { id: { in: ids }, status: 'PENDING', inquiryId: null, createdAt: { gt: new Date(Date.now() - PENDING_MAX_AGE_MS) } },
    select: { id: true, storageKey: true, fileName: true, size: true, contentType: true },
  });
  if (rows.length !== new Set(ids).size) return { ok: false, error: 'One of your attachments expired. Please attach it again.' };

  const results = await Promise.all(
    rows.map(async (r) => ({
      r,
      f: await finalizeUpload({ key: r.storageKey!, fileName: r.fileName, declaredSize: r.size, declaredType: r.contentType, maxBytes: INQUIRY_UPLOAD_MAX_BYTES }),
    })),
  );
  const bad = results.find((x) => !x.f.ok);
  if (bad) {
    await removeObjects(rows.map((r) => r.storageKey));
    await prisma.inquiryAttachment.deleteMany({ where: { id: { in: rows.map((r) => r.id) }, status: 'PENDING' } });
    return { ok: false, error: (bad.f as { error: string }).error };
  }
  return {
    ok: true,
    files: results.map(({ r, f }) => {
      const ok = f as Extract<Finalized, { ok: true }>;
      return { id: r.id, fileName: r.fileName, size: ok.size, sha256: ok.sha256, contentType: ok.contentType };
    }),
  };
}
