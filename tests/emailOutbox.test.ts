import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSecrets } from './helpers';
import { mailTables, table } from './fakes';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('@/lib/dispatch', () => ({ dispatchOutbox: vi.fn() }));

import { backoffSeconds, enqueueEmail, maskEmail, outboxProblems, processOutbox, retryAllFailed, retryEmail, sanitizeError, MAX_ATTEMPTS } from '@/lib/emailOutbox';
import { fakeInbox, setMailTransport } from '@/lib/mailer';

const MIN = 60_000;
const jobs = () => h.db.emailOutbox.rows as any[];
const byType = (t: string) => jobs().find((j) => j.eventType === t);
const inquiryRows = () => h.db.inquiry.rows as any[];

async function queueInquiryEmails() {
  await enqueueEmail(h.db, [
    { eventType: 'inquiry.notification', recipient: 'studio@example.com', dedupeKey: 'inquiry.notification:inq1', payload: { inquiryId: 'inq1' } },
    { eventType: 'inquiry.confirmation', recipient: 'ada@example.com', dedupeKey: 'inquiry.confirmation:inq1', payload: { inquiryId: 'inq1' } },
  ]);
}
const outage = () => setMailTransport(async () => { throw new Error('connect ECONNREFUSED smtp.example.com:587 (user "mailuser" pass "hunter2-super-secret-password")'); });

beforeEach(() => {
  setSecrets();
  Object.assign(process.env, { INQUIRY_TO_EMAIL: 'studio@example.com', SMTP_USER: 'mailuser', SMTP_PASS: 'hunter2-super-secret-password', APP_URL: 'https://app.example.com' });
  fakeInbox.length = 0;
  setMailTransport(null);
  h.db = {
    ...mailTables(),
    inquiry: table([{
      id: 'inq1', name: 'Ada Lovelace', email: 'ada@example.com', company: null, website: null, service: 'Branding', description: 'Please help',
      budgetRange: null, timeline: null, metadata: { projectName: 'Rebrand' }, utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null,
      referrer: null, attachments: [],
    }]),
    user: table([{ id: 'u1', name: 'Ann Client', email: 'ann@example.com', status: 'ACTIVE', templogincode: null, tempLoginCodeExpiresAt: null }]),
    passwordResetToken: table(),
  };
  h.db.$transaction = async (a: any) => (typeof a === 'function' ? a(h.db) : Promise.all(a));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { setMailTransport(null); vi.restoreAllMocks(); });

describe('an SMTP outage does not lose anything', () => {
  it('the inquiry and its queued emails survive; the failure is recorded without secrets', async () => {
    await queueInquiryEmails();
    outage();
    const r = await processOutbox();
    expect(r).toMatchObject({ sent: 0, retry: 2, dead: 0 });
    expect(inquiryRows()).toHaveLength(1);
    expect(jobs()).toHaveLength(2);
    for (const j of jobs()) {
      expect(j).toMatchObject({ status: 'RETRY', attempts: 1 });
      expect(j.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
      expect(j.lastError).not.toContain('hunter2');
      expect(j.lastError).not.toContain('mailuser');
    }
    expect(fakeInbox).toHaveLength(0);
  });

  it('nothing is retried before it is due', async () => {
    await queueInquiryEmails();
    outage();
    await processOutbox();
    setMailTransport(null);
    expect(await processOutbox()).toMatchObject({ sent: 0 });
    expect(fakeInbox).toHaveLength(0);
  });

  it('when SMTP recovers, the retry delivers each email exactly once', async () => {
    await queueInquiryEmails();
    outage();
    await processOutbox();
    setMailTransport(null);
    const later = new Date(Date.now() + 2 * MIN);
    expect(await processOutbox({ now: later })).toMatchObject({ sent: 2 });
    expect(fakeInbox.map((m) => m.to).sort()).toEqual(['ada@example.com', 'studio@example.com']);
    expect(jobs().every((j) => j.status === 'SENT' && j.sentAt && j.lastError === null)).toBe(true);
    // Running the worker again — from a cron, a page load, anywhere — sends nothing more.
    expect(await processOutbox({ now: new Date(Date.now() + 60 * MIN) })).toMatchObject({ sent: 0, retry: 0 });
    expect(fakeInbox).toHaveLength(2);
  });

  it('a message id derived from the job lets a rare duplicate be recognised downstream', async () => {
    await queueInquiryEmails();
    await processOutbox();
    expect(fakeInbox.map((m) => m.messageId).sort()).toEqual(jobs().map((j) => `outbox-${j.id}`).sort());
  });
});

describe('retry schedule and giving up', () => {
  it('backs off exponentially and is bounded', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(backoffSeconds)).toEqual([60, 300, 1200, 3600, 10_800, 21_600, 43_200]);
    expect(backoffSeconds(50)).toBe(43_200);
  });

  it('gives up after the maximum attempts, alerts staff once, and stops', async () => {
    await queueInquiryEmails();
    outage();
    let now = new Date();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await processOutbox({ now });
      now = new Date(now.getTime() + 13 * 60 * 60 * 1000); // past any backoff
    }
    expect(jobs().every((j) => j.status === 'DEAD' && j.attempts === MAX_ATTEMPTS)).toBe(true);
    const failures = h.db.adminNotification.rows.filter((n: any) => n.type === 'email.failed');
    expect(failures).toHaveLength(2);
    expect(failures[0].url).toBe('/admin?view=notifications');
    expect(JSON.stringify(failures)).not.toContain('hunter2');
    expect(JSON.stringify(failures)).not.toContain('ada@example.com');
    // More worker runs neither resend nor duplicate the alert.
    await processOutbox({ now });
    await processOutbox({ now });
    expect(h.db.adminNotification.rows.filter((n: any) => n.type === 'email.failed')).toHaveLength(2);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"event":"email.gave_up"'));
  });

  it('staff can retry a dead email; once it is SENT it can never be retried again', async () => {
    await queueInquiryEmails();
    outage();
    let now = new Date();
    for (let i = 0; i < MAX_ATTEMPTS; i++) { await processOutbox({ now }); now = new Date(now.getTime() + 13 * 3600_000); }
    const dead = byType('inquiry.notification');
    setMailTransport(null);
    expect(await retryEmail(dead.id)).toBe(true);
    expect(dead).toMatchObject({ status: 'PENDING', attempts: 0, manualRetries: 1 });
    await processOutbox({ now });
    expect(dead.status).toBe('SENT');
    expect(await retryEmail(dead.id)).toBe(false);   // would otherwise be a duplicate
    expect(fakeInbox.filter((m) => m.to === 'studio@example.com')).toHaveLength(1);
  });

  it('retry-all revives only failed emails', async () => {
    await queueInquiryEmails();
    byType('inquiry.confirmation').status = 'SENT';
    byType('inquiry.notification').status = 'DEAD';
    expect(await retryAllFailed()).toEqual([byType('inquiry.notification').id]);
    expect(byType('inquiry.confirmation').status).toBe('SENT');
  });
});

describe('no duplicates', () => {
  it('queueing the same event twice is a no-op', async () => {
    await queueInquiryEmails();
    await queueInquiryEmails();
    expect(jobs()).toHaveLength(2);
  });

  it('several workers at once send each email once', async () => {
    await queueInquiryEmails();
    await Promise.all([processOutbox(), processOutbox(), processOutbox()]);
    expect(fakeInbox).toHaveLength(2);
  });

  it('a worker that died mid-send is recovered after its claim expires, not before', async () => {
    await queueInquiryEmails();
    const [a, b] = jobs();
    Object.assign(a, { status: 'SENDING', attempts: 1, lockedUntil: new Date(Date.now() - MIN) });   // crashed long ago
    Object.assign(b, { status: 'SENDING', attempts: 1, lockedUntil: new Date(Date.now() + MIN) });   // still being worked on
    await processOutbox();
    expect(a.status).toBe('SENT');
    expect(b.status).toBe('SENDING');
    expect(fakeInbox).toHaveLength(1);
  });
});

describe('what is sent', () => {
  it('is built from current data at send time, with nothing personal copied into the queue', async () => {
    await queueInquiryEmails();
    expect(JSON.stringify(jobs().map((j) => j.payload))).toBe('[{"inquiryId":"inq1"},{"inquiryId":"inq1"}]');
    await processOutbox();
    const admin = fakeInbox.find((m) => m.to === 'studio@example.com')!;
    expect(admin.subject).toContain('Ada Lovelace');
    expect(admin.replyTo).toEqual({ name: 'Ada Lovelace', address: 'ada@example.com' });
    expect(fakeInbox.find((m) => m.to === 'ada@example.com')!.html).toContain('Rebrand');
  });

  it('an inquiry that no longer exists is skipped (not retried forever)', async () => {
    await queueInquiryEmails();
    inquiryRows().length = 0;
    expect(await processOutbox()).toMatchObject({ suppressed: 2, retry: 0 });
    expect(jobs().every((j) => j.status === 'SUPPRESSED')).toBe(true);
  });

  it('a reset link is created at send time — the queue never holds the token', async () => {
    await enqueueEmail(h.db, { eventType: 'auth.reset_link', recipient: 'ann@example.com', dedupeKey: 'reset-link:u1:1', payload: { userId: 'u1' } });
    await processOutbox();
    const mail = fakeInbox[0];
    const token = /token=([A-Za-z0-9_%-]+)/.exec(mail.html)![1];
    expect(token.length).toBeGreaterThan(30);
    expect(mail.html).toContain('https://app.example.com/portal/reset-password?token=');
    expect(JSON.stringify(jobs())).not.toContain(token);
  });

  it('a recovery code is created at send time and only its hash is stored', async () => {
    await enqueueEmail(h.db, { eventType: 'auth.recovery_code', recipient: 'ann@example.com', dedupeKey: 'recovery-code:u1:1', payload: { userId: 'u1' } });
    await processOutbox();
    const code = /letter-spacing:8px[^>]*>\s*([A-Z0-9]{8})\s*</.exec(fakeInbox[0].html)![1];
    expect(JSON.stringify(jobs())).not.toContain(code);
    expect(h.db.user.rows[0].templogincode).toMatch(/^[0-9a-f]{64}$/);
  });

  it('an invitation goes to an invited client; a suspended one is never emailed', async () => {
    h.db.user.rows[0].status = 'INVITED';
    await enqueueEmail(h.db, { eventType: 'client.invitation', recipient: 'ann@example.com', dedupeKey: 'invite:u1', payload: { userId: 'u1' } });
    await processOutbox();
    expect(fakeInbox[0].subject).toMatch(/client portal is ready/);
    expect(fakeInbox[0].html).toContain('Set up your account');

    fakeInbox.length = 0;
    h.db.user.rows[0].status = 'SUSPENDED';
    await enqueueEmail(h.db, { eventType: 'client.invitation', recipient: 'ann@example.com', dedupeKey: 'invite:u1:again', payload: { userId: 'u1' } });
    await processOutbox();
    expect(fakeInbox).toHaveLength(0);
    expect(byType('client.invitation') && jobs().at(-1).status).toBe('SUPPRESSED');
  });
});

describe('what staff can see', () => {
  it('failed and waiting emails are listed with masked recipients and no content', async () => {
    await queueInquiryEmails();
    outage();
    await processOutbox();
    byType('inquiry.confirmation').status = 'DEAD';
    const view = await outboxProblems();
    expect(view.failed).toHaveLength(1);
    expect(view.retrying).toHaveLength(1);
    const text = JSON.stringify(view);
    expect(text).not.toContain('ada@example.com');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('inq1');          // no payload
    expect(view.failed[0].to).toMatch(/^a•+@example\.com$/);
    expect(view.failed[0].label).toBe('Inquiry confirmation to customer');
  });

  it('sanitizeError / maskEmail', () => {
    expect(sanitizeError(new Error('auth failed for ada@example.com with abcdefghijklmnopqrstuvwxyz0123456789ABCDEF'))).toBe('auth failed for [email] with [redacted]');
    expect(sanitizeError('word '.repeat(100))).toHaveLength(200);
    expect(maskEmail('jo@example.com')).toBe('j••@example.com');
    expect(maskEmail('nonsense')).toBe('—');
  });
});
