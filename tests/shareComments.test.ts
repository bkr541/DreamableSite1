import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePg } from './pg';
import { setSecrets } from './helpers';

const h = vi.hoisted(() => ({
  fileFind: vi.fn(),
  cFind: vi.fn(),
  cCreate: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { deliverable: { findFirst: h.fileFind }, deliverableComment: { findFirst: h.cFind, create: h.cCreate } },
}));

let pg: Awaited<ReturnType<typeof makePg>>;
async function process_() {
  vi.resetModules();
  (await import('@/lib/rateLimit')).setRateLimitStore(pg.instance());
  return (await import('@/app/api/share/[token]/files/[id]/comments/route')).POST;
}
const TOKEN = 'tok_abcdefghijklmnop';
const FILE = 'file-1';
const post = (POST: Awaited<ReturnType<typeof process_>>, body: Record<string, unknown> = {}, token = TOKEN) =>
  POST(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Guest Gary', body: 'Looks great', ...body }) }) as never,
    { params: Promise.resolve({ token, id: FILE }) });

const liveFile = (folder: Record<string, unknown> = {}) => ({ id: FILE, folder: { id: 'f1', commentsEnabled: true, commentsModerated: false, ...folder }, _count: { comments: 0 } });

beforeEach(async () => {
  setSecrets();
  pg = await makePg();
  h.fileFind.mockReset().mockResolvedValue(liveFile());
  h.cFind.mockReset().mockResolvedValue(null);
  h.cCreate.mockReset().mockImplementation(async ({ data }: any) => ({ id: 'c1', deliverableId: FILE, authorName: data.authorName, body: data.body, createdAt: new Date() }));
  delete process.env.VERCEL;
  delete process.env.TRUSTED_PROXY;
});

describe('who may comment', () => {
  it('cannot post to a private, revoked or unknown link — and nothing is written', async () => {
    h.fileFind.mockResolvedValue(null);
    const res = await post(await process_(), {}, 'tok_not_a_real_link__');
    expect(res.status).toBe(404);
    expect(h.cCreate).not.toHaveBeenCalled();
  });
  it('looks the link up with the public flag and token on every write', async () => {
    await post(await process_());
    expect(h.fileFind.mock.calls[0][0].where).toEqual({ id: FILE, status: 'READY', folder: { shareToken: TOKEN, isPublic: true } });
  });
  it('cannot post when the folder has comments turned off', async () => {
    h.fileFind.mockResolvedValue(liveFile({ commentsEnabled: false }));
    const res = await post(await process_());
    expect(res.status).toBe(403);
    expect(h.cCreate).not.toHaveBeenCalled();
  });
});

describe('moderation and visibility', () => {
  it('saves as APPROVED and returns the comment when the folder is not moderated', async () => {
    const res = await post(await process_());
    expect(h.cCreate.mock.calls[0][0].data.status).toBe('APPROVED');
    expect((await res.json()).comment.authorName).toBe('Guest Gary');
  });
  it('holds comments as PENDING when the folder moderates, and does not return them', async () => {
    h.fileFind.mockResolvedValue(liveFile({ commentsModerated: true }));
    const res = await post(await process_());
    const body = await res.json();
    expect(h.cCreate.mock.calls[0][0].data.status).toBe('PENDING');
    expect(body.comment).toBeNull();
    expect(body.pending).toBe(true);
    expect(JSON.stringify(body)).not.toContain('Looks great');
  });
  it('the public page and the write path share one definition of "visible": approved only', async () => {
    const { PUBLIC_COMMENT_FILTER } = await import('@/lib/shareAccess');
    expect(PUBLIC_COMMENT_FILTER).toEqual({ status: 'APPROVED' });
  });
});

describe('impersonation and spam', () => {
  it.each(['Admin', 'Dreamable.studio', 'dreamable support'])('refuses the reserved name %j', async (name) => {
    const res = await post(await process_(), { name });
    expect(res.status).toBe(400);
    expect(h.cCreate).not.toHaveBeenCalled();
  });
  it('cleans control characters out of the stored name and text', async () => {
    await post(await process_(), { name: 'Eve\r\n\u0000Smith', body: 'hi\u0007 there' });
    expect(h.cCreate.mock.calls[0][0].data).toMatchObject({ authorName: 'Eve Smith', body: 'hi there' });
  });
  it('rejects an immediate repeat of the same comment', async () => {
    h.cFind.mockResolvedValue({ id: 'existing' });
    const res = await post(await process_());
    expect(res.status).toBe(409);
    expect(h.cCreate).not.toHaveBeenCalled();
  });
  it('rejects link-stuffed and oversize comments', async () => {
    const P = await process_();
    expect((await post(P, { body: 'http://a.co http://b.co http://c.co http://d.co' })).status).toBe(400);
    expect((await post(P, { body: 'x'.repeat(2001) })).status).toBe(400);
  });
  it('keeps the honeypot', async () => {
    const res = await post(await process_(), { website: 'http://spam' });
    expect((await res.json()).ok).toBe(true);
    expect(h.cCreate).not.toHaveBeenCalled();
  });
});

describe('rate limiting', () => {
  it('a burst gets 429 with a wait hint, and the cap holds across separate processes', async () => {
    const first = await process_();
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await post(first, { body: `msg ${i}` })).status);
    expect(codes).toEqual([200, 200, 200, 200, 200]);
    const second = await process_(); // another instance; same IP+file bucket (5 per 10 min) is already spent
    const res = await post(second, { body: 'one more' });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await res.json()).retryAfterSeconds).toBeGreaterThan(0);
  });
  it('a distributed spray against one link is capped by the link-wide budget', async () => {
    process.env.TRUSTED_PROXY = 'hops:1';
    const POST = await process_();
    let limited = 0;
    for (let i = 0; i < 70; i++) {
      const req = new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.${Math.floor(i / 4)}.${(i % 4) + 1}` }, body: JSON.stringify({ name: 'Bot', body: `spam ${i}` }) });
      const res = await POST(req as never, { params: Promise.resolve({ token: TOKEN, id: FILE }) });
      if (res.status === 429) limited++;
    }
    expect(limited).toBeGreaterThan(0);
    expect(h.cCreate.mock.calls.length).toBeLessThanOrEqual(60);
  });
  it('spoofed X-Forwarded-For does not reset the budget when no proxy is trusted', async () => {
    const POST = await process_();
    for (let i = 0; i < 5; i++) {
      await POST(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `1.2.3.${i}` }, body: JSON.stringify({ name: 'Gary', body: `m${i}` }) }) as never, { params: Promise.resolve({ token: TOKEN, id: FILE }) });
    }
    const res = await POST(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '99.99.99.99' }, body: JSON.stringify({ name: 'Gary', body: 'again' }) }) as never, { params: Promise.resolve({ token: TOKEN, id: FILE }) });
    expect(res.status).toBe(429);
  });
});
