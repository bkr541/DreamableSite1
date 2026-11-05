import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, cookieFor, setSecrets } from './helpers';
import { FakeStorage, table } from './fakes';
import * as f from './files';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { setStorageProvider } from '@/lib/storage';
import { setRateLimitStore } from '@/lib/rateLimit';
import { NoopStore } from './pg';
import { POST as init } from '@/app/api/admin/deliverables/uploads/route';
import { POST as complete } from '@/app/api/admin/deliverables/[id]/complete/route';
import { DELETE as removeFile } from '@/app/api/admin/deliverables/[id]/route';
import { sweepAbandonedUploads } from '@/lib/uploadFlow';

let storage: FakeStorage;
const FOLDER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const call = (fn: any, body: unknown, cookie?: string, params: any = {}) =>
  fn(new NextRequest('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }) as never, { params: Promise.resolve(params) });
const admin = () => cookieFor({ userId: ADMIN_ID, admin: true });

beforeEach(() => {
  setSecrets();
  Object.assign(process.env, { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(40) });
  setRateLimitStore(new NoopStore());
  storage = new FakeStorage();
  setStorageProvider(storage);
  h.db = {
    user: table([
      { id: ADMIN_ID, name: 'A', email: 'a@x.co', admin: true, role: 'ADMIN', status: 'ACTIVE', sessionVersion: 0, inquiryId: null },
      { id: CLIENT_ID, name: 'C', email: 'c@x.co', admin: false, role: 'CLIENT', status: 'ACTIVE', sessionVersion: 0, inquiryId: null },
    ]),
    deliverableFolder: table([{ id: FOLDER, inquiryId: null, projectId: 'p1' }]),
    deliverable: table([], { defaults: () => ({ status: 'READY', createdAt: new Date(), storageKey: null, data: null }) }),
    adminNotification: table([], { unique: 'dedupeKey', defaults: () => ({ createdAt: new Date(), body: null }) }),
    inquiryAttachment: table([], { defaults: () => ({ status: 'READY', createdAt: new Date(), storageKey: null, data: null, inquiryId: null }) }),
  };
});

const plan = (over: Record<string, unknown> = {}) => ({ folderId: FOLDER, files: [{ name: 'logo.png', size: 100, contentType: 'image/png', title: 'Logo', ...over }] });

describe('admin direct upload: init', () => {
  it('rejects anonymous and customer callers without recording anything', async () => {
    expect((await call(init, plan())).status).toBe(401);
    expect((await call(init, plan(), cookieFor({ userId: CLIENT_ID, admin: false }))).status).toBe(403);
    expect(h.db.deliverable.rows).toHaveLength(0);
  });
  it('records PENDING files and returns one upload URL per file, scoped to an opaque key', async () => {
    const res = await call(init, plan(), admin());
    const body = await res.json();
    expect(body.mode).toBe('direct');
    expect(body.files).toHaveLength(1);
    const row = h.db.deliverable.rows[0];
    expect(row.status).toBe('PENDING');
    expect(row.storageKey).toBe(`deliverables/${row.id}`);
    expect(body.files[0].uploadUrl).toContain(row.storageKey);
    expect(row.storageKey).not.toContain('logo'); // never derived from the user's filename
  });
  it('enforces count, size and type limits before issuing anything', async () => {
    expect((await call(init, plan({ size: 26 * 1024 * 1024 }), admin())).status).toBe(400);
    expect((await call(init, plan({ name: 'run.exe' }), admin())).status).toBe(400);
    expect((await call(init, plan({ name: '../../x.png' }), admin())).status).toBe(200); // path parts are stripped, not trusted
    expect(h.db.deliverable.rows.at(-1).fileName).toBe('x.png');
    const eleven = { folderId: FOLDER, files: Array.from({ length: 11 }, (_, i) => ({ name: `f${i}.png`, size: 10 })) };
    expect((await call(init, eleven, admin())).status).toBe(400);
  });
  it('records nothing if storage refuses the upload grants', async () => {
    storage.failGrants = true;
    expect((await call(init, plan(), admin())).status).toBe(503);
    expect(h.db.deliverable.rows).toHaveLength(0);
  });
  it('reports legacy mode (browser uses the old route) when storage is not configured', async () => {
    delete process.env.SUPABASE_URL;
    expect(await (await call(init, plan(), admin())).json()).toEqual({ ok: true, mode: 'legacy' });
  });
});

describe('admin direct upload: complete', () => {
  async function started(bytes: Uint8Array, name = 'logo.png', declaredType = 'image/png') {
    const res = await call(init, { folderId: FOLDER, files: [{ name, size: bytes.length, contentType: declaredType, title: 'T' }] }, admin());
    const { files } = await res.json();
    const row = h.db.deliverable.rows.find((r: any) => r.id === files[0].id);
    return { id: files[0].id as string, key: row.storageKey as string };
  }

  it('verifies the stored bytes, records size + SHA-256 and only then makes the file visible', async () => {
    const png = await f.png();
    const { id, key } = await started(png);
    storage.put(key, png); // the browser's PUT
    expect(h.db.deliverable.rows[0].status).toBe('PENDING');
    h.db.deliverable.rows[0].folder = { id: FOLDER, name: 'Wordmark', inquiryId: null, projectId: 'p1' };
    const res = await call(complete, {}, admin(), { id });
    expect(res.status).toBe(200);
    // The upload is announced once, linking straight to the folder.
    expect(h.db.adminNotification.rows).toHaveLength(1);
    expect(h.db.adminNotification.rows[0]).toMatchObject({ type: 'deliverable.uploaded', url: `/admin?view=projects&project=p1&tab=deliverables&folder=${FOLDER}`, dedupeKey: `deliverable.uploaded:${id}` });
    const row = h.db.deliverable.rows[0];
    expect(row).toMatchObject({ status: 'READY', size: png.length, contentType: 'image/png' });
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await (await call(complete, {}, admin(), { id })).json()).toEqual({ ok: true }); // a retry is harmless
    expect(h.db.adminNotification.rows).toHaveLength(1);                                    // and doesn't repeat the notification
  });

  it('a disguised file is rejected and leaves neither a record nor an object', async () => {
    const evil = f.exe();
    const { id, key } = await started(evil, 'logo.png');
    storage.put(key, evil);
    const res = await call(complete, {}, admin(), { id });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/logo\.png/);
    expect(h.db.deliverable.rows).toHaveLength(0);
    expect(storage.objects.has(key)).toBe(false);
  });

  it('an upload that never arrived leaves no false success record', async () => {
    const { id } = await started(await f.png());
    const res = await call(complete, {}, admin(), { id });
    expect(res.status).toBe(422);
    expect(h.db.deliverable.rows).toHaveLength(0);
  });

  it('a file whose size differs from what was declared is refused and cleaned up', async () => {
    const png = await f.png();
    const { id, key } = await started(png);
    storage.put(key, Buffer.concat([png, Buffer.alloc(10)]));
    expect((await call(complete, {}, admin(), { id })).status).toBe(422);
    expect(storage.objects.has(key)).toBe(false);
    expect(h.db.deliverable.rows).toHaveLength(0);
  });

  it('a customer cannot complete (or probe) an upload', async () => {
    const { id } = await started(await f.png());
    expect((await call(complete, {}, cookieFor({ userId: CLIENT_ID, admin: false }), { id })).status).toBe(403);
    expect(h.db.deliverable.rows[0].status).toBe('PENDING');
  });
});

describe('cleanup', () => {
  it('aborting an upload (DELETE) removes the record and the stored bytes', async () => {
    const png = await f.png();
    const res = await call(init, { folderId: FOLDER, files: [{ name: 'a.png', size: png.length }] }, admin());
    const { files } = await res.json();
    const key = h.db.deliverable.rows[0].storageKey;
    storage.put(key, png);
    const del = await removeFile(new NextRequest('http://x', { method: 'DELETE', headers: { cookie: admin() } }) as never, { params: Promise.resolve({ id: files[0].id }) });
    expect(del.status).toBe(200);
    expect(h.db.deliverable.rows).toHaveLength(0);
    expect(storage.removed).toContain(key);
  });

  it('the sweeper removes stale PENDING uploads and their objects, and spares fresh and READY ones', async () => {
    const old = new Date(Date.now() - 3 * 3600_000);
    h.db.deliverable.rows.push(
      { id: 'old1', status: 'PENDING', createdAt: old, storageKey: 'deliverables/old1' },
      { id: 'fresh', status: 'PENDING', createdAt: new Date(), storageKey: 'deliverables/fresh' },
      { id: 'ready', status: 'READY', createdAt: old, storageKey: 'deliverables/ready' },
    );
    h.db.inquiryAttachment.rows.push({ id: 'oldA', status: 'PENDING', createdAt: old, storageKey: 'inquiries/oldA' });
    for (const k of ['deliverables/old1', 'deliverables/fresh', 'deliverables/ready', 'inquiries/oldA']) storage.put(k, Buffer.from('x'));

    const r = await sweepAbandonedUploads();
    expect(r).toEqual({ deliverables: 1, attachments: 1 });
    expect([...storage.objects.keys()].sort()).toEqual(['deliverables/fresh', 'deliverables/ready']);
    expect(h.db.deliverable.rows.map((x: any) => x.id).sort()).toEqual(['fresh', 'ready']);
  });
});
