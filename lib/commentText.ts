import { stripControlChars } from './html';

export const MAX_AUTHOR = 80;
export const MAX_COMMENT = 2000;
export const MAX_LINKS = 3;

// Guests can type any name, so names that would pass for the studio or its staff are refused.
// (Everything a guest posts is also labelled "unverified" wherever it is shown.)
const RESERVED = new Set(['admin', 'administrator', 'moderator', 'support', 'staff', 'team', 'owner', 'system', 'official', 'studio']);
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export type Cleaned = { ok: true; value: string } | { ok: false; error: string };

export function cleanAuthorName(raw: unknown): Cleaned {
  if (typeof raw !== 'string') return { ok: false, error: 'Please enter your name.' };
  const value = stripControlChars(raw).replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, error: 'Please enter your name.' };
  if (value.length > MAX_AUTHOR) return { ok: false, error: `Name must be ${MAX_AUTHOR} characters or fewer.` };
  const key = squash(value);
  if (RESERVED.has(key) || key.includes('dreamable')) {
    return { ok: false, error: 'Please use your own name — that one is reserved for the Dreamable.studio team.' };
  }
  return { ok: true, value };
}

export function cleanCommentBody(raw: unknown): Cleaned {
  if (typeof raw !== 'string') return { ok: false, error: 'Please write a comment.' };
  // Keep line breaks, drop every other control character, and stop blank-line padding.
  const value = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => stripControlChars(line).replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!value) return { ok: false, error: 'Please write a comment.' };
  if (value.length > MAX_COMMENT) return { ok: false, error: `Comments must be ${MAX_COMMENT} characters or fewer.` };
  if ((value.match(/(?:https?:\/\/|www\.)\S+/gi) ?? []).length > MAX_LINKS) {
    return { ok: false, error: `Please include at most ${MAX_LINKS} links in a comment.` };
  }
  return { ok: true, value };
}
