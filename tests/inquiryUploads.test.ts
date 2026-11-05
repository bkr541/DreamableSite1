import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePg } from './pg';
import { setSecrets } from './helpers';
import { FakeStorage, table } from './fakes';
import * as f from './files';

const h = vi.hoisted(() => ({ db: {} as any, mails: [] as any[], pending: [] as Promise<unknown>[] }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: async (m: unknown) => { h.mails.push(m); } }) } }));
vi.mock('next/server', async (orig) => {
  const m = await orig<typeof import('next/server')>();
  return { ...m, after: (fn: () => Promise<void>) => { h.pending.push(fn()); } };
});

import { setStorageProvider } from '@/lib/storage';

let pg: Awaited<ReturnType<typeof makePg>>;
let storage: FakeStorage;

async function process_() {
  vi.resetModules();
  (await import('@/lib/rateLimit')).setRateLimitStore(pg.instance());
  (await import('@/lib/storage')).setStorageProvider(storage);
  return {
    uploads: (await import('@/app/api/inquiries/uploads/route')).POST,
    inquiries: (await import('@/app/api/inquiries/route')).POST,
  };
}
const json = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }) as never;

beforeEach(async () => {
  setSecrets();
  pg = await makePg();
  storage = new FakeStorage();
  setStorageProvider(storage);
  Object.assign(process.env, {
    SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(40), DATABASE_URL: 'postgres://x',
    SMTP_HOST: 's', SMTP_USER: 'u', SMTP_PASS: 'p', INQUIRY_TO_EMAIL: 'studio@example.com',
  });
  delete process.env.VERCEL; delete process.env.TRUSTED_PROXY;
  h.mails.length = 0;
  const attachments = table([], { defaults: () => ({ status: 'READY', createdAt: new Date(), storageKey: null, data: null, inquiryId: null }) });
  const inquiries = table();
  h.db = {
    inquiryAttachment: attachments,
    inquiry: inquiries,
    $transaction: async (fn: any) => fn({
      inquiry: { create: async ({ data }: any) => { const r = { id: 'inq-1', ...data }; inquiries.rows.push(r); return r; } },
      inquiryAttachment: attachments,
    }),
  };
});

const grant = async (POST: any, files: object[], headers = {}) => POST(json('/api/inquiries/uploads', { files }, headers));
const pendingRows = () => h.db.inquiryAttachment.rows;
const png = async () => f.png();

describe('public attachment uploads: init', () => {
  it('needs no login, records PENDING (unowned) files and returns one-object upload URLs', async () => {
    const { uploads } = await process_();
    const res = await grant(uploads, [{ name: 'brief.pdf', size: 1000, contentType: 'application/pdf' }]);
    const body = await res.json();
    expect(body.mode).toBe('direct');
    expect(body.files[0].uploadUrl).toContain('inquiries/');
    expect(pendingRows()[0]).toMatchObject({ status: 'PENDING', inquiryId: null, fileName: 'brief.pdf' });
  });
  it('enforces the form’s limits server-side: 5 files, 10 MB, allowed types', async () => {
    const { uploads } = await process_();
    expect((await grant(uploads, Array.from({ length: 6 }, (_, i) => ({ name: `a${i}.png`, size: 5 })))).status).toBe(400);
    expect((await grant(uploads, [{ name: 'big.pdf', size: 11 * 1024 * 1024 }])).status).toBe(400);
    expect((await grant(uploads, [{ name: 'run.exe', size: 5 }])).status).toBe(400);
    expect((await grant(uploads, [{ name: 'deck.zip', size: 5 }])).status).toBe(400); // zips are for deliveries, not strangers
    expect(pendingRows()).toHaveLength(0);
  });
  it('is rate limited per source, across separate processes', async () => {
    const a = await process_();
    for (let i = 0; i < 4; i++) expect((await grant(a.uploads, [{ name: 'a.png', size: 5 }])).status).toBe(200);
    const b = await process_(); // a different instance, same database
    const res = await grant(b.uploads, [{ name: 'a.png', size: 5 }]);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });
  it('caps how many unclaimed uploads can pile up', async () => {
    const { uploads } = await process_();
    for (let i = 0; i < 300; i++) pendingRows().push({ id: `p${i}`, status: 'PENDING' });
    expect((await grant(uploads, [{ name: 'a.png', size: 5 }])).status).toBe(503);
  });
  it('falls back to the form post when storage is not configured', async () => {
    delete process.env.SUPABASE_URL;
    const { uploads } = await process_();
    expect(await (await grant(uploads, [{ name: 'a.png', size: 5 }])).json()).toEqual({ ok: true, mode: 'legacy' });
  });
});

describe('submitting an inquiry with uploaded files', () => {
  const body = (uploadIds: string[], over = {}) => ({ name: 'Ada', email: 'ada@example.com', service: 'Branding', description: 'Please help', uploadIds, ...over });

  async function uploaded(P: any, name: string, bytes: Uint8Array) {
    const res = await grant(P.uploads, [{ name, size: bytes.length, contentType: '' }]);
    const { files } = await res.json();
    storage.put(pendingRows()[pendingRows().length - 1].storageKey, bytes);
    return files[0].id as string;
  }

  it('verified files are attached to the saved inquiry, and the email lists them instead of attaching bytes', async () => {
    const P = await process_();
    const id = await uploaded(P, 'logo.png', await png());
    const res = await P.inquiries(json('/api/inquiries', body([id])));
    expect(res.status).toBe(200);
    const row = pendingRows()[0];
    expect(row).toMatchObject({ status: 'READY', inquiryId: 'inq-1', contentType: 'image/png' });
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
    await Promise.all(h.pending.splice(0));
    const admin = h.mails.find((m) => m.to === 'studio@example.com');
    expect(admin.attachments).toEqual([]);
    expect(admin.html).toContain('logo.png');
  });

  it('a disguised file stops the whole submission: nothing is saved, the object is removed', async () => {
    const P = await process_();
    const good = await uploaded(P, 'ok.png', await png());
    const evil = await uploaded(P, 'photo.png', f.exe());
    const res = await P.inquiries(json('/api/inquiries', body([good, evil])));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/photo\.png/);
    expect(h.db.inquiry.rows).toHaveLength(0);
    expect(pendingRows()).toHaveLength(0);
    expect(storage.objects.size).toBe(0);
  });

  it('an unknown, expired or already-used upload id is refused', async () => {
    const P = await process_();
    expect((await P.inquiries(json('/api/inquiries', body(['11111111-1111-4111-8111-111111111111'])))).status).toBe(400);
    const id = await uploaded(P, 'a.png', await png());
    pendingRows()[0].createdAt = new Date(Date.now() - 2 * 3600_000);
    expect((await P.inquiries(json('/api/inquiries', body([id], { email: 'b@example.com', description: 'again' })))).status).toBe(400);
    expect(h.db.inquiry.rows).toHaveLength(0);
  });

  it('files already attached to one inquiry cannot be claimed by another', async () => {
    const P = await process_();
    const id = await uploaded(P, 'a.png', await png());
    expect((await P.inquiries(json('/api/inquiries', body([id])))).status).toBe(200);
    const again = await P.inquiries(json('/api/inquiries', body([id], { email: 'thief@example.com', description: 'steal' })));
    expect(again.status).toBe(400);
  });

  it('a file that never finished uploading is refused', async () => {
    const P = await process_();
    await grant(P.uploads, [{ name: 'a.png', size: 500 }]);
    const id = pendingRows()[0].id;
    expect((await P.inquiries(json('/api/inquiries', body([id])))).status).toBe(400);
    expect(h.db.inquiry.rows).toHaveLength(0);
  });
});
