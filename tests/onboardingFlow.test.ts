import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, cookieFor, setSecrets } from './helpers';
import { makeOnboardingDb } from './onboardingDb';
import { NoopStore } from './pg';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/dispatch', () => ({ dispatchOutbox: vi.fn() }));

import { setRateLimitStore } from '@/lib/rateLimit';
import { fakeInbox, setMailTransport } from '@/lib/mailer';
import { processOutbox } from '@/lib/emailOutbox';
import { POST as submitInquiry } from '@/app/api/inquiries/route';
import { POST as approve } from '@/app/api/inquiries/[id]/approve/route';
import { POST as reject } from '@/app/api/admin/inquiries/[id]/reject/route';
import { POST as resend } from '@/app/api/admin/users/[id]/invite/route';
import { POST as verifyToken } from '@/app/api/auth/verify-reset-token/route';
import { POST as setPassword } from '@/app/api/auth/set-password/route';
import { POST as login } from '@/app/api/auth/login/route';

const PASSWORD = 'my chosen portal passphrase';
const adminCookie = () => cookieFor({ userId: ADMIN_ID, admin: true });
const json = (url: string, body?: unknown, cookie?: string) =>
  new NextRequest(`http://localhost${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

const inquiry = (over = {}) => ({ name: 'Grace Hopper', email: 'Grace@Navy.example', service: 'Branding', description: 'We need a new identity', project_name: 'Rebrand', ...over });
const tokenFromLatestEmail = () => decodeURIComponent(/token=([^"&]+)/.exec(fakeInbox.at(-1)!.html)![1]);
const clientRow = () => h.db.user.rows.find((u: any) => u.email === 'grace@navy.example');

async function submitAndGetId() {
  const res = await submitInquiry(json('/api/inquiries', inquiry()) as never);
  expect(res.status).toBe(200);
  return (await res.json()).inquiryId as string;
}
const approveIt = (id: string) => approve(json('/x', undefined, adminCookie()) as never, { params: Promise.resolve({ id }) });

beforeEach(() => {
  setSecrets();
  setRateLimitStore(new NoopStore());
  setMailTransport(null);
  fakeInbox.length = 0;
  Object.assign(process.env, { DATABASE_URL: 'postgres://x', INQUIRY_TO_EMAIL: 'studio@example.com', APP_URL: 'https://app.example.com' });
  h.db = makeOnboardingDb();
  h.db.inquiry.rows.length = 0;
  h.db.inquiryAttachment.rows.length = 0;
  // The public form creates the inquiry itself; give the fake the shape the database would.
  const create = h.db.inquiry.create;
  h.db.inquiry.create = async ({ data, select }: any) => {
    const { attachments: _a, ...rest } = data;
    return create({ data: { status: 'INQUIRY', archivedAt: null, rejectedAt: null, attachments: [], approvedAt: null, ...rest }, select });
  };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('the whole journey: inquiry → review → invitation → activation → portal sign-in', () => {
  it('works end to end', async () => {
    // 1. A visitor submits the form. It is saved and its emails are queued — nothing needs SMTP yet.
    const id = await submitAndGetId();
    expect(h.db.inquiry.rows).toHaveLength(1);
    expect(h.db.emailOutbox.rows.map((j: any) => j.eventType).sort()).toEqual(['inquiry.confirmation', 'inquiry.notification']);
    await processOutbox({ limit: 10 });
    expect(fakeInbox.map((m) => m.to.toLowerCase()).sort()).toEqual(['grace@navy.example', 'studio@example.com']);
    fakeInbox.length = 0;

    // 2. Staff approve it. A client account (without any password), company and project exist; one invitation is queued.
    const approved = await approveIt(id);
    expect(approved.status).toBe(200);
    expect(clientRow()).toMatchObject({ status: 'INVITED', role: 'CLIENT', inquiryId: id });
    expect(clientRow().passwordHash ?? null).toBeNull();
    expect(h.db.project.rows).toHaveLength(1);
    expect(h.db.emailOutbox.rows.filter((j: any) => j.eventType === 'client.invitation')).toHaveLength(1);

    // 3. The invitation email goes out — with a link, never a password.
    await processOutbox({ limit: 10 });
    expect(fakeInbox).toHaveLength(1);
    expect(fakeInbox[0]).toMatchObject({ to: 'grace@navy.example', subject: expect.stringMatching(/portal is ready/) });
    expect(fakeInbox[0].html).toContain('https://app.example.com/portal/reset-password?token=');
    expect(JSON.stringify(fakeInbox[0])).not.toMatch(/password:|temporary/i);
    const token = tokenFromLatestEmail();

    // 4. Before setting a password, sign-in is impossible.
    const early = await login(json('/api/auth/login', { email: 'grace@navy.example', password: PASSWORD }) as never);
    expect(early.status).toBe(401);

    // 5. The link opens the setup page and the client chooses a password (a weak one is refused first).
    expect(await (await verifyToken(json('/x', { token }) as never)).json()).toMatchObject({ valid: true, purpose: 'invite' });
    expect((await setPassword(json('/x', { token, password: 'password123' }) as never)).status).toBe(400);
    expect((await setPassword(json('/x', { token, password: PASSWORD }) as never)).status).toBe(200);
    expect(clientRow().status).toBe('ACTIVE');

    // 6. The link is single-use.
    expect((await setPassword(json('/x', { token, password: 'another passphrase here' }) as never)).status).toBe(400);

    // 7. They can now sign in to the portal as a (non-admin) client, and staff were told they activated.
    const ok = await login(json('/api/auth/login', { email: 'grace@navy.example', password: PASSWORD }) as never);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, admin: false });
    expect(ok.headers.get('set-cookie')).toMatch(/ds_session=/);
    expect(h.db.adminNotification.rows.map((n: any) => n.type)).toEqual(['inquiry.new', 'inquiry.approved', 'client.activated']);
  });

  it('a mail outage after approval never un-approves or duplicates anything, and the invitation arrives once it recovers', async () => {
    const id = await submitAndGetId();
    setMailTransport(async () => { throw new Error('SMTP down'); });
    await approveIt(id);
    await processOutbox({ limit: 10 });
    expect(h.db.inquiry.rows[0].status).toBe('APPROVED');
    expect(h.db.project.rows).toHaveLength(1);
    expect(clientRow().status).toBe('INVITED');
    expect(h.db.emailOutbox.rows.find((j: any) => j.eventType === 'client.invitation').status).toBe('RETRY');

    setMailTransport(null);
    await approveIt(id);                                                   // an impatient second click
    expect(h.db.project.rows).toHaveLength(1);
    expect(h.db.emailOutbox.rows.filter((j: any) => j.eventType === 'client.invitation')).toHaveLength(1);

    await processOutbox({ limit: 10, now: new Date(Date.now() + 2 * 60_000) });
    expect(fakeInbox.filter((m) => m.subject.includes('portal is ready'))).toHaveLength(1);
  });

  it('an expired invitation can be resent, and only the newest link works', async () => {
    const id = await submitAndGetId();
    await approveIt(id);
    await processOutbox({ limit: 10 });
    const oldToken = tokenFromLatestEmail();

    // Seven days pass without the client acting.
    const row = h.db.passwordResetToken.rows.find((r: any) => r.purpose === 'INVITE');
    row.expiresAt = new Date(Date.now() - 1000);
    const invJob = h.db.emailOutbox.rows.find((j: any) => j.eventType === 'client.invitation');
    invJob.sentAt = new Date(Date.now() - 8 * 24 * 3600_000);
    expect(await (await verifyToken(json('/x', { token: oldToken }) as never)).json()).toEqual({ valid: false, expired: true });

    // Staff resend; the client uses the new link.
    expect((await resend(json('/x', undefined, adminCookie()) as never, { params: Promise.resolve({ id: clientRow().id }) })).status).toBe(200);
    await processOutbox({ limit: 10 });
    const newToken = tokenFromLatestEmail();
    expect(newToken).not.toBe(oldToken);
    expect((await setPassword(json('/x', { token: oldToken, password: PASSWORD }) as never)).status).toBe(400);
    expect((await setPassword(json('/x', { token: newToken, password: PASSWORD }) as never)).status).toBe(200);
    expect(clientRow().status).toBe('ACTIVE');
  });

  it('a rejected inquiry produces no client, no project and no email to the customer', async () => {
    const id = await submitAndGetId();
    await processOutbox({ limit: 10 });
    fakeInbox.length = 0;
    expect((await reject(json('/x', { reason: 'out of scope' }, adminCookie()) as never, { params: Promise.resolve({ id }) })).status).toBe(200);
    await processOutbox({ limit: 10 });
    expect(fakeInbox).toHaveLength(0);
    expect(clientRow()).toBeUndefined();
    expect(h.db.project.rows).toHaveLength(0);
    expect((await approveIt(id)).status).toBe(409);
  });

  it('a suspended client who still holds an invitation cannot get in', async () => {
    const id = await submitAndGetId();
    await approveIt(id);
    await processOutbox({ limit: 10 });
    const token = tokenFromLatestEmail();
    clientRow().status = 'SUSPENDED';
    expect((await setPassword(json('/x', { token, password: PASSWORD }) as never)).status).toBe(400);
    expect((await login(json('/api/auth/login', { email: 'grace@navy.example', password: PASSWORD }) as never)).status).toBe(401);
  });

  it('an inquiry from an address that already has an account is held for review instead of duplicating it', async () => {
    h.db.user.rows.push({ id: 'existing', name: 'Existing Grace', email: 'grace@navy.example', status: 'ACTIVE', admin: false, passwordHash: 'keep', inquiryId: null, sessionVersion: 0 });
    const id = await submitAndGetId();
    const res = await approveIt(id);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('EMAIL_EXISTS');
    expect(h.db.user.rows.filter((u: any) => u.email === 'grace@navy.example')).toHaveLength(1);
    expect(h.db.user.rows.find((u: any) => u.id === 'existing').passwordHash).toBe('keep');
    expect(h.db.project.rows).toHaveLength(0);
  });
});
