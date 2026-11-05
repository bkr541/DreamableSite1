import { NextResponse } from 'next/server';
import { CSP_INLINE, contentDisposition, fileTypeFor, safeFileName } from './fileTypes';
import { SIGNED_URL_TTL_SECONDS, storage } from './storage';
import { WATERMARK_MAX_BYTES, applyWatermark, canWatermark } from './watermark';

// The one way a stored file leaves the server. Callers have ALREADY decided the viewer may have it
// (admin, owning client, or a live share token); this decides how it is delivered and keeps every route
// consistent: same type rules, same filename rules, same security headers.

export interface DeliverableFile {
  fileName: string;
  size: number;
  /** Legacy rows keep their bytes in the database. */
  data: Uint8Array | null;
  /** Newer rows live in private object storage. */
  storageKey: string | null;
  watermark?: boolean;
}

/** Headers for any file we serve ourselves. `nosniff` + a fixed content type mean the browser never guesses. */
export function fileHeaders(fileName: string, wantInline: boolean): Record<string, string> {
  const type = fileTypeFor(fileName);
  const inline = wantInline && !!type?.inline;
  const headers: Record<string, string> = {
    'Content-Type': inline ? type!.mime : 'application/octet-stream',
    'Content-Disposition': contentDisposition(inline ? 'inline' : 'attachment', fileName),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
  };
  // Nothing shown inline may run script (the built-in PDF viewer breaks under sandbox, so PDFs are exempt).
  if (inline && type!.kind !== 'pdf') headers['Content-Security-Policy'] = CSP_INLINE;
  return headers;
}

const CHUNK = 64 * 1024;
/** Sends bytes as a stream so large responses aren't subject to a buffered-response size cap. */
function streamBytes(data: Uint8Array): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= data.length) return controller.close();
      controller.enqueue(data.subarray(offset, offset + CHUNK));
      offset += CHUNK;
    },
  });
}

function bytesResponse(file: DeliverableFile, data: Uint8Array, wantInline: boolean, status = 200, extra: Record<string, string> = {}) {
  return new NextResponse(streamBytes(data), {
    status,
    headers: { ...fileHeaders(file.fileName, wantInline), 'Content-Length': String(data.length), ...extra },
  });
}

export async function deliverFile(file: DeliverableFile, opts: { inline: boolean; range?: string | null }): Promise<NextResponse> {
  try {
    return await deliver(file, opts);
  } catch (err) {
    // Transition safety net: if the stored copy can't be reached but the original bytes are still in the database, use them.
    if (file.data && file.storageKey) {
      console.error('[fileDelivery] storage read failed; serving the database copy:', err instanceof Error ? err.message : err);
      return bytesResponse(file, file.data, opts.inline && !!fileTypeFor(file.fileName)?.inline);
    }
    throw err;
  }
}

async function deliver(file: DeliverableFile, opts: { inline: boolean; range?: string | null }): Promise<NextResponse> {
  const type = fileTypeFor(file.fileName);
  const wantInline = opts.inline && !!type?.inline;

  // 1. Watermarked: the overlay is applied per request and the clean original is never sent.
  if (file.watermark && canWatermark(file.fileName)) {
    if (file.size > WATERMARK_MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'This file is too large to watermark.' }, { status: 413 });
    }
    const source = file.data ?? (file.storageKey ? await storage().read(file.storageKey, WATERMARK_MAX_BYTES) : null);
    if (!source) return NextResponse.json({ ok: false, error: 'File not found.' }, { status: 404 });
    const marked = await applyWatermark(file.fileName, source);
    return bytesResponse(file, marked, wantInline);
  }

  // 2. Dual read during the migration: a file that has a verified stored copy is served from storage; one that
  //    doesn't (or whose copy can't be reached while the database copy still exists) is served from the database.
  if (file.data && !file.storageKey) return bytesResponse(file, file.data, wantInline);

  if (!file.storageKey) return NextResponse.json({ ok: false, error: 'File not found.' }, { status: 404 });

  // 3. Previews are streamed through here so our headers (type, nosniff, sandbox) always apply. Range requests
  //    are forwarded so video can seek.
  if (wantInline) {
    const url = await storage().signedUrl(file.storageKey, { expiresIn: SIGNED_URL_TTL_SECONDS });
    const upstream = await fetch(url, { headers: opts.range ? { Range: opts.range } : {}, cache: 'no-store', signal: AbortSignal.timeout(60_000) });
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ ok: false, error: 'File not found.' }, { status: upstream.status === 416 ? 416 : 404 });
    }
    const headers = fileHeaders(file.fileName, true);
    for (const h of ['content-length', 'content-range', 'accept-ranges']) {
      const v = upstream.headers.get(h);
      if (v) headers[h] = v;
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  }

  // 4. Downloads go straight from storage on a signed link that expires in seconds, so the file never passes
  //    through (or is limited by) this server.
  const url = await storage().signedUrl(file.storageKey, { expiresIn: SIGNED_URL_TTL_SECONDS, downloadName: safeFileName(file.fileName) });
  return new NextResponse(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
}
