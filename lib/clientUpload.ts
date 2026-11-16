// Browser-side helper for sending a file straight to object storage with real progress.
// (XMLHttpRequest, because fetch() cannot report upload progress.)

export function putFile(url: string, file: File, contentType: string, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? (onProgress(1), resolve()) : reject(new Error(xhr.status === 413 ? 'The file is larger than storage allows.' : `Upload was rejected (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error('Network problem while uploading. Check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('The upload timed out. Please try again.'));
    xhr.timeout = 15 * 60 * 1000;
    xhr.send(file);
  });
}

/** Runs `worker` over `count` items with at most `limit` in flight. */
export async function pool(count: number, limit: number, worker: (index: number) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, count) }, async () => {
      while (next < count) await worker(next++);
    }),
  );
}

/** Upload endpoints may receive plain-text or HTML errors from the host before our API runs. */
export async function readUploadResponse<T>(response: Response, fallback = 'Upload failed.'): Promise<T> {
  if (response.status === 413) {
    throw new Error('The server rejected this upload because it is too large. Larger files require direct file storage to be configured.');
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== 'object' || !('ok' in data) || data.ok !== true) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error : `${fallback} (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return data as T;
}

interface LegacyDeliverable {
  file: File;
  title: string;
  description: string;
  watermark: boolean;
}

/** Keep fallback requests small too: one file per request, with the same retry behaviour as direct uploads. */
export async function uploadLegacyDeliverables(
  folderId: string,
  items: LegacyDeliverable[],
  update: (index: number, state: { state: 'uploading' | 'failed'; progress?: number; failure?: string }) => void,
): Promise<Set<number>> {
  const done = new Set<number>();
  await pool(items.length, 3, async (i) => {
    const item = items[i];
    update(i, { state: 'uploading', progress: 0, failure: undefined });
    try {
      const body = new FormData();
      body.append('folderId', folderId);
      body.append('files', item.file);
      body.append('titles', JSON.stringify([item.title]));
      body.append('descriptions', JSON.stringify([item.description]));
      body.append('watermarks', JSON.stringify([item.watermark]));
      const response = await fetch('/api/admin/deliverables', { method: 'POST', body });
      const data = await readUploadResponse<{ count: number }>(response);
      if (data.count !== 1) throw new Error('The server did not confirm that the file was uploaded.');
      done.add(i);
    } catch (err) {
      update(i, { state: 'failed', failure: err instanceof Error ? err.message : 'Upload failed.' });
    }
  });
  return done;
}
