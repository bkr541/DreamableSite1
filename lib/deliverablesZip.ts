import { Zip, ZipPassThrough } from 'fflate';
import { safeFileName } from '@/lib/fileTypes';
import { deliverFile, type DeliverableFile } from '@/lib/fileDelivery';

interface ArchiveFolder {
  id: string;
  name: string;
  deliverables: { id: string; fileName: string; size: number }[];
}
export interface ArchiveEntry { path: string; size: number; fileId?: string; folderId?: string }

/** Avoid case-insensitive collisions on clients' Windows and Mac filesystems. */
function names() {
  const used = new Set<string>();
  return (raw: string, file = false) => {
    const clean = safeFileName(raw).normalize('NFC');
    const dot = file ? clean.lastIndexOf('.') : -1;
    const stem = dot > 0 ? clean.slice(0, dot) : clean;
    const extension = dot > 0 ? clean.slice(dot) : '';
    let result = clean;
    for (let n = 2; used.has(result.toLowerCase()); n++) result = `${stem} (${n})${extension}`;
    used.add(result.toLowerCase());
    return result;
  };
}

export function archiveEntries(folders: ArchiveFolder[], flat = false): ArchiveEntry[] {
  const folderName = names();
  const entries: ArchiveEntry[] = [];
  for (const folder of folders) {
    const prefix = flat ? '' : `${folderName(folder.name)}/`;
    if (prefix) entries.push({ path: prefix, size: 0 }); // Preserve empty folders too.
    const fileName = names();
    for (const file of folder.deliverables) {
      entries.push({ path: prefix + fileName(file.fileName, true), size: file.size, fileId: file.id, folderId: folder.id });
    }
  }
  return entries;
}

/** ZIP32 has finite entry and size fields. Reject an oversized manifest before starting the response. */
export function archiveFits(entries: ArchiveEntry[]) {
  return entries.length <= 65_535 && entries.reduce((sum, entry) => sum + entry.size + 512 + Buffer.byteLength(entry.path) * 4, 22) < 0xffffffff;
}

/** The archive uses the same watermark rules as individual downloads. */
export async function archiveFileResponse(file: DeliverableFile, signal: AbortSignal): Promise<Response> {
  // Prefer an existing database copy, so a watermark failure cannot fall back to the clean original.
  let response: Response = await deliverFile(file.data ? { ...file, storageKey: null } : file, { inline: false });
  if (response.status === 302) {
    const location = response.headers.get('location');
    if (!location) throw new Error('The artifact download link is missing.');
    response = await fetch(location, { cache: 'no-store', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]) });
  }
  if (!response.ok || !response.body) throw new Error('An artifact could not be downloaded. Please retry the ZIP download.');
  return response;
}

/** Pull-driven ZIP output: only the current source chunk is buffered, never the complete archive. */
export function streamArchive(
  entries: ArchiveEntry[],
  source: (entry: ArchiveEntry, signal: AbortSignal) => Promise<Response>,
  requestSignal?: AbortSignal,
): ReadableStream<Uint8Array> {
  const abort = new AbortController();
  const onAbort = () => abort.abort(requestSignal?.reason);
  if (requestSignal?.aborted) onAbort();
  else requestSignal?.addEventListener('abort', onAbort, { once: true });
  const cleanup = () => requestSignal?.removeEventListener('abort', onAbort);

  async function* chunks() {
    const pending: Uint8Array[] = [];
    let failure: Error | null = null;
    let emitted = 0;
    const zip = new Zip((error, chunk) => {
      if (error) { failure = error; return; }
      emitted += chunk.byteLength;
      if (emitted >= 0xffffffff) { failure = new Error('The ZIP is too large. Download folders separately.'); return; }
      pending.push(chunk);
    });
    function* output() {
      if (failure) throw failure;
      while (pending.length) yield pending.shift()!;
    }
    try {
      for (const entry of entries) {
        abort.signal.throwIfAborted();
        const member = new ZipPassThrough(entry.path);
        zip.add(member);
        yield* output();
        if (entry.fileId) {
          const response = await source(entry, abort.signal);
          if (!response.ok || !response.body) throw new Error('An artifact could not be downloaded.');
          const reader = response.body.getReader();
          let finished = false;
          try {
            while (true) {
              abort.signal.throwIfAborted();
              const { done, value } = await reader.read();
              if (done) { finished = true; break; }
              member.push(value, false);
              yield* output();
            }
          } finally {
            if (!finished) await reader.cancel().catch(() => {});
            reader.releaseLock();
          }
        }
        member.push(new Uint8Array(), true);
        yield* output();
      }
      zip.end();
      yield* output();
    } finally { zip.terminate(); cleanup(); }
  }

  const iterator = chunks();
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error) { controller.error(error); }
    },
    async cancel(reason) {
      abort.abort(reason);
      cleanup();
      await iterator.return(undefined);
    },
  });
}
