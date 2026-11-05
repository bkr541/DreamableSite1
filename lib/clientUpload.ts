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
