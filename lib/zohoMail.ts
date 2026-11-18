// Pure helpers for the admin Inbox (reading the Zoho Mail mailbox): configuration, the sign-in URL, encryption of the stored
// refresh token, and turning Zoho's JSON into the small shapes the screen uses. No network or database here, so all of it
// is unit-tested; lib/zohoClient.ts does the talking.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

export const ZOHO_REGIONS = ['com', 'eu', 'in', 'com.au', 'jp'] as const;
export type ZohoRegion = (typeof ZOHO_REGIONS)[number];

/** Read-only: list the account, list its folders, read messages. The site can never send, delete or move mail with these. */
export const ZOHO_SCOPES = ['ZohoMail.accounts.READ', 'ZohoMail.folders.READ', 'ZohoMail.messages.READ'] as const;

export const ZOHO_CALLBACK_PATH = '/api/auth/zoho/callback';
/** Short-lived cookie holding the sign-in `state`; scoped to the callback's folder so it is only sent there. */
export const ZOHO_STATE_COOKIE = 'zoho_oauth_state';
export const ZOHO_STATE_COOKIE_PATH = '/api/auth/zoho';

type Env = Record<string, string | undefined>;

export interface ZohoConfig { clientId: string; clientSecret: string; redirectUri: string; region: ZohoRegion }

export function zohoHosts(region: ZohoRegion) {
  return { accounts: `https://accounts.zoho.${region}`, mail: `https://mail.zoho.${region}` };
}

/** ZOHO_REGION defaults to "com" (US). An unknown value is a configuration error, never silently "com". */
export function readZohoConfig(env: Env, appUrl: string): { ok: true; config: ZohoConfig } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const clientId = (env.ZOHO_CLIENT_ID ?? '').trim();
  const clientSecret = (env.ZOHO_CLIENT_SECRET ?? '').trim();
  if (!clientId) problems.push('ZOHO_CLIENT_ID is not set.');
  if (!clientSecret) problems.push('ZOHO_CLIENT_SECRET is not set.');
  const regionRaw = (env.ZOHO_REGION ?? 'com').trim().toLowerCase() || 'com';
  if (!(ZOHO_REGIONS as readonly string[]).includes(regionRaw)) problems.push(`ZOHO_REGION must be one of ${ZOHO_REGIONS.join(', ')}.`);
  if (problems.length) return { ok: false, problems };
  const redirectUri = (env.ZOHO_REDIRECT_URI ?? '').trim() || `${appUrl.replace(/\/+$/, '')}${ZOHO_CALLBACK_PATH}`;
  return { ok: true, config: { clientId, clientSecret, redirectUri, region: regionRaw as ZohoRegion } };
}

export function authorizeUrl(config: ZohoConfig, state: string): string {
  const u = new URL(`${zohoHosts(config.region).accounts}/oauth/v2/auth`);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', config.clientId);
  u.searchParams.set('scope', ZOHO_SCOPES.join(','));
  u.searchParams.set('redirect_uri', config.redirectUri);
  u.searchParams.set('access_type', 'offline'); // so Zoho issues a refresh token
  u.searchParams.set('prompt', 'consent');      // and issues a NEW one every time an admin connects
  u.searchParams.set('state', state);
  return u.toString();
}

// ── CSRF state for the sign-in round trip ───────────────────────────────────────────────────────────────────────────
export const newState = () => randomBytes(24).toString('base64url');
export function statesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ── Encrypting the refresh token at rest ────────────────────────────────────────────────────────────────────────────
// AES-256-GCM with a key derived (HKDF) from RESET_SECRET under its own label, so it is independent of how that secret is
// used elsewhere. Changing RESET_SECRET makes the stored token unreadable: the Inbox then simply asks to be reconnected.
const keyFor = (secret: string) => Buffer.from(hkdfSync('sha256', secret, 'dreamable.studio', 'zoho-refresh-token-v1', 32));

export function encryptToken(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

export function decryptToken(blob: string, secret: string): string {
  const [v, iv, tag, ct] = blob.split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Stored Zoho token is not in a known format.');
  const d = createDecipheriv('aes-256-gcm', keyFor(secret), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}

// ── Zoho's JSON → what the screen needs ─────────────────────────────────────────────────────────────────────────────
export interface InboxMessage {
  id: string;
  folderId: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  summary: string;
  /** ISO time received, or null if Zoho didn't say. */
  receivedAt: string | null;
  unread: boolean;
  hasAttachment: boolean;
}

/** Zoho ids are long numbers; anything else must never be put into an API path. */
export const isZohoId = (v: unknown): v is string => typeof v === 'string' && /^\d{1,24}$/.test(v);

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };
/** Zoho returns some text HTML-escaped; React escapes again, so undo the first layer. */
export const decodeEntities = (s: string) => s.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m);

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const asArray = (json: unknown): Record<string, unknown>[] => {
  const data = (json as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : [];
};

export function normalizeMessages(json: unknown): InboxMessage[] {
  const out: InboxMessage[] = [];
  for (const m of asArray(json)) {
    const id = str(m.messageId), folderId = str(m.folderId);
    if (!isZohoId(id) || !isZohoId(folderId)) continue; // a row we cannot open is not shown
    const ms = Number(str(m.receivedTime) || str(m.sentDateInGMT));
    const address = decodeEntities(str(m.fromAddress)).trim();
    out.push({
      id, folderId,
      fromName: decodeEntities(str(m.sender)).trim() || address,
      fromAddress: address,
      subject: decodeEntities(str(m.subject)).trim() || '(no subject)',
      summary: decodeEntities(str(m.summary)).replace(/\s+/g, ' ').trim(),
      receivedAt: Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null,
      unread: str(m.status) === '0',
      hasAttachment: str(m.hasAttachment) === '1' || m.hasAttachment === true,
    });
  }
  return out;
}

/** The HTML of one message, or null if the response doesn't have it. */
export function normalizeContent(json: unknown): string | null {
  const content = (json as { data?: { content?: unknown } } | null)?.data?.content;
  return typeof content === 'string' ? content : null;
}

/** The id of the Inbox folder from the "all folders" response. */
export function pickInboxFolderId(json: unknown): string | null {
  const folders = asArray(json);
  const hit = folders.find((f) => str(f.folderType).toLowerCase() === 'inbox') ?? folders.find((f) => str(f.folderName).toLowerCase() === 'inbox');
  const id = hit ? str(hit.folderId) : '';
  return isZohoId(id) ? id : null;
}

/** The first mail account from the "all accounts" response. */
export function pickAccount(json: unknown): { accountId: string; mailbox: string } | null {
  const a = asArray(json)[0];
  if (!a) return null;
  const accountId = str(a.accountId);
  const mailbox = str(a.primaryEmailAddress) || str(a.mailboxAddress) || str(a.incomingUserName) || '';
  return isZohoId(accountId) ? { accountId, mailbox } : null;
}

/** A web link to the mailbox itself (opens Zoho Mail's own inbox). */
export const zohoWebInbox = (region: ZohoRegion) => `https://mail.zoho.${region}/zm/#mail/folder/inbox`;
