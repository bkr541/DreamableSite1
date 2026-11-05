import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, cookieFor, setSecrets } from './helpers';
import { FakeStorage, table } from './fakes';
import * as f from './files';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { setStorageProvider } from '@/lib/storage';
import { GET as clientDownload } from '@/app/api/deliverables/[id]/route';
import { GET as shareDownload } from '@/app/api/share/[token]/files/[id]/route';
import { GET as adminAttachment } from '@/app/api/admin/inquiries/[id]/attachments/[attachmentId]/route';

const OTHER = '33333333-3333-4333-8333-333333333333';
let storage: FakeStorage;
let fetchSpy: ReturnType<typeof vi.fn>;

const get = (fn: any, url: string, params: any, cookie?: string, headers: Record<string, string> = {}) =>
  fn(new NextRequest(`http://localhost${url}`, { headers: { ...(cookie ? { cookie } : {}), ...headers } }) as never, { params: Promise.resolve(params) });
const client = (id = CLIENT_ID) => cookieFor({ userId: id, admin: false });

const file = (over: Record<string, any> = {}) => ({
  id: 'f1', status: 'READY', fileName: 'logo.png', size: 100, storageKey: 'deliverables/f1', data: null, watermark: false,
  inquiryId: null, projectId: 'p1', folderId: 'fo1', project: { primaryUserId: CLIENT_ID }, ...over,
});

beforeEach(() => {
  setSecrets();
  Object.assign(process.env, { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(40) });
  storage = new FakeStorage();
  setStorageProvider(storage);
  fetchSpy = vi.fn(async () => new Response('bytes', { status: 200, headers: { 'content-length': '5', 'content-type': 'text/html' } }));
  vi.stubGlobal('fetch', fetchSpy);
  const folders = [{ id: 'fo1', shareToken: 'tok_current_token_1', isPublic: true }];
  h.db = {
    user: table([
      { id: ADMIN_ID, name: 'A', email: 'a@x.co', admin: true, role: 'ADMIN', status: 'ACTIVE', sessionVersion: 0, inquiryId: null },
      { id: CLIENT_ID, name: 'C', email: 'c@x.co', admin: false, role: 'CLIENT', status: 'ACTIVE', sessionVersion: 0, inquiryId: null },
      { id: OTHER, name: 'O', email: 'o@x.co', admin: false, role: 'CLIENT', status: 'ACTIVE', sessionVersion: 0, inquiryId: null },
    ]),
    deliverableFolder: table(folders),
    deliverable: table([file()], {
      nested: (row, k, v) => k === 'folder' && folders.some((fo) => fo.id === row.folderId && (v.shareToken === undefined || fo.shareToken === v.shareToken) && (v.isPublic === undefined || fo.isPublic === v.isPublic)),
    }),
    inquiryAttachment: table([{ id: 'a1', inquiryId: 'i1', status: 'READY', fileName: 'brief.pdf', size: 10, storageKey: 'inquiries/a1', data: null }]),
  };
  h.db.folders = folders;
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('who can download', () => {
  it('anonymous → 401, and no storage link is made', async () => {
    const spy = vi.spyOn(storage, 'signedUrl');
    expect((await get(clientDownload, '/x', { id: 'f1' })).status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });
  it('the owning client is sent to a short-lived signed link with a safe download name', async () => {
    const res = await get(clientDownload, '/x', { id: 'f1' }, client());
    expect(res.status).toBe(302);
    const loc = res.headers.get('location')!;
    expect(loc).toContain('https://storage.test/sign/deliverables/f1');
    expect(loc).toContain('exp=30');
    expect(loc).toContain('download=logo.png');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
  it("another client's file is simply not found — and no signed link is ever created", async () => {
    const spy = vi.spyOn(storage, 'signedUrl');
    const res = await get(clientDownload, '/x', { id: 'f1' }, client(OTHER));
    expect(res.status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
  });
  it('admins can download any file', async () => {
    expect((await get(clientDownload, '/x', { id: 'f1' }, cookieFor({ userId: ADMIN_ID, admin: true }))).status).toBe(302);
  });
  it('a file still being verified (PENDING) does not exist for anyone', async () => {
    h.db.deliverable.rows[0].status = 'PENDING';
    expect((await get(clientDownload, '/x', { id: 'f1' }, cookieFor({ userId: ADMIN_ID, admin: true }))).status).toBe(404);
  });
  it('admin attachment route is admin-only and READY-only', async () => {
    const params = { id: 'i1', attachmentId: 'a1' };
    expect((await get(adminAttachment, '/x', params)).status).toBe(401);
    expect((await get(adminAttachment, '/x', params, client())).status).toBe(403);
    expect((await get(adminAttachment, '/x', params, cookieFor({ userId: ADMIN_ID, admin: true }))).status).toBe(302);
    h.db.inquiryAttachment.rows[0].status = 'PENDING';
    expect((await get(adminAttachment, '/x', params, cookieFor({ userId: ADMIN_ID, admin: true }))).status).toBe(404);
  });
});

describe('safe delivery headers', () => {
  it('previews are streamed with our type, nosniff and a sandbox — never the storage service’s type', async () => {
    const res = await get(clientDownload, '/x?inline=1', { id: 'f1' }, client());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');          // storage said text/html; we ignore it
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(res.headers.get('content-disposition')).toMatch(/^inline;/);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
  it('forwards Range requests so video can seek', async () => {
    h.db.deliverable.rows[0].fileName = 'clip.mp4';
    fetchSpy.mockResolvedValueOnce(new Response('xx', { status: 206, headers: { 'content-range': 'bytes 0-1/100', 'content-length': '2' } }));
    const res = await get(clientDownload, '/x?inline=1', { id: 'f1' }, client(), { range: 'bytes=0-1' });
    expect(fetchSpy.mock.calls[0][1].headers.Range).toBe('bytes=0-1');
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-1/100');
  });
  it('an SVG preview cannot run script (sandbox + locked-down CSP)', async () => {
    h.db.deliverable.rows[0].fileName = 'mark.svg';
    const res = await get(clientDownload, '/x?inline=1', { id: 'f1' }, client());
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    expect(res.headers.get('content-security-policy')).toMatch(/default-src 'none'.*sandbox/);
  });
  it('types that must not render in a browser are only ever delivered as attachments', async () => {
    h.db.deliverable.rows[0].fileName = 'page.docx';
    h.db.deliverable.rows[0].data = Buffer.from('legacy');
    h.db.deliverable.rows[0].storageKey = null;
    const res = await get(clientDownload, '/x?inline=1', { id: 'f1' }, client());
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment;/);
  });
  it('hostile file names cannot break out of the Content-Disposition header', async () => {
    h.db.deliverable.rows[0].fileName = 'evil"\r\nSet-Cookie: x=1; é.docx';
    h.db.deliverable.rows[0].data = Buffer.from('legacy');
    h.db.deliverable.rows[0].storageKey = null;
    const res = await get(clientDownload, '/x', { id: 'f1' }, client());
    const cd = res.headers.get('content-disposition')!;
    expect(cd).not.toMatch(/[\r\n]/);
    expect(cd).not.toContain('Set-Cookie: x=1;');
    expect(cd).toMatch(/^attachment; filename="[^"]*"; filename\*=UTF-8''[A-Za-z0-9%._-]+$/);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
  it('database-backed (older) files keep working during the transition', async () => {
    Object.assign(h.db.deliverable.rows[0], { storageKey: null, data: Buffer.from('legacy-bytes') });
    const res = await get(clientDownload, '/x', { id: 'f1' }, client());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('legacy-bytes');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('dual read during the migration', () => {
  it('a migrated file (both copies exist) is served from storage', async () => {
    Object.assign(h.db.deliverable.rows[0], { data: Buffer.from('db-copy') });
    expect((await get(clientDownload, '/x', { id: 'f1' }, client())).status).toBe(302);
  });
  it('if storage is unreachable but the database copy still exists, the file is still delivered', async () => {
    Object.assign(h.db.deliverable.rows[0], { data: Buffer.from('db-copy') });
    vi.spyOn(storage, 'signedUrl').mockRejectedValueOnce(new Error('storage down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await get(clientDownload, '/x', { id: 'f1' }, client());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('db-copy');
  });
  it('with no database copy and storage down, it fails (500) rather than pretending', async () => {
    vi.spyOn(storage, 'signedUrl').mockRejectedValueOnce(new Error('storage down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await get(clientDownload, '/x', { id: 'f1' }, client())).status).toBe(500);
  });
});

describe('watermarked files', () => {
  it('are watermarked from stored bytes; the clean original is never sent or linked', async () => {
    const original = await f.png(300, 200);
    storage.put('deliverables/f1', original);
    Object.assign(h.db.deliverable.rows[0], { watermark: true, size: original.length });
    const res = await get(clientDownload, '/x?inline=1', { id: 'f1' }, client());
    expect(res.status).toBe(200);
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.subarray(0, 4).toString('hex')).toBe('89504e47');
    expect(body.equals(original)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    // downloads (not just previews) are watermarked too, rather than redirected to the clean file
    const dl = await get(clientDownload, '/x', { id: 'f1' }, client());
    expect(dl.status).toBe(200);
    expect(dl.headers.get('location')).toBeNull();
  });
  it('shared-link downloads are watermarked as well', async () => {
    const original = await f.png(300, 200);
    storage.put('deliverables/f1', original);
    Object.assign(h.db.deliverable.rows[0], { watermark: true, size: original.length });
    const res = await get(shareDownload, '/x', { token: 'tok_current_token_1', id: 'f1' });
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).equals(original)).toBe(false);
  });
  it('fails closed: if the watermark cannot be applied, the clean file is not served', async () => {
    storage.put('deliverables/f1', Buffer.from('not an image'));
    Object.assign(h.db.deliverable.rows[0], { watermark: true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await get(clientDownload, '/x', { id: 'f1' }, client());
    expect(res.status).toBe(500);
    expect(res.headers.get('location')).toBeNull();
  });
  it('refuses (413) rather than serving unmarked when the file is too big to watermark', async () => {
    Object.assign(h.db.deliverable.rows[0], { watermark: true, size: 26 * 1024 * 1024 });
    expect((await get(clientDownload, '/x', { id: 'f1' }, client())).status).toBe(413);
  });
});

describe('public share downloads', () => {
  const T = 'tok_current_token_1';
  it('works with the current token (redirect to a signed link)', async () => {
    const res = await get(shareDownload, '/x', { token: T, id: 'f1' });
    expect(res.status).toBe(302);
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
  });
  it('a wrong token, or a private folder, is just 404', async () => {
    expect((await get(shareDownload, '/x', { token: 'tok_guess_guess_guess', id: 'f1' })).status).toBe(404);
    h.db.folders[0].isPublic = false;
    expect((await get(shareDownload, '/x', { token: T, id: 'f1' })).status).toBe(404);
  });
  it('a file that is not verified yet is not shared', async () => {
    h.db.deliverable.rows[0].status = 'PENDING';
    expect((await get(shareDownload, '/x', { token: T, id: 'f1' })).status).toBe(404);
  });
});
