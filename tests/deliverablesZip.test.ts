import { NextRequest } from 'next/server';
import { unzipSync, strFromU8 } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, cookieFor, setSecrets } from './helpers';
import { FakeStorage, table, withTransactions } from './fakes';
import { png } from './files';

const h = vi.hoisted(() => ({ db: {} as ReturnType<typeof database> }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_target, key) => h.db[key as keyof typeof h.db] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { GET } from '@/app/api/admin/deliverables/download/route';
import { archiveEntries, archiveFits, streamArchive } from '@/lib/deliverablesZip';
import { setStorageProvider } from '@/lib/storage';

const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_PROJECT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LOGO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MASCOT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const EMPTY = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const OTHER_FOLDER = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

function database() {
  const folders = table([
    { id: LOGO, projectId: PROJECT, name: 'Main Logo' },
    { id: MASCOT, projectId: PROJECT, name: 'Mascot' },
    { id: EMPTY, projectId: PROJECT, name: 'Empty' },
    { id: OTHER_FOLDER, projectId: OTHER_PROJECT, name: 'Other client' },
  ]);
  const file = (id: string, folderId: string | null, fileName: string, text: string, status = 'READY') => ({
    id, folderId, fileName, status, size: Buffer.byteLength(text), data: Buffer.from(text), storageKey: null, watermark: false,
  });
  const files = table([
    file('logo-1', LOGO, 'logo.txt', 'first'), file('logo-2', LOGO, 'logo.txt', 'second'),
    file('mascot', MASCOT, 'mascot.svg', '<svg/>'), file('pending', LOGO, 'unfinished.txt', 'pending', 'PENDING'),
    file('unfiled', null, 'loose.txt', 'loose'), file('other', OTHER_FOLDER, 'private.txt', 'private'),
  ], { nested: (row, key, value) => key === 'folder' && folders.rows.some((folder) => folder.id === row.folderId && folder.projectId === value.projectId) });
  const findFolders = folders.findMany;
  folders.findMany = vi.fn(async (args: Parameters<typeof findFolders>[0]) => (await findFolders(args)).map((folder) => ({
    ...folder,
    deliverables: files.rows.filter((entry) => entry.folderId === folder.id && entry.status === args?.select?.deliverables?.where?.status)
      .map(({ id, fileName, size }) => ({ id, fileName, size })),
  })));
  return withTransactions({
    user: table([
      { id: ADMIN_ID, name: 'Admin', email: 'admin@example.com', admin: true, role: 'ADMIN', status: 'ACTIVE', sessionVersion: 0 },
      { id: CLIENT_ID, name: 'Client', email: 'client@example.com', admin: false, role: 'CLIENT', status: 'ACTIVE', sessionVersion: 0 },
    ]),
    project: table([{ id: PROJECT, name: 'Brand project' }, { id: OTHER_PROJECT, name: 'Other project' }]),
    deliverableFolder: folders, deliverable: files,
  });
}

const admin = () => cookieFor({ userId: ADMIN_ID, admin: true });
const client = () => cookieFor({ userId: CLIENT_ID, admin: false });
const request = (folderId?: string, cookie = admin(), projectId = PROJECT) => GET(new NextRequest(
  `http://localhost/api/admin/deliverables/download?projectId=${projectId}${folderId ? `&folderId=${folderId}` : ''}`,
  { headers: cookie ? { cookie } : {} },
));
const unzip = async (response: Response) => unzipSync(new Uint8Array(await response.arrayBuffer()));

beforeEach(() => { setSecrets(); h.db = database(); setStorageProvider(new FakeStorage()); });
afterEach(() => vi.unstubAllGlobals());

describe('project and folder ZIP downloads', () => {
  it('requires an active admin before querying folders or retrieving any file bytes', async () => {
    expect((await request(undefined, '')).status).toBe(401);
    expect((await request(undefined, client())).status).toBe(403);
    expect(h.db.deliverableFolder.findMany).not.toHaveBeenCalled();
  });

  it('downloads all folders with their ready artifacts, preserving empty folders and duplicate filenames', async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toContain('Brand project Deliverables.zip');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-length')).toBeNull(); // a streaming response
    const archive = await unzip(response);
    expect(Object.keys(archive)).toEqual(['Main Logo/', 'Main Logo/logo.txt', 'Main Logo/logo (2).txt', 'Mascot/', 'Mascot/mascot.svg', 'Empty/']);
    expect(strFromU8(archive['Main Logo/logo.txt'])).toBe('first');
    expect(strFromU8(archive['Main Logo/logo (2).txt'])).toBe('second');
    expect(strFromU8(archive['Mascot/mascot.svg'])).toBe('<svg/>');
  });

  it('downloads one folder’s artifacts without including other folders or a redundant wrapper directory', async () => {
    const response = await request(LOGO);
    expect(response.headers.get('content-disposition')).toContain('Main Logo.zip');
    const archive = await unzip(response);
    expect(Object.keys(archive)).toEqual(['logo.txt', 'logo (2).txt']);
    expect(strFromU8(archive['logo (2).txt'])).toBe('second');
  });

  it('validates project/folder scope and empty downloads before starting a ZIP', async () => {
    expect((await request(OTHER_FOLDER)).status).toBe(404);
    expect((await request('not-an-id')).status).toBe(400);
    expect((await request(undefined, admin(), 'bad-project')).status).toBe(400);
    expect((await request(undefined, admin(), '11111111-1111-4111-8111-111111111111')).status).toBe(404);
    expect((await request(EMPTY)).status).toBe(400);
    h.db.deliverableFolder.rows.length = 0;
    expect((await request()).status).toBe(400);
  });

  it('includes private-storage files using short-lived URLs, without exposing URLs in the archive', async () => {
    const row = h.db.deliverable.rows[0];
    row.storageKey = 'deliverables/private-object'; row.data = null; row.size = 12;
    const fetchMock = vi.fn(async () => new Response('stored bytes'));
    vi.stubGlobal('fetch', fetchMock);
    const archive = await unzip(await request(LOGO));
    expect(strFromU8(archive['logo.txt'])).toBe('stored bytes');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('https://storage.test/sign/deliverables/private-object'), expect.objectContaining({ cache: 'no-store', redirect: 'error' }));
  });

  it('applies the existing watermark to ZIP members too', async () => {
    const original = await png(300, 200);
    Object.assign(h.db.deliverable.rows[0], { fileName: 'logo.png', data: original, size: original.length, watermark: true });
    const archive = await unzip(await request(LOGO));
    expect(Buffer.from(archive['logo.png']).subarray(0, 4).toString('hex')).toBe('89504e47');
    expect(Buffer.from(archive['logo.png']).equals(Buffer.from(original))).toBe(false);
  });

  it('aborts instead of exporting an unwatermarked original when watermarking a dual-copy file fails', async () => {
    Object.assign(h.db.deliverable.rows[0], { fileName: 'bad.png', data: Buffer.from('broken image'), storageKey: 'deliverables/migrated', watermark: true });
    const response = await request(LOGO);
    await expect(response.arrayBuffer()).rejects.toThrow();
  });

  it('does not pretend an archive succeeded when an artifact disappears mid-download', async () => {
    vi.spyOn(h.db.deliverable, 'findFirst').mockResolvedValue(null);
    const response = await request(LOGO);
    await expect(response.arrayBuffer()).rejects.toThrow(/no longer available/);
  });

  it('rejects archives beyond the ZIP format limits before any bytes are sent', async () => {
    h.db.deliverable.rows[0].size = 0xffffffff;
    expect((await request()).status).toBe(413);
  });
});

describe('ZIP filename safety and streaming', () => {
  it('sanitizes path traversal and disambiguates case-insensitive folder and file collisions', () => {
    const entries = archiveEntries([
      { id: 'one', name: '../Logo', deliverables: [{ id: 'a', fileName: '../../master.svg', size: 1 }, { id: 'b', fileName: 'MASTER.svg', size: 1 }] },
      { id: 'two', name: 'logo', deliverables: [{ id: 'c', fileName: String.raw`C:\assets\mark.svg`, size: 1 }] },
    ]);
    expect(entries.map((entry) => entry.path)).toEqual(['Logo/', 'Logo/master.svg', 'Logo/MASTER (2).svg', 'logo (2)/', 'logo (2)/mark.svg']);
  });

  it('supports Unicode archive paths', async () => {
    const entries = archiveEntries([{ id: 'f', name: 'Identité', deliverables: [{ id: 'a', fileName: 'ロゴ.svg', size: 3 }] }]);
    const archive = await unzip(new Response(streamArchive(entries, async () => new Response('svg'))));
    expect(Object.keys(archive)).toEqual(['Identité/', 'Identité/ロゴ.svg']);
  });

  it('streams without loading later files and cancels the active source when the download is cancelled', async () => {
    const cancelled = vi.fn();
    const source = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(1024)); }, cancel: cancelled,
    }, { highWaterMark: 0 })));
    const stream = streamArchive([{ path: 'one.bin', fileId: 'a', size: 1024 }, { path: 'two.bin', fileId: 'b', size: 1024 }], source);
    const reader = stream.getReader();
    expect((await reader.read()).done).toBe(false);
    await reader.cancel();
    expect(source).toHaveBeenCalledTimes(1);
    expect(cancelled).toHaveBeenCalled();
  });

  it('rejects too many ZIP members without allocating or loading file contents', () => {
    expect(archiveFits(Array.from({ length: 65_536 }, (_, i) => ({ path: `${i}/`, size: 0 })))).toBe(false);
  });
});
