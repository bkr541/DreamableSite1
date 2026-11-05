import nodemailer from 'nodemailer';

// The only place that talks to an SMTP server. Which mode applies is decided from the environment, so a
// local machine, a preview deployment or a test run can never email real customers by accident.
//
//   smtp       production only: real delivery over SMTP
//   allowlist  development / preview with EMAIL_DEV_ALLOWLIST set: real delivery, but only to listed
//              addresses (or @domains); everything else is suppressed
//   suppress   development / preview with no allowlist: nothing is sent, the outbox records "suppressed"
//   console    development only (EMAIL_TRANSPORT=console): the message, including any reset link, is printed to the
//              server console so flows can be tried locally. Ignored in production.
//   fake       automated tests: messages are kept in memory (fakeInbox)

export type MailMode = 'smtp' | 'allowlist' | 'suppress' | 'console' | 'fake';
type Env = Record<string, string | undefined>;

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: { name: string; address: string };
  /** Stable per outbox row, so a (rare) duplicate delivery is recognisable by the recipient's mail system. */
  messageId: string;
}

export type MailOutcome = 'sent' | 'suppressed';

export function mailMode(env: Env = process.env): MailMode {
  if (env.NODE_ENV === 'test' || env.EMAIL_TRANSPORT === 'fake') return 'fake';
  if (env.EMAIL_TRANSPORT === 'suppress') return 'suppress';
  const isProduction = env.VERCEL_ENV ? env.VERCEL_ENV === 'production' : env.NODE_ENV === 'production';
  if (isProduction) return 'smtp';
  if (env.EMAIL_TRANSPORT === 'console') return 'console';
  return allowlist(env).length ? 'allowlist' : 'suppress';
}

const allowlist = (env: Env) => (env.EMAIL_DEV_ALLOWLIST ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export function allowedInDev(to: string, env: Env = process.env): boolean {
  const addr = to.toLowerCase();
  return allowlist(env).some((entry) => (entry.startsWith('@') ? addr.endsWith(entry) : addr === entry));
}

export const fakeInbox: MailMessage[] = [];
let injected: ((m: MailMessage) => Promise<void>) | null = null;
/** Tests inject a transport to simulate an SMTP outage and recovery. Pass null to restore the default. */
export function setMailTransport(fn: ((m: MailMessage) => Promise<void>) | null) { injected = fn; }

export const smtpConfigured = (env: Env = process.env) => !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

export function fromAddress(env: Env = process.env) {
  return { name: 'Dreamable.studio', address: env.INQUIRY_FROM_EMAIL || env.SMTP_USER || 'no-reply@dreamable.studio' };
}

async function smtpSend(m: MailMessage, env: Env) {
  if (!smtpConfigured(env)) throw new Error('SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS).');
  const port = Number(env.SMTP_PORT) || 587;
  const from = fromAddress(env);
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST, port, secure: port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    // Bounded, so one dead SMTP server can't hold a serverless function until it is killed.
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  });
  await transporter.sendMail({
    from, to: m.to, replyTo: m.replyTo, subject: m.subject, html: m.html, text: m.text,
    messageId: `<${m.messageId}@${from.address.split('@')[1] ?? 'dreamable.studio'}>`,
  });
}

export async function deliver(m: MailMessage, env: Env = process.env): Promise<MailOutcome> {
  const mode = mailMode(env);
  if (injected) { await injected(m); return 'sent'; }
  switch (mode) {
    case 'fake': fakeInbox.push(m); return 'sent';
    case 'suppress': return 'suppressed';
    case 'console':
      console.info(`\n[email:console] To: ${m.to}\n[email:console] Subject: ${m.subject}\n${m.text}\n`);
      return 'sent';
    case 'allowlist':
      if (!allowedInDev(m.to, env)) return 'suppressed';
      await smtpSend(m, env);
      return 'sent';
    default:
      await smtpSend(m, env);
      return 'sent';
  }
}
