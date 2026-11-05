import { randomUUID } from 'crypto';

// Private object storage for file bytes (Supabase Storage). PostgreSQL keeps ownership, metadata and
// lifecycle state; the bytes live in a private bucket and are only ever reached through short-lived signed
// URLs that this server hands out after checking permissions. Nothing here makes a bucket public.

export interface StorageProvider {
  /** A one-time, path-scoped URL the browser may PUT the file bytes to. */
  createUpload(key: string): Promise<{ url: string }>;
  /** Size in bytes, or null when the object doesn't exist. */
  stat(key: string): Promise<{ size: number } | null>;
  /** The full object. Rejects if it is larger than maxBytes. */
  read(key: string, maxBytes: number): Promise<Buffer>;
  /** A short-lived GET URL. `downloadName` makes the storage service send it as an attachment. */
  signedUrl(key: string, opts: { expiresIn: number; downloadName?: string }): Promise<string>;
  remove(keys: string[]): Promise<void>;
}

export const SIGNED_URL_TTL_SECONDS = 30;
export const UPLOAD_GRANT_NOTE = 'Upload URLs are valid for about 2 hours, scoped to a single object path.';

const env = () => ({
  url: process.env.SUPABASE_URL?.replace(/\/+$/, ''),
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.STORAGE_BUCKET || 'dreamable-files',
});

export const storageConfigured = () => {
  const e = env();
  return !!(e.url && e.key);
};

/** Random, opaque object keys — never derived from user-supplied names, so nothing can escape a prefix. */
export const newObjectKey = (prefix: 'deliverables' | 'inquiries') => {
  const id = randomUUID();
  return { id, key: `${prefix}/${id}` };
};

const enc = (key: string) => key.split('/').map(encodeURIComponent).join('/');

class SupabaseStorage implements StorageProvider {
  private get cfg() {
    const { url, key, bucket } = env();
    if (!url || !key) throw new Error('File storage is not configured.');
    return { base: `${url}/storage/v1`, key, bucket };
  }
  private headers(extra: Record<string, string> = {}) {
    const { key } = this.cfg;
    return { Authorization: `Bearer ${key}`, apikey: key, ...extra };
  }
  private async call(url: string, init: RequestInit = {}, ms = 25_000) {
    return fetch(url, { ...init, signal: AbortSignal.timeout(ms), cache: 'no-store' });
  }

  async createUpload(key: string) {
    const { base, bucket } = this.cfg;
    const res = await this.call(`${base}/object/upload/sign/${bucket}/${enc(key)}`, { method: 'POST', headers: this.headers({ 'x-upsert': 'false' }) });
    if (!res.ok) throw new Error(`storage upload grant failed (${res.status})`);
    const { url } = (await res.json()) as { url?: string };
    if (!url) throw new Error('storage upload grant missing url');
    return { url: url.startsWith('http') ? url : `${base}${url}` };
  }

  async stat(key: string) {
    const { base, bucket } = this.cfg;
    const res = await this.call(`${base}/object/${bucket}/${enc(key)}`, { method: 'HEAD', headers: this.headers() });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`storage stat failed (${res.status})`);
    return { size: Number(res.headers.get('content-length') ?? 0) };
  }

  async read(key: string, maxBytes: number) {
    const { base, bucket } = this.cfg;
    const res = await this.call(`${base}/object/${bucket}/${enc(key)}`, { headers: this.headers() }, 60_000);
    if (!res.ok || !res.body) throw new Error(`storage read failed (${res.status})`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new Error('stored object is larger than allowed');
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      total += chunk.length;
      if (total > maxBytes) throw new Error('stored object is larger than allowed');
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async signedUrl(key: string, opts: { expiresIn: number; downloadName?: string }) {
    const { base, bucket } = this.cfg;
    const res = await this.call(`${base}/object/sign/${bucket}/${enc(key)}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: opts.expiresIn }),
    });
    if (!res.ok) throw new Error(`storage sign failed (${res.status})`);
    const { signedURL } = (await res.json()) as { signedURL?: string };
    if (!signedURL) throw new Error('storage sign missing url');
    const url = signedURL.startsWith('http') ? signedURL : `${base}${signedURL}`;
    return opts.downloadName ? `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(opts.downloadName)}` : url;
  }

  async remove(keys: string[]) {
    if (keys.length === 0) return;
    const { base, bucket } = this.cfg;
    const res = await this.call(`${base}/object/${bucket}`, {
      method: 'DELETE',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: keys }),
    });
    if (!res.ok) throw new Error(`storage remove failed (${res.status})`);
  }
}

let provider: StorageProvider = new SupabaseStorage();
export const storage = () => provider;
/** Tests substitute an in-memory provider. */
export function setStorageProvider(p: StorageProvider) { provider = p; }

/** Best-effort object cleanup. A failure is logged with the keys so an operator can remove them by hand; it never blocks the caller. */
export async function removeObjects(keys: (string | null | undefined)[]): Promise<void> {
  const list = keys.filter((k): k is string => !!k);
  if (list.length === 0 || !storageConfigured()) return;
  try {
    await provider.remove(list);
  } catch (err) {
    console.error('[storage] could not remove objects; remove them manually:', list.join(','), err instanceof Error ? err.message : err);
  }
}
