import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverablesPreviewInfo, sharedDeliverablesMetadata } from '@/lib/deliverablesMetadata';

const h = vi.hoisted(() => ({ getShared: vi.fn(), image: vi.fn() }));
vi.mock('@/lib/deliverablesShare', () => ({ getSharedDeliverables: h.getShared }));
vi.mock('@/lib/deliverablesPreview', () => ({ deliverablesPreviewImage: h.image }));
import { GET as preview } from '@/app/share/deliverables/[token]/preview/route';

const shared = {
  name: 'Initial Design',
  folders: [
    { id: '1', name: 'Main Logo', description: null, _count: { deliverables: 3 } },
    { id: '2', name: 'Mascot', description: null, _count: { deliverables: 3 } },
    { id: '3', name: 'Marketing Artifacts', description: null, _count: { deliverables: 4 } },
  ],
};

afterEach(() => vi.unstubAllEnvs());
beforeEach(() => { h.getShared.mockReset(); h.image.mockReset(); });

describe('project deliverables link previews', () => {
  it('uses the project name, folder names, and ready file counts', () => {
    expect(deliverablesPreviewInfo(shared)).toMatchObject({ title: 'Initial Design — Deliverables', counts: '3 folders · 10 files', folderNames: 'Main Logo · Mascot · Marketing Artifacts' });
  });

  it('overrides inherited website images and descriptions for both preview formats', () => {
    vi.stubEnv('APP_URL', 'https://dreamable.studio');
    const metadata = sharedDeliverablesMetadata('project-token', shared);
    const images = [{ url: 'https://dreamable.studio/share/deliverables/project-token/preview', width: 1200, height: 630, alt: 'Initial Design — Deliverables — 3 folders · 10 files' }];
    expect(metadata.title).toEqual({ absolute: 'Initial Design — Deliverables | Dreamable.studio' });
    expect(metadata.description).toContain('Main Logo · Mascot · Marketing Artifacts');
    expect(metadata.openGraph).toMatchObject({ title: 'Initial Design — Deliverables | Dreamable.studio', url: 'https://dreamable.studio/share/deliverables/project-token', images });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', images });
    expect(metadata.robots).toMatchObject({ index: false, follow: false, nocache: true });
    expect(metadata.referrer).toBe('no-referrer');
  });

  it('keeps different projects and tokens distinct', () => {
    vi.stubEnv('APP_URL', 'https://dreamable.studio');
    const one = sharedDeliverablesMetadata('one', shared);
    const two = sharedDeliverablesMetadata('two', { ...shared, name: 'Another project' });
    expect(two.title).not.toEqual(one.title);
    expect(two.openGraph).not.toEqual(one.openGraph);
  });

  it('handles empty projects, singular counts, and a limited list of folder names', () => {
    expect(deliverablesPreviewInfo({ ...shared, folders: [] })).toMatchObject({ counts: '0 folders · 0 files', folderNames: '' });
    expect(deliverablesPreviewInfo({ ...shared, folders: [{ ...shared.folders[0], _count: { deliverables: 1 } }] }).counts).toBe('1 folder · 1 file');
    const info = deliverablesPreviewInfo({ ...shared, folders: [...shared.folders, { ...shared.folders[0], id: '4', name: 'Extras' }] });
    expect(info.counts).toBe('4 folders · 13 files');
    expect(info.folderNames).not.toContain('Extras');
  });

  it('does not render or expose project details for an inactive or unknown token', async () => {
    h.getShared.mockResolvedValue(null);
    const response = await preview(new Request('http://localhost/x'), { params: Promise.resolve({ token: 'revoked-token' }) });
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(h.image).not.toHaveBeenCalled();
  });

  it('renders the approved project details only after resolving a live share', async () => {
    h.getShared.mockResolvedValue(shared);
    h.image.mockResolvedValue(new Response('image', { headers: { 'content-type': 'image/png' } }));
    const response = await preview(new Request('http://localhost/x'), { params: Promise.resolve({ token: 'live-token' }) });
    expect(response.status).toBe(200);
    expect(h.getShared).toHaveBeenCalledWith('live-token');
    expect(h.image).toHaveBeenCalledWith(deliverablesPreviewInfo(shared));
  });
});
