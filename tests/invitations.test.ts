import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, CLIENT_ID, cookieFor, setSecrets } from './helpers';
import { makeOnboardingDb } from './onboardingDb';
import { NoopStore } from './pg';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/dispatch', () => ({ dispatchOutbox: vi.fn() }));

import { setRateLimitStore } from '@/lib/rateLimit';
import { fakeInbox } from '@/lib/mailer';
import { processOutbox } from '@/lib/emailOutbox';
import { INVITE_TOKEN_TTL_MS, RESET_TOKEN_TTL_MS, issueResetToken } from '@/lib/resetTokens';
import { INVITE_TTL_MS, invitationState } from '@/lib/invitations';
import { POST as resend } from '@/app/api/admin/users/[id]/invite/route';
import { POST as setPassword } from '@/app/api/auth/set-password/route';
import { POST as verifyToken } from '@/app/api/auth/verify-reset-token/route';
import { POST as forgot } from '@/app/api/auth/forgot-password/route';

const U = '55555555-5555-4555-8555-555555555555';
const STRONG = 'a long and unusual passphrase';
const admin = () => cookieFor({ userId: ADMIN_ID, admin: true });
const request = (body?: unknown, cookie?: string | null) =>
  new NextRequest('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const doResend = (id = U, cookie: string | null = admin()) => resend(request(undefined, cookie) as never, { params: Promise.resolve({ id }) });
const set = (token: string, password = STRONG) => setPassword(request({ token, password }) as never);
const verify = async (token: string) => (await verifyToken(request({ token }) as never)).json();
const user = () => h.db.user.rows.find((x: any) => x.id === U);
const jobs = () => h.db.emailOutbox.rows as any[];
const tokenRow = (t: string) => h.db.passwordResetToken.rows.find((r: any) => r.userId === U && r.consumedAt === null) ?? null;

beforeEach(() => {
  setSecrets();
  setRateLimitStore(new NoopStore());
  fakeInbox.length = 0;
  Object.assign(process.env, { APP_URL: 'https://app.example.com', INQUIRY_TO_EMAIL: 'studio@example.com' });
  h.db = makeOnboardingDb();
  h.db.user.rows.push({ id: U, name: 'Ivy Invited', email: 'ivy@example.com', status: 'INVITED', admin: false, role: 'CLIENT', passwordHash: null, sessionVersion: 0, inquiryId: null });
});

describe('invitation status (what the admin sees)', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
  it.each([
    ['queued', 'PENDING', null, 'pending'], ['sending', 'SENDING', null, 'pending'], ['retrying after a mail error', 'RETRY', null, 'pending'],
    ['delivered', 'SENT', hoursAgo(2), 'sent'], ['delivered long ago', 'SENT', new Date(now.getTime() - INVITE_TTL_MS - 1000), 'expired'],
    ['gave up', 'DEAD', null, 'failed'], ['not sent (suppressed)', 'SUPPRESSED', null, 'failed'],
  ])('an invited client whose invitation is %s → %s', (_n, status, sentAt, expected) => {
    expect(invitationState({ status: 'INVITED' }, { status, sentAt, createdAt: hoursAgo(1) }, now).state).toBe(expected);
  });
  it('an invited client with no invitation on record, an active client, and a suspended one', () => {
    expect(invitationState({ status: 'INVITED' }, null, now).state).toBe('none');
    expect(invitationState({ status: 'ACTIVE' }, null, now).state).toBe('accepted');
    expect(invitationState({ status: 'SUSPENDED' }, { status: 'SENT', sentAt: now, createdAt: now }, now).state).toBe('none');
  });
});

describe('resending an invitation', () => {
  it('is admin-only', async () => {
    expect((await doResend(U, null)).status).toBe(401);
    expect((await doResend(U, cookieFor({ userId: CLIENT_ID, admin: false }))).status).toBe(403);
    expect(jobs()).toHaveLength(0);
  });
  it('queues a new invitation and records who asked', async () => {
    expect((await doResend()).status).toBe(200);
    expect(jobs()).toEqual([expect.objectContaining({ eventType: 'client.invitation', recipient: 'ivy@example.com', dedupeKey: `invite:${U}:r0`, status: 'PENDING' })]);
    expect(h.db.auditLog.rows.map((a: any) => a.action)).toEqual(['client.invite_resend']);
  });
  it('repeated clicks while one is on its way queue nothing more', async () => {
    await doResend();
    const again = await (await doResend()).json();
    expect(again).toMatchObject({ ok: true, alreadyQueued: true });
    expect(jobs()).toHaveLength(1);
  });
  it('a failed invitation can be resent; one that was sent a moment ago cannot be spammed', async () => {
    await doResend();
    jobs()[0].status = 'DEAD';
    expect((await doResend()).status).toBe(200);
    expect(jobs()).toHaveLength(2);
    jobs()[1].createdAt = new Date(Date.now() + 5);                          // a later request than the first
    jobs()[1].status = 'SENT'; jobs()[1].sentAt = new Date();
    expect((await doResend()).status).toBe(429);
    jobs()[1].sentAt = new Date(Date.now() - 5 * 60_000);
    expect((await doResend()).status).toBe(200);
    expect(jobs()).toHaveLength(3);
  });
  it('is refused for clients who are already active, suspended, admins or unknown — without queuing anything', async () => {
    user().status = 'ACTIVE';
    const active = await doResend();
    expect(active.status).toBe(409);
    expect((await active.json()).code).toBe('ACCEPTED');
    user().status = 'SUSPENDED';
    expect((await doResend()).status).toBe(409);
    expect((await doResend(ADMIN_ID)).status).toBe(404);
    expect((await doResend('99999999-9999-4999-8999-999999999999')).status).toBe(404);
    expect((await doResend('nope')).status).toBe(404);
    expect(jobs()).toHaveLength(0);
  });
});

describe('invitation links', () => {
  async function invite() {
    await doResend();
    await processOutbox({ limit: 10 });
    const html = fakeInbox.at(-1)!.html;
    return decodeURIComponent(/token=([^"&]+)/.exec(html)![1]);
  }

  it('the emailed link is an INVITE token that lasts 7 days — a reset link lasts 1 hour', async () => {
    const token = await invite();
    const row = tokenRow(token);
    expect(row.purpose).toBe('INVITE');
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(INVITE_TOKEN_TTL_MS - 60_000);
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(INVITE_TOKEN_TTL_MS);
    user().status = 'ACTIVE';
    const reset = await issueResetToken(U, 'RESET');
    expect(reset).toBeTruthy();
    const resetRow = h.db.passwordResetToken.rows.at(-1);
    expect(resetRow.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(RESET_TOKEN_TTL_MS);
  });

  it('works once: sets the password, activates the account, tells staff, and cannot be reused', async () => {
    const token = await invite();
    expect(await verify(token)).toEqual({ valid: true, expired: false, purpose: 'invite' });
    const res = await set(token);
    expect(res.status).toBe(200);
    expect(user()).toMatchObject({ status: 'ACTIVE', sessionVersion: 1 });
    expect(user().passwordHash).toBeTruthy();
    expect(user().passwordHash).not.toContain(STRONG);
    expect(h.db.adminNotification.rows.map((n: any) => n.type)).toEqual(['client.activated']);
    expect((await set(token, 'a different long passphrase')).status).toBe(400);
    expect(await verify(token)).toMatchObject({ valid: false });
    expect(h.db.adminNotification.rows).toHaveLength(1);
  });

  it('a weak password is refused and does not use up the invitation', async () => {
    const token = await invite();
    for (const weak of ['short', 'password123', 'ivy@example.com']) {
      const res = await set(token, weak);
      expect(res.status).toBe(400);
    }
    expect(user().status).toBe('INVITED');
    expect((await verify(token)).valid).toBe(true);
    expect((await set(token)).status).toBe(200);
  });

  it('an expired invitation fails and says it expired', async () => {
    const token = await invite();
    tokenRow(token).expiresAt = new Date(Date.now() - 1000);
    expect(await verify(token)).toEqual({ valid: false, expired: true });
    expect((await set(token)).status).toBe(400);
    expect(user().status).toBe('INVITED');
  });

  it('sending a new invitation retires every older one', async () => {
    const first = await invite();
    jobs()[0].status = 'SENT'; jobs()[0].sentAt = new Date(Date.now() - 10 * 60_000);
    const second = await invite();
    expect(second).not.toBe(first);
    expect((await verify(first)).valid).toBe(false);
    expect((await set(first)).status).toBe(400);
    expect((await set(second)).status).toBe(200);
  });

  it('a suspended client cannot activate through an invitation they already hold', async () => {
    const token = await invite();
    user().status = 'SUSPENDED';
    expect((await verify(token)).valid).toBe(false);
    const res = await set(token);
    expect(res.status).toBe(400);
    expect(user()).toMatchObject({ status: 'SUSPENDED', passwordHash: null });
  });

  it('suspension between the check and the write still wins', async () => {
    const token = await invite();
    const original = h.db.user.updateMany;
    h.db.user.updateMany = async (args: any) => { user().status = 'SUSPENDED'; return original(args); };
    expect((await set(token)).status).toBe(400);
    expect(user().passwordHash).toBeNull();           // no password was set on the suspended account
    expect(tokenRow(token)).not.toBeNull();          // and the transaction rolled back, so the link wasn't consumed either
  });

  it('a password-reset link cannot activate an invited account, and an invitation cannot be used on an active one', async () => {
    const reset = await issueResetToken(U, 'RESET');
    expect((await verify(reset)).valid).toBe(false);
    expect((await set(reset)).status).toBe(400);
    expect(user().status).toBe('INVITED');

    const inviteToken = await issueResetToken(U, 'INVITE');
    user().status = 'ACTIVE';
    expect((await verify(inviteToken)).valid).toBe(false);
    const res = await set(inviteToken);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/already been used/);
  });

  it('delivery problems never activate anything', async () => {
    await doResend();
    const { setMailTransport } = await import('@/lib/mailer');
    setMailTransport(async () => { throw new Error('SMTP down'); });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await processOutbox({ limit: 5 });
    setMailTransport(null);
    expect(jobs()[0].status).toBe('RETRY');
    expect(user()).toMatchObject({ status: 'INVITED', passwordHash: null });
  });

  it('the invitation is only ever emailed to someone still to be set up', async () => {
    await doResend();
    user().status = 'ACTIVE';                         // they got in some other way before the email went out
    await processOutbox({ limit: 5 });
    expect(fakeInbox).toHaveLength(0);
    expect(jobs()[0].status).toBe('SUPPRESSED');
  });
});

describe('"forgot password" for an account that was never set up', () => {
  it('sends an invitation, not a reset link; identical response to everyone', async () => {
    const ask = async (email: string) => {
      const res = await forgot(request({ email }) as never);
      return { status: res.status, body: await res.json() };
    };
    h.db.user.rows.push({ id: 'act', name: 'Al Active', email: 'al@example.com', status: 'ACTIVE', admin: false, passwordHash: 'h', sessionVersion: 0, inquiryId: null });
    h.db.user.rows.push({ id: 'sus', name: 'Sue Suspended', email: 'sue@example.com', status: 'SUSPENDED', admin: false, passwordHash: 'h', sessionVersion: 0, inquiryId: null });
    const answers = await Promise.all(['ivy@example.com', 'al@example.com', 'sue@example.com', 'nobody@example.com'].map(ask));
    expect(new Set(answers.map((a) => JSON.stringify(a))).size).toBe(1);
    expect(answers[0]).toEqual({ status: 200, body: { ok: true } });
    expect(jobs().map((j) => [j.recipient, j.eventType]).sort()).toEqual([['al@example.com', 'auth.reset_link'], ['ivy@example.com', 'client.invitation']]);
  });
});
