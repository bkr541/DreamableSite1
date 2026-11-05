import { escapeHtml } from './html';
import type { BuiltMail } from './inquiryEmails';

const shell = (inner: string) =>
  `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">${inner}</div>`;

const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 32px;background:#1a2030;color:#fff;border-radius:999px;text-decoration:none;font-size:14px;font-weight:500;">${escapeHtml(label)}</a>`;

export function buildResetLinkEmail(resetUrl: string): BuiltMail {
  return {
    subject: 'Reset your Dreamable.studio password',
    html: shell(`
        <h2 style="font-size:22px;font-weight:600;margin-bottom:16px;">Reset your password</h2>
        <p style="color:#555;line-height:1.6;margin-bottom:28px;">
          We received a request to reset the password for your Dreamable.studio account.
          Click the button below to choose a new password. This link works once and expires in 1 hour.
        </p>
        ${button(resetUrl, 'Reset Password')}
        <p style="color:#aaa;font-size:12px;margin-top:32px;line-height:1.6;">
          If you didn&apos;t request this, you can safely ignore this email.
          Your password will not change until you click the link above.
        </p>`),
    text: `Reset your Dreamable.studio password (link works once, expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
  };
}

export function buildRecoveryCodeEmail(code: string): BuiltMail {
  return {
    subject: 'Your Dreamable.studio verification code',
    html: shell(`
        <h2 style="font-size:22px;font-weight:600;margin-bottom:16px;">Password reset code</h2>
        <p style="color:#555;line-height:1.6;margin-bottom:28px;">
          Use the code below to reset your Dreamable.studio password. This code is single-use and expires in 10 minutes.
        </p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:24px;background:#f5f5f7;border-radius:12px;margin-bottom:28px;">${escapeHtml(code)}</div>
        <p style="color:#aaa;font-size:12px;line-height:1.6;">If you didn&apos;t request this, you can safely ignore this email.</p>`),
    text: `Your Dreamable.studio verification code: ${code}\nIt is single-use and expires in 10 minutes. If you didn't request it, ignore this email.`,
  };
}

export function buildInvitationEmail(name: string, setupUrl: string): BuiltMail {
  const first = escapeHtml(name.trim().split(/\s+/)[0] || 'there');
  return {
    subject: 'Your Dreamable.studio client portal is ready',
    html: shell(`
        <h2 style="font-size:22px;font-weight:600;margin-bottom:16px;">Welcome, ${first}!</h2>
        <p style="color:#555;line-height:1.6;margin-bottom:28px;">
          Your Dreamable.studio client portal is ready. Choose a password to sign in and see your project and files.
          This link works once and expires in 7 days — if it expires, ask us to send a new invitation or use &ldquo;Forgot password&rdquo; on the sign-in page.
        </p>
        ${button(setupUrl, 'Set up your account')}
        <p style="color:#aaa;font-size:12px;margin-top:32px;line-height:1.6;">If you weren&apos;t expecting this, you can ignore this email.</p>`),
    text: `Your Dreamable.studio client portal is ready. Choose a password (link works once, expires in 7 days):\n${setupUrl}`,
  };
}
