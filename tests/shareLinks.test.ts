import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, cookieFor, setSecrets } from './helpers';
import { FakeStorage, table } from './fakes';
import { NoopStore } from './pg';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { setStorageProvider } from '@/lib/storage';
import { setRateLimitStore } from '@/lib/rateLimit';
import { PATCH as patchFolder } from '@/app/api/admin/deliverable-folders/[id]/route';
import { POST as shareAction } from '@/app/api/admin/deliverable-folders/[id]/share/route';
import { GET as shareFile } from '@/app/api/share/[token]/files/[id]/route';
import { POST as postComment } from '@/app/api/share/[token]/files/[id]/comments/route';

const FOLDER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OLD = 'tok_original_leaked_link_0001';

const req = (method: string, body?: unknown, cookie?: string) =>
  new NextRequest('http://localhost/x', { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const admin = () => cookieFor({ userId: ADMIN_ID, admin: true });
const folder = () => h.db.deliverableFolder.rows[0];
const fileVia = (token: string) => shareFile(req('GET') as never, { params: Promise.resolve({ token, id: 'f1' }) });
let n = 0;
const commentVia = (token: string) => postComment(req('POST', { name: 'Guest', body: `hello there ${++n}` }) as never, { params: Promise.resolve({ token, id: 'f1' }) });
const patch = (body: unknown, cookie = admin()) => patchFolder(req('PATCH', body, cookie) as never, { params: Promise.resolve({ id: FOLDER }) });
const action = (body: unknown, cookie?: string, id = FOLDER) => shareAction(req('POST', body, cookie) as never, { params: Promise.resolve({ id }) });

beforeEach(() => {
  setSecrets();
  setRateLimitStore(new NoopStore());
  setStorageProvider(new FakeStorage());
  const folders = [{ id: FOLDER, shareToken: OLD, isPublic: true, shareRotatedAt: null }];
  h.db = {
    user: table([
      { id: ADMIN_ID, name: 'A', email: 'a@x.co', admin: true, role: 'ADMIN', status: 'ACTIVE', sessionVersion: 0, inquiryId: null },
      { id: CLIENT_ID, name: 'C', email: 'c@x.co', admin: false, role: 'CLIENT', status: 'ACTIVE', sessionVersion: 0, inquiryId: null },
    ]),
    deliverableFolder: table(folders),
    deliverable: table([{ id: 'f1', status: 'READY', fileName: 'a.txt', size: 3, data: Buffer.from('abc'), storageKey: null, folderId: FOLDER, watermark: false, _count: { comments: 0 } }], {
      nested: (row, k, v) => k === 'folder' && folders.some((fo) => fo.id === row.folderId && (v.shareToken === undefined || fo.shareToken === v.shareToken) && (v.isPublic === undefined || fo.isPublic === v.isPublic)),
    }),
    deliverableComment: table([], { defaults: () => ({ createdAt: new Date() }) }),
    auditLog: table(),
  };
  h.db.deliverable.findFirst = async ({ where }: any) => {
    const fo = folders.find((x) => x.shareToken === where.folder?.shareToken && x.isPublic === where.folder?.isPublic);
    const row = h.db.deliverable.rows.find((r: any) => r.id === where.id && fo && r.folderId === fo.id && r.status === where.status);
    return row ? { ...row, folder: { id: fo!.id, commentsEnabled: true, commentsModerated: false } } : null;
  };
  h.db.$transaction = async (fn: any) => fn(h.db);
});

describe('rotating a link', () => {
  it('the old token stops working for files AND comments the moment it is rotated; the new one works', async () => {
    expect((await fileVia(OLD)).status).toBe(200);
    expect((await commentVia(OLD)).status).toBe(200);

    const res = await action({ action: 'rotate' }, admin());
    const { shareToken } = await res.json();
    expect(shareToken).not.toBe(OLD);
    expect(shareToken.length).toBeGreaterThanOrEqual(30);

    expect((await fileVia(OLD)).status).toBe(404);
    expect((await commentVia(OLD)).status).toBe(404);
    expect((await fileVia(shareToken)).status).toBe(200);
    expect((await commentVia(shareToken)).status).toBe(200);
    expect(h.db.auditLog.rows.map((r: any) => r.action)).toContain('folder.share_rotate');
  });

  it('rotation is admin-only: anonymous 401, customer 403, and nothing changes', async () => {
    expect((await action({ action: 'rotate' })).status).toBe(401);
    expect((await action({ action: 'rotate' }, cookieFor({ userId: CLIENT_ID, admin: false }))).status).toBe(403);
    expect(folder().shareToken).toBe(OLD);
  });

  it('refuses to rotate a folder that is not shared, and validates input', async () => {
    folder().isPublic = false;
    expect((await action({ action: 'rotate' }, admin())).status).toBe(409);
    expect((await action({ action: 'delete' }, admin())).status).toBe(400);
    expect((await action({ action: 'rotate' }, admin(), 'not-a-uuid')).status).toBe(404);
  });
});

describe('turning sharing off and on', () => {
  it('off revokes immediately and retires the token', async () => {
    expect((await patch({ isPublic: false })).status).toBe(200);
    expect(folder().isPublic).toBe(false);
    expect(folder().shareToken).not.toBe(OLD);
    expect((await fileVia(OLD)).status).toBe(404);
    expect((await commentVia(OLD)).status).toBe(404);
  });
  it('turning it back on does NOT bring the leaked link back — it issues a new one', async () => {
    await patch({ isPublic: false });
    const retired = folder().shareToken;
    await patch({ isPublic: true });
    expect(folder().isPublic).toBe(true);
    expect(folder().shareToken).not.toBe(retired);
    expect(folder().shareToken).not.toBe(OLD);
    expect((await fileVia(OLD)).status).toBe(404);
    expect((await fileVia(retired)).status).toBe(404);
    expect((await fileVia(folder().shareToken)).status).toBe(200);
  });
  it('re-enabling a folder that was already private also issues a new link (covers links leaked before this change)', async () => {
    folder().isPublic = false;
    await patch({ isPublic: true });
    expect(folder().shareToken).not.toBe(OLD);
    expect((await fileVia(OLD)).status).toBe(404);
  });
  it('saving other fields while sharing stays on does not change the link', async () => {
    await patch({ name: 'Renamed', isPublic: true });
    expect(folder().shareToken).toBe(OLD);
    expect((await fileVia(OLD)).status).toBe(200);
  });
  it('explicit revoke works the same way and is audited', async () => {
    expect((await action({ action: 'revoke' }, admin())).status).toBe(200);
    expect(folder()).toMatchObject({ isPublic: false });
    expect((await fileVia(OLD)).status).toBe(404);
    expect(h.db.auditLog.rows.map((r: any) => r.action)).toContain('folder.share_revoke');
  });
  it('a customer cannot toggle sharing', async () => {
    expect((await patch({ isPublic: false }, cookieFor({ userId: CLIENT_ID, admin: false }))).status).toBe(403);
    expect(folder().isPublic).toBe(true);
  });
});

describe('cache safety', () => {
  it('shared file responses are never cacheable', async () => {
    const res = await fileVia(OLD);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
});
