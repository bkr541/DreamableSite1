import { beforeEach, describe, expect, it, vi } from 'vitest';

const smtp = vi.hoisted(() => ({ created: vi.fn(), sent: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: (o: unknown) => { smtp.created(o); return { sendMail: async (m: unknown) => { smtp.sent(m); } }; } } }));

import { allowedInDev, deliver, mailMode, fakeInbox, type MailMessage } from '@/lib/mailer';

const SMTP = { SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u', SMTP_PASS: 'p' };
const msg = (to: string): MailMessage => ({ to, subject: 's', html: '<p>x</p>', text: 'x', messageId: 'outbox-1' });

beforeEach(() => { smtp.created.mockClear(); smtp.sent.mockClear(); fakeInbox.length = 0; });

describe('which environment may send real email', () => {
  it.each([
    [{ NODE_ENV: 'test' }, 'fake'],
    [{ NODE_ENV: 'production', EMAIL_TRANSPORT: 'fake' }, 'fake'],
    [{ NODE_ENV: 'production' }, 'smtp'],
    [{ NODE_ENV: 'production', VERCEL_ENV: 'production' }, 'smtp'],
    [{ NODE_ENV: 'production', VERCEL_ENV: 'preview' }, 'suppress'],           // a preview deployment is not production
    [{ NODE_ENV: 'production', VERCEL_ENV: 'preview', EMAIL_DEV_ALLOWLIST: 'me@x.co' }, 'allowlist'],
    [{ NODE_ENV: 'development' }, 'suppress'],
    [{ NODE_ENV: 'development', EMAIL_DEV_ALLOWLIST: 'me@x.co' }, 'allowlist'],
    [{ NODE_ENV: 'production', EMAIL_TRANSPORT: 'suppress' }, 'suppress'],
    [{ NODE_ENV: 'development', EMAIL_TRANSPORT: 'console' }, 'console'],
    [{ NODE_ENV: 'production', EMAIL_TRANSPORT: 'console' }, 'smtp'],            // can never print mail contents in production
  ])('%j → %s', (env, mode) => {
    expect(mailMode(env)).toBe(mode);
  });

  it('allowlist entries match an address or a whole @domain, case-insensitively', () => {
    const env = { EMAIL_DEV_ALLOWLIST: 'Me@Example.com, @team.example' };
    expect(allowedInDev('me@example.com', env)).toBe(true);
    expect(allowedInDev('anyone@team.example', env)).toBe(true);
    expect(allowedInDev('customer@gmail.com', env)).toBe(false);
    expect(allowedInDev('x@evilteam.example', env)).toBe(false);
  });
});

describe('delivery', () => {
  it('development with SMTP configured still never emails a customer', async () => {
    expect(await deliver(msg('customer@gmail.com'), { NODE_ENV: 'development', ...SMTP })).toBe('suppressed');
    expect(smtp.created).not.toHaveBeenCalled();
  });
  it('a preview deployment with production SMTP keys still does not', async () => {
    expect(await deliver(msg('customer@gmail.com'), { NODE_ENV: 'production', VERCEL_ENV: 'preview', ...SMTP })).toBe('suppressed');
    expect(smtp.created).not.toHaveBeenCalled();
  });
  it('the allowlist lets a developer receive real mail, and only them', async () => {
    const env = { NODE_ENV: 'development', EMAIL_DEV_ALLOWLIST: 'dev@example.com', INQUIRY_FROM_EMAIL: 'hello@example.com', ...SMTP };
    expect(await deliver(msg('dev@example.com'), env)).toBe('sent');
    expect(await deliver(msg('customer@gmail.com'), env)).toBe('suppressed');
    expect(smtp.sent).toHaveBeenCalledTimes(1);
    expect(smtp.sent.mock.calls[0][0]).toMatchObject({ to: 'dev@example.com', messageId: '<outbox-1@example.com>' });
  });
  it('tests keep messages in memory', async () => {
    expect(await deliver(msg('customer@gmail.com'), { NODE_ENV: 'test', ...SMTP })).toBe('sent');
    expect(smtp.created).not.toHaveBeenCalled();
    expect(fakeInbox).toHaveLength(1);
  });
  it('production sends over SMTP with bounded timeouts, and fails loudly if SMTP is not configured', async () => {
    expect(await deliver(msg('customer@gmail.com'), { NODE_ENV: 'production', ...SMTP, INQUIRY_FROM_EMAIL: 'hello@dreamable.studio' })).toBe('sent');
    expect(smtp.created.mock.calls[0][0]).toMatchObject({ connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
    await expect(deliver(msg('customer@gmail.com'), { NODE_ENV: 'production' })).rejects.toThrow(/SMTP is not configured/);
  });
});
