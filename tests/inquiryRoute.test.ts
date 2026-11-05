import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makePg } from './pg';
import { setSecrets } from './helpers';

const h = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  mails: [] as any[],
  pending: [] as Promise<unknown>[],
}));

vi.mock('@/lib/prisma', () => {
  const tx = { inquiry: { create: h.create }, inquiryAttachment: { updateMany: async () => ({ count: 1 }) } };
  return { prisma: { inquiry: { create: h.create, findFirst: h.findFirst }, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail: async (m: unknown) => { h.mails.push(m); } }) },
}));
vi.mock('next/server', async (orig) => {
  const m = await orig<typeof import('next/server')>();
  return { ...m, after: (fn: () => Promise<void>) => { h.pending.push(fn()); } };
});

let pg: Awaited<ReturnType<typeof makePg>>;

/** A brand-new module registry = a brand-new application process. Only the database is shared. */
async function process_() {
  vi.resetModules();
  const rl = await import('@/lib/rateLimit');
  rl.setRateLimitStore(pg.instance());
  return (await import('@/app/api/inquiries/route')).POST;
}

let n = 0;
function submit(POST: Awaited<ReturnType<typeof process_>>, over: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  n++;
  const req = new Request('http://localhost/api/inquiries', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ name: `Person ${n}`, email: `person${n}@example.com`, service: 'Branding', description: `Project ${n}`, ...over }),
  });
  return POST(req as never);
}
const flush = async () => { await Promise.all(h.pending.splice(0)); };

beforeEach(async () => {
  setSecrets();
  pg = await makePg();
  h.create.mockReset().mockImplementation(async () => ({ id: `id-${Math.random()}` }));
  h.findFirst.mockReset().mockResolvedValue(null);
  h.mails.length = 0;
  Object.assign(process.env, { DATABASE_URL: 'postgres://x', SMTP_HOST: 'smtp.test', SMTP_USER: 'u', SMTP_PASS: 'p', INQUIRY_TO_EMAIL: 'studio@example.com' });
  delete process.env.VERCEL;
  delete process.env.TRUSTED_PROXY;
});
afterEach(() => { vi.restoreAllMocks(); });

describe('public inquiry: saving and notifying', () => {
  it('saves a normal inquiry and sends both emails', async () => {
    const POST = await process_();
    const res = await submit(POST);
    expect(res.status).toBe(200);
    expect(h.create).toHaveBeenCalledTimes(1);
    await flush();
    expect(h.mails.map((m) => m.to).sort()).toEqual(['studio@example.com', expect.stringMatching(/@example\.com$/)].sort());
  });

  it('accepts valid special-character names and shows them as text in the email', async () => {
    const POST = await process_();
    const res = await submit(POST, { name: "Zoë O'Brien & <Sons>", description: '<script>alert(1)</script>\nsecond line' });
    expect(res.status).toBe(200);
    await flush();
    const admin = h.mails.find((m) => m.to === 'studio@example.com');
    expect(admin.html).toContain('Zoë O&#39;Brien &amp; &lt;Sons&gt;');
    expect(admin.html).not.toMatch(/<script/i);
    expect(admin.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;<br>second line');
  });

  it('cannot be used for header injection', async () => {
    const POST = await process_();
    await submit(POST, { name: 'Eve\r\nBcc: attacker@evil.com' });
    await flush();
    const admin = h.mails.find((m) => m.to === 'studio@example.com');
    expect(admin.subject).not.toMatch(/[\r\n]/);
    expect(admin.replyTo.name).not.toMatch(/[\r\n]/);
    expect(JSON.stringify(h.mails)).not.toMatch(/"bcc"/i);
  });

  it('rejects an email address carrying header or markup characters', async () => {
    const POST = await process_();
    for (const email of ['a@b.co\r\nBcc: x@y.co', '"><script>@x.co', 'a@b.co,c@d.co']) {
      expect((await submit(POST, { email })).status).toBe(400);
    }
    expect(h.create).not.toHaveBeenCalled();
  });

  it('answers an immediate re-submit with the original inquiry, without a second record or email', async () => {
    const POST = await process_();
    h.findFirst.mockResolvedValueOnce({ id: 'original-id' });
    const res = await submit(POST);
    expect(await res.json()).toEqual({ ok: true, inquiryId: 'original-id' });
    expect(h.create).not.toHaveBeenCalled();
    await flush();
    expect(h.mails).toHaveLength(0);
  });

  it('keeps the honeypot: pretends to succeed and stores nothing', async () => {
    const POST = await process_();
    const res = await submit(POST, { website_hp: 'http://spam.example' });
    expect((await res.json()).ok).toBe(true);
    expect(h.create).not.toHaveBeenCalled();
  });

  it('bounds the request body and survives garbage', async () => {
    const POST = await process_();
    const big = await POST(new Request('http://localhost/api/inquiries', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '999999' }, body: '{}' }) as never);
    expect(big.status).toBe(413);
    const bad = await POST(new Request('http://localhost/api/inquiries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' }) as never);
    expect(bad.status).toBe(400);
  });

  it('records cheap spam signals without blocking the visitor', async () => {
    const POST = await process_();
    const res = await submit(POST, { description: Array.from({ length: 7 }, (_, i) => `http://spam${i}.example`).join(' ') });
    expect(res.status).toBe(200);
    expect(h.create.mock.calls[0][0].data.metadata.spamSignals).toContain('many-links');
  });
});

describe('public inquiry: abuse protection', () => {
  it('a burst is stopped with 429 + Retry-After, and the message says how long to wait', async () => {
    const POST = await process_();
    const codes: number[] = [];
    let last!: Response;
    for (let i = 0; i < 10; i++) { last = await submit(POST); codes.push(last.status); }
    expect(codes.slice(0, 8).every((c) => c === 200)).toBe(true);
    expect(codes.slice(8)).toEqual([429, 429]);
    expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await last.json()).message).toMatch(/Please wait .* and try again/);
  });

  it('is enforced across separate application processes', async () => {
    const first = await process_();
    for (let i = 0; i < 8; i++) expect((await submit(first)).status).toBe(200);
    const second = await process_();           // fresh process, no memory of the first
    expect((await submit(second)).status).toBe(429);
    const third = await process_();            // e.g. after a redeploy
    expect((await submit(third)).status).toBe(429);
  });

  it('spoofed X-Forwarded-For does not escape the limit when no proxy is trusted', async () => {
    const POST = await process_();
    for (let i = 0; i < 8; i++) await submit(POST, {}, { 'x-forwarded-for': `10.0.0.${i}` });
    expect((await submit(POST, {}, { 'x-forwarded-for': '198.51.100.99', 'x-real-ip': '198.51.100.98' })).status).toBe(429);
  });

  it('behind one trusted proxy, only the address the proxy appended counts — prepended spoofs are ignored', async () => {
    process.env.TRUSTED_PROXY = 'hops:1';
    const POST = await process_();
    for (let i = 0; i < 8; i++) await submit(POST, {}, { 'x-forwarded-for': `${i}.${i}.${i}.${i}, 203.0.113.5` });
    expect((await submit(POST, {}, { 'x-forwarded-for': '9.9.9.9, 203.0.113.5' })).status).toBe(429);
    // A different real visitor (different appended address) is unaffected.
    expect((await submit(POST, {}, { 'x-forwarded-for': '203.0.113.77' })).status).toBe(200);
  });

  it('people sharing an office IP can all submit within a normal budget', async () => {
    process.env.TRUSTED_PROXY = 'hops:1';
    const POST = await process_();
    for (let i = 0; i < 6; i++) expect((await submit(POST, {}, { 'x-forwarded-for': '203.0.113.5' })).status).toBe(200);
  });

  it('one address cannot flood the inbox even from many IPs, but recovers after the cooldown', async () => {
    process.env.TRUSTED_PROXY = 'hops:1';
    const POST = await process_();
    const send = (i: number) => submit(POST, { email: 'victim@example.com', description: `msg ${i}` }, { 'x-forwarded-for': `203.0.113.${i + 1}` });
    for (let i = 0; i < 3; i++) expect((await send(i)).status).toBe(200);
    const blocked = await send(4);
    expect(blocked.status).toBe(429);
    await pg.age(Number(blocked.headers.get('retry-after')) + 5);
    expect((await send(5)).status).toBe(200);
  });

  it('logs hashed references only — never the visitor’s email or text', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation((...a) => { logs.push(a.join(' ')); });
    const POST = await process_();
    for (let i = 0; i < 9; i++) await submit(POST, { email: 'secret.person@example.com', description: `private words ${i}` });
    const all = logs.join('\n');
    expect(all).toContain('rate_limit.blocked');
    expect(all).not.toContain('secret.person');
    expect(all).not.toContain('private words');
  });
});
