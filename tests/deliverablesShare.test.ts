import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, cookieFor, setSecrets } from './helpers';
import { table, withTransactions } from './fakes';
import { NoopStore } from './pg';

const h = vi.hoisted(() => ({ db: {} as ReturnType<typeof database> }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_target, key) => h.db[key as keyof typeof h.db] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { GET as getSharing, POST as changeSharing } from '@/app/api/admin/deliverables/share/route';
import { GET as download } from '@/app/api/share/deliverables/[token]/files/[id]/route';
import { POST as comment } from '@/app/api/share/deliverables/[token]/files/[id]/comments/route';
import { GET as folderDownload } from '@/app/api/share/[token]/files/[id]/route';
import { getSharedDeliverables, getSharedDeliverablesFolder } from '@/lib/deliverablesShare';
import { setRateLimitStore } from '@/lib/rateLimit';

const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_PROJECT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FOLDER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_FOLDER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const FOLDER_TOKEN = 'existing_individual_folder_token';

function database() {
  const shares = table();
  const projectMatches = (projectId: string, value: { deliverablesShare: { shareToken: string; isPublic: boolean } }) =>
    shares.rows.some((share) => share.projectId === projectId && share.shareToken === value.deliverablesShare.shareToken && share.isPublic === value.deliverablesShare.isPublic);
  const folders = table([
    { id: FOLDER, projectId: PROJECT, name: 'Logo', description: 'Master files', isPublic: false, shareToken: FOLDER_TOKEN, commentsEnabled: true, commentsModerated: false, _count: { deliverables: 1 }, deliverables: [] },
    { id: OTHER_FOLDER, projectId: OTHER_PROJECT, name: 'Other client', isPublic: true, shareToken: 'other_client_folder_token', _count: { deliverables: 1 } },
  ], { nested: (row, key, value) => key === 'project' && projectMatches(row.projectId, value) });
  const files = table([
    { id: 'f1', folderId: FOLDER, folder: folders.rows[0], projectId: PROJECT, status: 'READY', fileName: 'logo.txt', title: 'Logo master', size: 3, data: Buffer.from('abc'), storageKey: null, watermark: false, _count: { comments: 0 } },
    { id: 'other', folderId: OTHER_FOLDER, folder: folders.rows[1], projectId: OTHER_PROJECT, status: 'READY', fileName: 'private.txt', size: 3, data: Buffer.from('xyz'), storageKey: null, watermark: false },
    { id: 'pending', folderId: FOLDER, folder: folders.rows[0], status: 'PENDING' },
    { id: 'unfiled', folderId: null, projectId: PROJECT, status: 'READY' },
  ], {
    nested: (row, key, value) => key === 'folder' && folders.rows.some((folder) => folder.id === row.folderId && (
      value.project ? projectMatches(folder.projectId, value.project) : folder.shareToken === value.shareToken && folder.isPublic === value.isPublic
    )),
  });
  folders.rows[0].deliverables = [files.rows[0]];
  shares.findFirst = vi.fn(async (args: Parameters<typeof shares.findFirst>[0]) => {
    const row = await table(shares.rows).findFirst(args);
    return row ? { ...row, project: { name: 'Brand project' } } : null;
  });
  folders.findMany = vi.fn(folders.findMany);
  folders.findFirst = vi.fn(folders.findFirst);
  return withTransactions({
    user: table([
      { id: ADMIN_ID, name: 'Admin', email: 'admin@example.com', admin: true, role: 'ADMIN', status: 'ACTIVE', sessionVersion: 0 },
      { id: CLIENT_ID, name: 'Client', email: 'client@example.com', admin: false, role: 'CLIENT', status: 'ACTIVE', sessionVersion: 0 },
    ]),
    project: table([{ id: PROJECT, name: 'Brand project' }, { id: OTHER_PROJECT, name: 'Other project' }]),
    deliverablesShare: shares, deliverableFolder: folders, deliverable: files,
    deliverableComment: table([], { defaults: () => ({ createdAt: new Date() }) }),
    auditLog: table(), adminNotification: table([], { unique: 'dedupeKey' }),
  });
}

const admin = () => cookieFor({ userId: ADMIN_ID, admin: true });
const client = () => cookieFor({ userId: CLIENT_ID, admin: false });
const action = (action: string, cookie?: string, projectId = PROJECT) => changeSharing(new NextRequest('http://localhost/api/admin/deliverables/share', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ projectId, action }),
}));
const read = (cookie?: string) => getSharing(new NextRequest(`http://localhost/api/admin/deliverables/share?projectId=${PROJECT}`, { headers: cookie ? { cookie } : {} }));
const file = (token: string, id = 'f1') => download(new NextRequest('http://localhost/x'), { params: Promise.resolve({ token, id }) });
const post = (token: string, id = 'f1') => comment(new NextRequest('http://localhost/x', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Guest Gary', body: 'Looks great' }),
}), { params: Promise.resolve({ token, id }) });
const enable = async () => (await (await action('enable', admin())).json()).share.shareToken as string;

beforeEach(() => {
  setSecrets();
  setRateLimitStore(new NoopStore());
  h.db = database();
});

describe('admin controls', () => {
  it('requires admin access for reading and changing project sharing', async () => {
    expect((await read()).status).toBe(401);
    expect((await read(client())).status).toBe(403);
    expect((await action('enable')).status).toBe(401);
    expect((await action('enable', client())).status).toBe(403);
    expect(h.db.deliverablesShare.rows).toHaveLength(0);
  });

  it('starts unshared and explicitly creates a stable link for the project', async () => {
    expect(await (await read(admin())).json()).toEqual({ ok: true, share: null });
    const token = await enable();
    expect(token.length).toBeGreaterThanOrEqual(30);
    expect(await enable()).toBe(token);
    expect(h.db.deliverablesShare.rows).toHaveLength(1);
    expect(h.db.deliverableFolder.rows[0].isPublic).toBe(false);
    expect((await read(admin())).headers.get('cache-control')).toBe('private, no-store');
    expect(h.db.auditLog.rows[0]).toMatchObject({ action: 'deliverables.share_enable', targetId: PROJECT });
  });

  it('validates actions and project ownership records without creating links', async () => {
    expect((await action('enable', admin(), 'not-a-project')).status).toBe(400);
    expect((await action('delete', admin())).status).toBe(400);
    expect((await action('enable', admin(), 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')).status).toBe(404);
    expect((await action('rotate', admin())).status).toBe(409);
    expect(h.db.deliverablesShare.rows).toHaveLength(0);
  });
});

describe('client folder navigation and project boundary', () => {
  it('lists the project’s folders, including folders added after the link was created', async () => {
    const token = await enable();
    expect((await getSharedDeliverables(token))?.folders.map((folder) => folder.name)).toEqual(['Logo']);
    expect(h.db.deliverableFolder.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ _count: { select: { deliverables: { where: { status: 'READY' } } } } }) }));
    h.db.deliverableFolder.rows.push({ id: 'new', projectId: PROJECT, name: 'Brand kit', _count: { deliverables: 0 } });
    expect((await getSharedDeliverables(token))?.folders.map((folder) => folder.name)).toEqual(['Logo', 'Brand kit']);
    expect((await getSharedDeliverablesFolder(token, FOLDER))?.name).toBe('Logo');
    expect(h.db.deliverableFolder.findFirst).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ deliverables: expect.objectContaining({ where: { status: 'READY' } }) }) }));
  });

  it('does not grant access to another project, pending files, or unfiled artifacts', async () => {
    const token = await enable();
    expect(await getSharedDeliverablesFolder(token, OTHER_FOLDER)).toBeNull();
    expect(await getSharedDeliverablesFolder(token, 'bad-id')).toBeNull();
    for (const id of ['other', 'pending', 'unfiled']) {
      expect((await file(token, id)).status).toBe(404);
      expect((await post(token, id)).status).toBe(404);
    }
    expect(h.db.deliverableComment.rows).toHaveLength(0);
  });

  it('serves files and comments through the project link while keeping folder-link permissions independent', async () => {
    const token = await enable();
    const response = await file(token);
    expect(await response.text()).toBe('abc');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await post(token)).status).toBe(200);
    expect((await folderDownload(new NextRequest('http://localhost/x'), { params: Promise.resolve({ token, id: 'f1' }) })).status).toBe(404);
    expect((await file(FOLDER_TOKEN)).status).toBe(404);
    expect(await getSharedDeliverables('unknown_token_value')).toBeNull();
    expect(await getSharedDeliverables('short')).toBeNull();
  });

  it('respects each folder’s comment and moderation settings', async () => {
    const token = await enable();
    h.db.deliverableFolder.rows[0].commentsEnabled = false;
    expect((await post(token)).status).toBe(403);
    h.db.deliverableFolder.rows[0].commentsEnabled = true;
    h.db.deliverableFolder.rows[0].commentsModerated = true;
    const response = await post(token);
    expect(await response.json()).toMatchObject({ ok: true, comment: null, pending: true });
    expect(h.db.deliverableComment.rows[0].status).toBe('PENDING');
  });
});

describe('link lifecycle', () => {
  it('replacement immediately closes the overview, folder, file, and comment paths for the old token', async () => {
    const token = await enable();
    expect((await action('rotate', admin())).status).toBe(200);
    const replacement = h.db.deliverablesShare.rows[0].shareToken;
    expect(replacement).not.toBe(token);
    expect(await getSharedDeliverables(token)).toBeNull();
    expect(await getSharedDeliverablesFolder(token, FOLDER)).toBeNull();
    expect((await file(token)).status).toBe(404);
    expect((await post(token)).status).toBe(404);
    expect((await getSharedDeliverables(replacement))?.folders).toHaveLength(1);
    expect((await file(replacement)).status).toBe(200);
  });

  it('disabling sharing closes every project path and re-enabling never revives retired links', async () => {
    const token = await enable();
    expect((await action('revoke', admin())).status).toBe(200);
    const retired = h.db.deliverablesShare.rows[0].shareToken;
    expect(await getSharedDeliverables(token)).toBeNull();
    expect(await getSharedDeliverablesFolder(token, FOLDER)).toBeNull();
    expect((await file(token)).status).toBe(404);
    expect((await post(token)).status).toBe(404);
    expect((await action('rotate', admin())).status).toBe(409);
    const replacement = await enable();
    expect(replacement).not.toBe(token);
    expect(replacement).not.toBe(retired);
    expect((await file(replacement)).status).toBe(200);
  });
});
