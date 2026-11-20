// An optional link to a file hosting site (Dropbox, Google Drive, OneDrive, …) where larger deliverables can be downloaded
// from. Used on projects, folders and individual files. Stored as a normalised https/http address; anything else (a
// javascript: or data: address, a link with a password in it, plain words) is refused.

export const MAX_EXTERNAL_LINK_LENGTH = 2000;

export function normalizeExternalLink(input: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== 'string') return { ok: false, error: 'The link must be text.' };
  let v = input.trim();
  if (v === '') return { ok: true, value: null };
  if (v.length > MAX_EXTERNAL_LINK_LENGTH) return { ok: false, error: 'That link is too long.' };
  if (/\s/.test(v)) return { ok: false, error: 'A link can’t contain spaces.' };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = `https://${v}`; // "dropbox.com/s/abc" → "https://dropbox.com/s/abc"
  let url: URL;
  try { url = new URL(v); } catch { return { ok: false, error: 'Enter a full web link, like https://www.dropbox.com/…' }; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, error: 'Only web links (https://…) are allowed.' };
  if (url.username || url.password) return { ok: false, error: 'The link can’t contain a username or password.' };
  if (!url.hostname.includes('.') || /[^a-z0-9.-]/i.test(url.hostname)) return { ok: false, error: 'Enter a full web link, like https://www.dropbox.com/…' };
  return { ok: true, value: url.toString() };
}

const PROVIDERS: [RegExp, string][] = [
  [/(^|\.)dropbox\.com$|(^|\.)dropboxusercontent\.com$/, 'Dropbox'],
  [/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$|(^|\.)drive\.usercontent\.google\.com$/, 'Google Drive'],
  [/(^|\.)onedrive\.live\.com$|(^|\.)1drv\.ms$|(^|\.)sharepoint\.com$/, 'OneDrive'],
  [/(^|\.)icloud\.com$/, 'iCloud'],
  [/(^|\.)wetransfer\.com$|(^|\.)we\.tl$/, 'WeTransfer'],
  [/(^|\.)box\.com$/, 'Box'],
  [/(^|\.)mega\.nz$/, 'MEGA'],
  [/(^|\.)figma\.com$/, 'Figma'],
  [/(^|\.)github\.com$/, 'GitHub'],
];

/** A friendly name for where a link goes: "Dropbox", "Google Drive", or just the site's name. */
export function linkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PROVIDERS.find(([re]) => re.test(host))?.[1] ?? host.replace(/^www\./, '');
  } catch {
    return 'External link';
  }
}
