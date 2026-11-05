import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makePg } from './pg';
import { setSecrets } from './helpers';
import { mailTables, table } from './fakes';

const h = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  db: {} as any,
}));

vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('@/lib/dispatch', () => ({ dispatchOutbox: vi.fn() }));

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
/** What the background worker would do: send whatever is queued. */
const flush = async () => {
  await (await import('@/lib/emailOutbox')).processOutbox({ limit: 50 });
  return (await import('@/lib/mailer')).fakeInbox;
};

beforeEach(async () => {
  setSecrets();
  pg = await makePg();
  const tables = mailTables();
  const inquiries = table();
  h.create.mockReset().mockImplementation(async ({ data }: any) => {
    const row = { id: `id-${Math.random()}`, ...data, attachments: [], archivedAt: null };
    inquiries.rows.push(row);
    return row;
  });
  h.findFirst.mockReset().mockResolvedValue(null);
  h.db = {
    ...tables,
    inquiry: { create: h.create, findFirst: h.findFirst, findUnique: inquiries.findUnique },
    inquiryAttachment: table(),
    user: table(),
    $transaction: async (fn: any) => fn(h.db),
  };
  h.db.inquiries = inquiries;
  Object.assign(process.env, { DATABASE_URL: 'postgres://x', INQUIRY_TO_EMAIL: 'studio@example.com' });
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
    // The emails and the admin notification were written with the inquiry, as references (no personal text copied).
    const queued = h.db.emailOutbox.rows;
    expect(queued.map((j: any) => j.eventType).sort()).toEqual(['inquiry.confirmation', 'inquiry.notification']);
    expect(queued.every((j: any) => Object.keys(j.payload).join() === 'inquiryId' && j.status === 'PENDING')).toBe(true);
    expect(h.db.adminNotification.rows.map((n: any) => n.type)).toEqual(['inquiry.new']);
    const fakeInbox = await flush();
    expect(fakeInbox.map((m) => m.to).sort()).toEqual(['studio@example.com', expect.stringMatching(/@example\.com$/)].sort());
    expect(h.db.emailOutbox.rows.every((j: any) => j.status === 'SENT')).toBe(true);
  });

  it('accepts valid special-character names and shows them as text in the email', async () => {
    const POST = await process_();
    const res = await submit(POST, { name: "Zoë O'Brien & <Sons>", description: '<script>alert(1)</script>\nsecond line' });
    expect(res.status).toBe(200);
    const fakeInbox = await flush();
    const admin = fakeInbox.find((m) => m.to === 'studio@example.com')!;
    expect(admin.html).toContain('Zoë O&#39;Brien &amp; &lt;Sons&gt;');
    expect(admin.html).not.toMatch(/<script/i);
    expect(admin.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;<br>second line');
  });

  it('cannot be used for header injection', async () => {
    const POST = await process_();
    await submit(POST, { name: 'Eve\r\nBcc: attacker@evil.com' });
    const fakeInbox = await flush();
    const admin = fakeInbox.find((m) => m.to === 'studio@example.com')!;
    expect(admin.subject).not.toMatch(/[\r\n]/);
    expect(admin.replyTo!.name).not.toMatch(/[\r\n]/);
    expect(JSON.stringify(fakeInbox)).not.toMatch(/"bcc"/i);
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
    const fakeInbox = await flush();
    expect(fakeInbox).toHaveLength(0);
    expect(h.db.emailOutbox.rows).toHaveLength(0);
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
