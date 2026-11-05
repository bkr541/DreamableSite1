// Everything that puts visitor-supplied text into an email goes through here.

// C0/C1 controls (CR, LF, NUL, ESC …), line/paragraph separators and bidi overrides.
const BLOCKED: [number, number][] = [[0x00, 0x1f], [0x7f, 0x9f], [0x200e, 0x200f], [0x2028, 0x2029], [0x202a, 0x202e], [0x2066, 0x2069]];

export function stripControlChars(v: string, replacement = ' '): string {
  let out = '';
  for (const ch of v) {
    const cp = ch.codePointAt(0) as number;
    out += BLOCKED.some(([a, b]) => cp >= a && cp <= b) ? replacement : ch;
  }
  return out;
}

/** Text for an HTML body. Escapes once; do not call on already-escaped text. */
export const escapeHtml = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');

/** Multi-line text as HTML: escaped first, then line breaks inserted by trusted code. */
export const multilineHtml = (v: unknown): string =>
  escapeHtml(String(v ?? '').replace(/\r\n?/g, '\n')).replace(/\n/g, '<br>');

/**
 * Text for a header value (subject, display name): control characters — including CR/LF, which are what
 * header injection needs — and bidi overrides are removed, whitespace collapsed, length bounded.
 */
export function headerText(v: unknown, max = 120): string {
  return stripControlChars(String(v ?? '')).replace(/\s+/g, ' ').trim().slice(0, max);
}

const ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

/** A plain mailbox address or null. No display names, quotes, angle brackets, commas, spaces or control characters. */
export function safeEmailAddress(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length <= 254 && ADDRESS.test(s) && !s.includes('..') ? s : null;
}
