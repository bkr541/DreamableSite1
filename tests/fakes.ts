import { randomUUID } from 'crypto';
import type { StorageProvider } from '@/lib/storage';

/** In-memory private bucket. Tests "upload" by calling put(); signed links carry an expiry so misuse can be checked. */
export class FakeStorage implements StorageProvider {
  objects = new Map<string, Buffer>();
  removed: string[] = [];
  failGrants = false;
  async createUpload(key: string) {
    if (this.failGrants) throw new Error('storage down');
    return { url: `https://storage.test/upload/${key}?token=t` };
  }
  put(key: string, bytes: Uint8Array) { this.objects.set(key, Buffer.from(bytes)); }
  async stat(key: string) { const o = this.objects.get(key); return o ? { size: o.length } : null; }
  async read(key: string, maxBytes: number) {
    const o = this.objects.get(key);
    if (!o) throw new Error('missing');
    if (o.length > maxBytes) throw new Error('too big');
    return o;
  }
  async signedUrl(key: string, opts: { expiresIn: number; downloadName?: string }) {
    return `https://storage.test/sign/${key}?exp=${opts.expiresIn}${opts.downloadName ? `&download=${encodeURIComponent(opts.downloadName)}` : ''}`;
  }
  async remove(keys: string[]) { for (const k of keys) { this.objects.delete(k); this.removed.push(k); } }
}

type Row = Record<string, any>;
interface Opts { defaults?: () => Row; nested?: (row: Row, key: string, value: any) => boolean }

/** A small stand-in for one Prisma model: enough where/update semantics for the flows under test. */
export function table(rows: Row[] = [], opts: Opts = {}) {
  const match = (r: Row, where: Row = {}): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (k === 'OR') return (v as Row[]).some((w) => match(r, w));
      if (k === 'AND') return (v as Row[]).every((w) => match(r, w));
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('in' in v) return v.in.includes(r[k]);
        if ('lt' in v) return r[k] < v.lt;
        if ('gt' in v) return r[k] > v.gt;
        if ('not' in v) return r[k] !== v.not;
        return opts.nested ? opts.nested(r, k, v) : true;
      }
      return (r[k] ?? null) === v;
    });
  const apply = (r: Row, data: Row) => { for (const [k, v] of Object.entries(data)) r[k] = v && typeof v === 'object' && 'increment' in (v as Row) ? r[k] + (v as Row).increment : v; };
  const t = {
    rows,
    findUnique: async ({ where }: Row) => rows.find((r) => match(r, where)) ?? null,
    findFirst: async ({ where }: Row = {}) => rows.find((r) => match(r, where)) ?? null,
    findMany: async ({ where, take }: Row = {}) => rows.filter((r) => match(r, where)).slice(0, take ?? 1e9),
    count: async ({ where }: Row = {}) => rows.filter((r) => match(r, where)).length,
    create: async ({ data }: Row) => { const r = { id: randomUUID(), ...(opts.defaults?.() ?? {}), ...data }; rows.push(r); return r; },
    createMany: async ({ data }: Row) => { for (const d of data as Row[]) rows.push({ id: randomUUID(), ...(opts.defaults?.() ?? {}), ...d }); return { count: (data as Row[]).length }; },
    update: async ({ where, data }: Row) => { const r = rows.find((x) => match(x, where)); if (!r) throw Object.assign(new Error('nf'), { code: 'P2025' }); apply(r, data); return r; },
    updateMany: async ({ where, data }: Row) => { const hit = rows.filter((r) => match(r, where)); hit.forEach((r) => apply(r, data)); return { count: hit.length }; },
    delete: async ({ where }: Row) => { const i = rows.findIndex((r) => match(r, where)); if (i < 0) throw Object.assign(new Error('nf'), { code: 'P2025' }); return rows.splice(i, 1)[0]; },
    deleteMany: async ({ where }: Row = {}) => { const keep = rows.filter((r) => !match(r, where)); const n = rows.length - keep.length; rows.length = 0; rows.push(...keep); return { count: n }; },
  };
  return t;
}
