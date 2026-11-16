import { afterEach, describe, expect, it, vi } from 'vitest';
import { readUploadResponse, uploadLegacyDeliverables } from '@/lib/clientUpload';

afterEach(() => vi.unstubAllGlobals());

describe('upload response errors', () => {
  it('explains a plain-text request-size rejection instead of throwing a JSON syntax error', async () => {
    await expect(readUploadResponse(new Response('Request Entity Too Large', { status: 413 })))
      .rejects.toThrow(/too large.*direct file storage/);
  });

  it('handles HTML, empty responses, and invalid success bodies without exposing a parser error', async () => {
    for (const response of [new Response('<html>Bad Gateway</html>', { status: 502 }), new Response(''), Response.json(null), Response.json({})]) {
      await expect(readUploadResponse(response)).rejects.toThrow(/Upload failed/);
    }
  });

  it('keeps API validation messages and accepts successful JSON', async () => {
    await expect(readUploadResponse(Response.json({ ok: false, error: 'logo.svg is too large for an SVG.' }, { status: 400 })))
      .rejects.toThrow('logo.svg is too large for an SVG.');
    await expect(readUploadResponse(Response.json({ ok: true, count: 1 }))).resolves.toEqual({ ok: true, count: 1 });
  });
});

const item = (name: string, size = 1024 * 1024) => ({
  file: new File([new Uint8Array(size)], name, { type: 'image/png' }),
  title: `Title for ${name}`, description: `Description for ${name}`, watermark: true,
});

describe('fallback deliverable uploads', () => {
  it('sends a batch over 4.5 MB in separate single-file requests with each file’s metadata', async () => {
    const items = Array.from({ length: 6 }, (_, i) => item(`logo-${i}.png`));
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      const body = options.body as FormData;
      const files = body.getAll('files') as File[];
      expect(files).toHaveLength(1);
      const source = items.find((entry) => entry.file.name === files[0].name)!;
      expect(files[0].size).toBe(1024 * 1024);
      expect(body.get('folderId')).toBe('folder-1');
      expect(JSON.parse(body.get('titles') as string)).toEqual([source.title]);
      expect(JSON.parse(body.get('descriptions') as string)).toEqual([source.description]);
      expect(JSON.parse(body.get('watermarks') as string)).toEqual([source.watermark]);
      return Response.json({ ok: true, count: 1 });
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await uploadLegacyDeliverables('folder-1', items, vi.fn())).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('tracks successes separately so retrying failed files does not upload successes twice', async () => {
    const items = [item('good.png', 10), item('large.png', 10)];
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      const file = (options.body as FormData).get('files') as File;
      return file.name === 'large.png'
        ? new Response('Request Entity Too Large', { status: 413 })
        : Response.json({ ok: true, count: 1 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const update = vi.fn();
    const done = await uploadLegacyDeliverables('folder-1', items, update);
    expect(done).toEqual(new Set([0]));
    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ state: 'failed', failure: expect.stringContaining('too large') }));
    const retry = items.filter((_, i) => !done.has(i));
    fetchMock.mockImplementation(async () => Response.json({ ok: true, count: 1 }));
    expect(await uploadLegacyDeliverables('folder-1', retry, update)).toEqual(new Set([0]));
    expect(((fetchMock.mock.calls.at(-1)![1].body as FormData).get('files') as File).name).toBe('large.png');
  });

  it('keeps a file available for retry after a network failure or missing confirmation', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce(Response.json({ ok: true, count: 0 }));
    vi.stubGlobal('fetch', fetchMock);
    const update = vi.fn();
    expect(await uploadLegacyDeliverables('folder-1', [item('a.png', 1), item('b.png', 1)], update)).toEqual(new Set());
    expect(update).toHaveBeenCalledWith(0, expect.objectContaining({ state: 'failed', failure: 'Network unavailable' }));
    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ state: 'failed', failure: expect.stringContaining('did not confirm') }));
  });
});
