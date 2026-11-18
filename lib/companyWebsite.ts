// A company's website as an admin types it. Optional; when given it must look like a real address, so "NA" or "tbd"
// doesn't end up in the client's record. Stored exactly as typed (trimmed), e.g. "acme.com" or "https://acme.com".

export const MAX_WEBSITE_LENGTH = 300;
const WEBSITE = /^(https?:\/\/)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(:\d{1,5})?([/?#]\S*)?$/i;

export function normalizeWebsite(input: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== 'string') return { ok: false, error: 'Website must be text.' };
  const v = input.trim();
  if (v === '') return { ok: true, value: null };
  if (v.length > MAX_WEBSITE_LENGTH) return { ok: false, error: `Website must be at most ${MAX_WEBSITE_LENGTH} characters.` };
  if (!WEBSITE.test(v)) return { ok: false, error: 'Enter a website like acme.com or https://acme.com.' };
  return { ok: true, value: v };
}
