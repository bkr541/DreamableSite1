// The one branded frame every outgoing "message" email uses: logo header, content card, optional button, footer.
// Email HTML is its own dialect: table layout, inline styles only, ~600px wide, absolute image URLs. Pure (no server
// imports), so the admin's live preview and the server use exactly the same code.
import { escapeHtml, multilineHtml } from './html';

const NAVY = '#1a2030';
const INDIGO = '#4f6df5';

export interface EmailLayoutInput {
  /** The big heading inside the card. */
  title: string;
  /** The grey line some inboxes show next to the subject. Not visible in the email itself. */
  preheader?: string;
  /** Trusted HTML for the body. Build it with paragraphs() so any typed text is escaped. */
  bodyHtml: string;
  button?: { label: string; url: string } | null;
  /** The site's public address (APP_URL), for the logo. */
  baseUrl: string;
}

/** Only web links are allowed in a button: no javascript:, data: or relative addresses. */
export const safeHref = (url: string): string | null => {
  const v = (url ?? '').trim();
  return /^https?:\/\/[^\s"'<>]+$/i.test(v) ? v : null;
};

/** Typed text as paragraphs: a blank line starts a new paragraph, a single line break stays a line break. Everything is escaped. */
export function paragraphs(text: string): string {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#444b5c;">${multilineHtml(p)}</p>`)
    .join('');
}

export function renderEmail({ title, preheader, bodyHtml, button, baseUrl }: EmailLayoutInput): string {
  const href = button ? safeHref(button.url) : null;
  const logo = `${baseUrl.replace(/\/+$/, '')}/images/logo.png`;
  const btn = button && href && button.label.trim()
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px;"><tr><td align="center" bgcolor="${NAVY}" style="border-radius:999px;background:${NAVY};"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(button.label.trim())}</a></td></tr></table>`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f9;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5f9" style="background:#f4f5f9;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <tr><td style="padding:0 8px 20px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:10px;"><img src="${escapeHtml(logo)}" width="36" alt="" style="display:block;border:0;height:auto;"></td>
        <td style="font-size:17px;font-weight:700;color:${NAVY};letter-spacing:-0.2px;">Dreamable<span style="color:#999;">.</span>studio</td>
      </tr></table>
    </td></tr>
    <tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:16px;border-top:4px solid ${INDIGO};padding:36px 36px 28px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
      <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;font-weight:700;color:${NAVY};">${escapeHtml(title)}</h1>
      ${bodyHtml}
      ${btn}
    </td></tr>
    <tr><td style="padding:20px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8a90a0;text-align:center;">
      Dreamable.studio &middot; Reply to this email and it comes straight to us.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
