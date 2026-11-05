import { randomBytes } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { deliver, fromAddress, mailMode, smtpConfigured, type MailMessage } from './mailer';
import { buildAdminInquiryEmail, buildConfirmationEmail, type BuiltMail, type InquiryEmailData } from './inquiryEmails';
import { buildInvitationEmail, buildRecoveryCodeEmail, buildResetLinkEmail } from './authEmails';
import { issueResetToken } from './resetTokens';
import { hashRecoveryCode } from './recoveryCode';
import { canUsePasswordFlow } from './accountStatus';
import { notify } from './notifications';
import { canonicalServiceLabel } from './services';
import { logRef, logSecurity } from './securityLog';

// Email is written down before it is sent. The row is created in the same transaction as whatever caused it
// (a saved inquiry, an approved client), so a mail-server outage can delay an email but never lose it.
// A worker then sends due rows, retrying with exponential backoff until it succeeds or gives up (DEAD, which
// raises an admin notification). Nothing here depends on a fire-and-forget promise surviving.

type Db = PrismaClient | Prisma.TransactionClient;

export type EmailEvent = 'inquiry.notification' | 'inquiry.confirmation' | 'auth.reset_link' | 'auth.recovery_code' | 'client.invitation';

export const EVENT_LABELS: Record<EmailEvent, string> = {
  'inquiry.notification': 'New inquiry alert to staff',
  'inquiry.confirmation': 'Inquiry confirmation to customer',
  'auth.reset_link': 'Password reset link',
  'auth.recovery_code': 'Password reset code',
  'client.invitation': 'Client portal invitation',
};

export const MAX_ATTEMPTS = 8;
const LOCK_SECONDS = 120;
/** Wait after the Nth failed attempt: 1m, 5m, 20m, 1h, 3h, 6h, 12h. */
const BACKOFF = [60, 300, 1200, 3600, 10_800, 21_600, 43_200];
export const backoffSeconds = (attemptsMade: number) => BACKOFF[Math.min(Math.max(attemptsMade, 1), BACKOFF.length) - 1];

export interface EnqueueInput {
  eventType: EmailEvent;
  recipient: string;
  /** Same key = same email. Include whatever makes this send distinct (e.g. the inquiry id). */
  dedupeKey: string;
  /** References only (ids). Never a token, a code or a password. */
  payload?: Record<string, string>;
  entityType?: string;
  entityId?: string;
}

/** Pass the transaction client to make the email exist if and only if the surrounding change commits. */
export async function enqueueEmail(db: Db, jobs: EnqueueInput | EnqueueInput[]): Promise<void> {
  const list = Array.isArray(jobs) ? jobs : [jobs];
  await db.emailOutbox.createMany({
    data: list.map((j) => ({
      eventType: j.eventType, recipient: j.recipient, dedupeKey: j.dedupeKey,
      payload: (j.payload ?? {}) as Prisma.InputJsonValue, entityType: j.entityType ?? null, entityId: j.entityId ?? null,
      maxAttempts: MAX_ATTEMPTS,
    })),
    skipDuplicates: true,
  });
}

/** A short, secret-free description of a failure, safe to store and to show to staff. */
export function sanitizeError(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err);
  for (const secret of [process.env.SMTP_PASS, process.env.SMTP_USER]) if (secret && secret.length > 3) msg = msg.split(secret).join('[redacted]');
  return msg
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/\b[A-Za-z0-9_\-+/=]{32,}\b/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'Unknown error';
}

export function maskEmail(address: string): string {
  const [local, domain] = address.split('@');
  if (!domain) return '—';
  return `${local.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(local.length - 1, 5)))}@${domain}`;
}

class Suppress extends Error {}

const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const genCode = () => Array.from(randomBytes(8), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 36]).join('');

interface Job { id: string; eventType: string; recipient: string; payload: unknown; attempts: number; maxAttempts: number }

/** Builds the email for a job from current data. Secrets (links, codes) are created here, at send time. */
async function render(job: Job): Promise<{ to: string; mail: BuiltMail }> {
  const p = (job.payload ?? {}) as Record<string, string>;

  if (job.eventType === 'inquiry.notification' || job.eventType === 'inquiry.confirmation') {
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: p.inquiryId },
      select: {
        id: true, name: true, email: true, company: true, website: true, service: true, description: true, budgetRange: true, timeline: true,
        metadata: true, utmSource: true, utmMedium: true, utmCampaign: true, utmTerm: true, utmContent: true, referrer: true,
        attachments: { where: { status: 'READY' }, select: { fileName: true, size: true } },
      },
    });
    if (!inquiry) throw new Suppress('the inquiry no longer exists');
    const meta = (inquiry.metadata ?? {}) as { phone?: string; projectName?: string };

    if (job.eventType === 'inquiry.confirmation') {
      return { to: inquiry.email, mail: buildConfirmationEmail(inquiry.name, meta.projectName ?? null) };
    }
    const data: InquiryEmailData = {
      inquiryId: inquiry.id, name: inquiry.name, email: inquiry.email, company: inquiry.company, website: inquiry.website, service: canonicalServiceLabel(inquiry.service),
      description: inquiry.description, budgetRange: inquiry.budgetRange, timeline: inquiry.timeline, phone: meta.phone ?? null, projectName: meta.projectName ?? null,
      utmSource: inquiry.utmSource, utmMedium: inquiry.utmMedium, utmCampaign: inquiry.utmCampaign, utmTerm: inquiry.utmTerm, utmContent: inquiry.utmContent,
      referrer: inquiry.referrer, storedAttachments: inquiry.attachments.map((a) => ({ name: a.fileName, size: a.size })),
    };
    const to = process.env.INQUIRY_TO_EMAIL || (job.recipient.includes('@') ? job.recipient : '');
    // Only a real-delivery environment needs the staff inbox to be configured; elsewhere nothing is sent anyway.
    if (!to && ['smtp', 'allowlist'].includes(mailMode())) throw new Error('INQUIRY_TO_EMAIL is not configured.');
    return { to: to || 'staff-inbox@example.invalid', mail: buildAdminInquiryEmail(data) };
  }

  const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { id: true, name: true, email: true, status: true } });
  // Each email is only valid for the state it was written for: invitations for accounts still to be set up, reset
  // links for working accounts, codes for either. A suspended account gets none of them.
  if (!user || !canUsePasswordFlow(user.status)) throw new Suppress('the account is not eligible');
  if (job.eventType === 'client.invitation' && user.status !== 'INVITED') throw new Suppress('the account is already set up');
  if (job.eventType === 'auth.reset_link' && user.status !== 'ACTIVE') throw new Suppress('the account has not been set up yet');

  if (job.eventType === 'auth.recovery_code') {
    const code = genCode();
    await prisma.user.update({ where: { id: user.id }, data: { templogincode: hashRecoveryCode(user.email, code), tempLoginCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    return { to: user.email, mail: buildRecoveryCodeEmail(code) };
  }
  const token = await issueResetToken(user.id, job.eventType === 'client.invitation' ? 'INVITE' : 'RESET');
  const url = `${appUrl()}/portal/reset-password?token=${encodeURIComponent(token)}`;
  return { to: user.email, mail: job.eventType === 'client.invitation' ? buildInvitationEmail(user.name, url) : buildResetLinkEmail(url) };
}

export interface ProcessResult { sent: number; retry: number; dead: number; suppressed: number }

/**
 * Sends due emails. Safe to run from several places at once (a request, the cron, an admin's Retry): each row is
 * claimed with a compare-and-set update, so only one worker ever owns it, and a worker that dies mid-send simply
 * lets its claim expire. SENT is terminal — a sent email is never sent again.
 */
export async function processOutbox(opts: { limit?: number; now?: Date; ids?: string[] } = {}): Promise<ProcessResult> {
  const now = opts.now ?? new Date();
  const result: ProcessResult = { sent: 0, retry: 0, dead: 0, suppressed: 0 };

  const due = await prisma.emailOutbox.findMany({
    where: {
      ...(opts.ids ? { id: { in: opts.ids } } : {}),
      OR: [
        { status: { in: ['PENDING', 'RETRY'] }, nextAttemptAt: { lte: now } },
        { status: 'SENDING', lockedUntil: { lt: now } },
      ],
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: opts.limit ?? 10,
  });

  for (const candidate of due) {
    const claimed = await prisma.emailOutbox.updateMany({
      where: { id: candidate.id, status: candidate.status, attempts: candidate.attempts },
      data: { status: 'SENDING', lockedUntil: new Date(now.getTime() + LOCK_SECONDS * 1000), attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue; // another worker got it

    const job: Job = { ...candidate, attempts: candidate.attempts + 1 };
    try {
      const { to, mail } = await render(job);
      const message: MailMessage = { to, subject: mail.subject, html: mail.html, text: mail.text, replyTo: mail.replyTo, messageId: `outbox-${job.id}` };
      const outcome = await deliver(message);
      await prisma.emailOutbox.updateMany({
        where: { id: job.id, status: 'SENDING' },
        data: outcome === 'sent'
          ? { status: 'SENT', sentAt: new Date(), lockedUntil: null, lastError: null }
          : { status: 'SUPPRESSED', lockedUntil: null, lastError: 'Not sent: this environment does not deliver to real recipients.' },
      });
      outcome === 'sent' ? result.sent++ : result.suppressed++;
    } catch (err) {
      if (err instanceof Suppress) {
        await prisma.emailOutbox.updateMany({ where: { id: job.id, status: 'SENDING' }, data: { status: 'SUPPRESSED', lockedUntil: null, lastError: `Not sent: ${err.message}.` } });
        result.suppressed++;
        continue;
      }
      const message = sanitizeError(err);
      if (job.attempts >= job.maxAttempts) {
        await prisma.emailOutbox.updateMany({ where: { id: job.id, status: 'SENDING' }, data: { status: 'DEAD', lockedUntil: null, lastError: message } });
        result.dead++;
        await alertDead(job, message);
      } else {
        const wait = backoffSeconds(job.attempts) * (0.9 + Math.random() * 0.2);
        await prisma.emailOutbox.updateMany({ where: { id: job.id, status: 'SENDING' }, data: { status: 'RETRY', lockedUntil: null, lastError: message, nextAttemptAt: new Date(Date.now() + wait * 1000) } });
        result.retry++;
        logSecurity('email.retry_scheduled', { emailEvent: job.eventType, job: logRef(job.id), attempt: job.attempts, ofMax: job.maxAttempts, inSec: Math.round(wait) });
      }
    }
  }
  return result;
}

/** Gives staff something to see (the feed) and something to alert on (an alert-level log line). */
async function alertDead(job: Job, error: string) {
  logSecurity('email.gave_up', { emailEvent: job.eventType, job: logRef(job.id), attempts: job.attempts, error }, 'alert');
  try {
    const row = await prisma.emailOutbox.findUnique({ where: { id: job.id }, select: { manualRetries: true, entityType: true, entityId: true } });
    await notify(prisma, {
      type: 'email.failed',
      title: `Email could not be delivered: ${EVENT_LABELS[job.eventType as EmailEvent] ?? job.eventType}`,
      body: `Gave up after ${job.attempts} attempts. ${error}`,
      entityType: 'email_outbox', entityId: job.id, url: '/admin?view=notifications',
      dedupeKey: `email.failed:${job.id}:${row?.manualRetries ?? 0}`,
    });
  } catch (err) {
    console.error('[emailOutbox] could not record failure notification', err instanceof Error ? err.message : err);
  }
}

/** Puts a failed (or waiting) email back in the queue right now. A SENT email can't be retried. */
export async function retryEmail(id: string): Promise<boolean> {
  const { count } = await prisma.emailOutbox.updateMany({
    where: { id, status: { in: ['DEAD', 'RETRY'] } },
    data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), lockedUntil: null, manualRetries: { increment: 1 } },
  });
  return count === 1;
}

export async function retryAllFailed(limit = 50): Promise<string[]> {
  const rows = await prisma.emailOutbox.findMany({ where: { status: 'DEAD' }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true } });
  const ids: string[] = [];
  for (const r of rows) if (await retryEmail(r.id)) ids.push(r.id);
  return ids;
}

/** What staff see: problems only, with recipients masked and no payloads. */
export async function outboxProblems() {
  const [dead, retrying, stuck] = await Promise.all([
    prisma.emailOutbox.findMany({ where: { status: 'DEAD' }, orderBy: { createdAt: 'desc' }, take: 25 }),
    prisma.emailOutbox.findMany({ where: { status: 'RETRY' }, orderBy: { nextAttemptAt: 'asc' }, take: 25 }),
    prisma.emailOutbox.count({ where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } } }),
  ]);
  const view = (r: (typeof dead)[number]) => ({
    id: r.id, eventType: r.eventType, label: EVENT_LABELS[r.eventType as EmailEvent] ?? r.eventType, to: maskEmail(r.recipient), status: r.status,
    attempts: r.attempts, maxAttempts: r.maxAttempts, nextAttemptAt: r.nextAttemptAt.toISOString(), lastError: r.lastError, createdAt: r.createdAt.toISOString(),
  });
  return { failed: dead.map(view), retrying: retrying.map(view), stuckPending: stuck, mode: mailMode(), smtpConfigured: smtpConfigured(), from: fromAddress().address };
}
