// Talks to Zoho Mail (read-only) on behalf of the connected admin mailbox. Server-only: it holds the decrypted token in
// memory just long enough to make a request, and never logs a token, a secret or a message body.
import { prisma } from '@/lib/prisma';
import { getResetSecret } from '@/lib/secrets';
import { siteUrl } from '@/lib/site';
import {
  decryptToken, normalizeContent, normalizeMessages, pickAccount, pickInboxFolderId, readZohoConfig, zohoHosts,
  type InboxMessage, type ZohoConfig,
} from '@/lib/zohoMail';

export const zohoConfig = () => readZohoConfig(process.env, siteUrl());

/** Zoho refused our credentials: the admin has to connect again. */
export class ZohoAuthError extends Error { constructor(m = 'Zoho no longer accepts the saved connection.') { super(m); this.name = 'ZohoAuthError'; } }
/** Anything else that went wrong talking to Zoho. The message is safe to show to an admin. */
export class ZohoApiError extends Error { constructor(m: string) { super(m); this.name = 'ZohoApiError'; } }

const TIMEOUT_MS = 12_000;

export interface Connection { id: string; region: string; accountId: string; mailboxAddress: string; refreshTokenEnc: string }

/** The saved connection; `tableMissing` means the SQL for the Inbox hasn't been run yet. */
export async function loadConnection(): Promise<{ connection: Connection | null; tableMissing: boolean }> {
  try {
    const connection = await prisma.zohoConnection.findFirst({ orderBy: { createdAt: 'desc' } });
    return { connection, tableMissing: false };
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2021') return { connection: null, tableMissing: true };
    throw err;
  }
}

const accessTokens = new Map<string, { token: string; expiresAt: number }>();
const inboxFolders = new Map<string, string>();
export function forgetCached(connectionId?: string) {
  if (connectionId) { accessTokens.delete(connectionId); inboxFolders.delete(connectionId); } else { accessTokens.clear(); inboxFolders.clear(); }
}

async function tokenRequest(config: ZohoConfig, params: Record<string, string>) {
  let res: Response;
  try {
    res = await fetch(`${zohoHosts(config.region).accounts}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch {
    throw new ZohoApiError('Could not reach Zoho. Try again in a moment.');
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // Zoho reports failures as { error: "invalid_code" } (often with HTTP 200).
  if (typeof json.error === 'string') {
    if (['invalid_code', 'invalid_client', 'invalid_token', 'access_denied'].includes(json.error)) throw new ZohoAuthError(`Zoho rejected the sign-in (${json.error}).`);
    throw new ZohoApiError(`Zoho refused the request (${json.error}).`);
  }
  if (!res.ok) throw new ZohoApiError(`Zoho returned HTTP ${res.status}.`);
  return json;
}

/** Swap the one-time code from the sign-in redirect for tokens. */
export async function exchangeCode(config: ZohoConfig, code: string) {
  const j = await tokenRequest(config, { grant_type: 'authorization_code', code, redirect_uri: config.redirectUri });
  const accessToken = typeof j.access_token === 'string' ? j.access_token : '';
  const refreshToken = typeof j.refresh_token === 'string' ? j.refresh_token : '';
  if (!accessToken || !refreshToken) throw new ZohoApiError('Zoho did not return a refresh token. Remove the app under Zoho → Security → Connected Apps and connect again.');
  return { accessToken, refreshToken, expiresIn: Number(j.expires_in) || 3600 };
}

async function accessTokenFor(conn: Connection, config: ZohoConfig): Promise<string> {
  const hit = accessTokens.get(conn.id);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;
  let refresh: string;
  try { refresh = decryptToken(conn.refreshTokenEnc, getResetSecret()); } catch { throw new ZohoAuthError('The saved Zoho token can no longer be read (RESET_SECRET changed?). Connect again.'); }
  const j = await tokenRequest(config, { grant_type: 'refresh_token', refresh_token: refresh });
  const token = typeof j.access_token === 'string' ? j.access_token : '';
  if (!token) throw new ZohoAuthError();
  accessTokens.set(conn.id, { token, expiresAt: Date.now() + (Number(j.expires_in) || 3600) * 1000 });
  return token;
}

/** GET a Zoho Mail API path with an explicit access token. */
export async function zohoGetWith(token: string, region: ZohoConfig['region'], path: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${zohoHosts(region).mail}${path}`, { headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  } catch {
    throw new ZohoApiError('Could not reach Zoho Mail. Try again in a moment.');
  }
  if (res.status === 401) throw new ZohoAuthError();
  if (res.status === 429) throw new ZohoApiError('Zoho is rate-limiting requests. Wait a minute and try again.');
  if (!res.ok) throw new ZohoApiError(`Zoho Mail returned HTTP ${res.status}.`);
  return res.json().catch(() => { throw new ZohoApiError('Zoho Mail sent a response we could not read.'); });
}

async function zohoGet(conn: Connection, config: ZohoConfig, path: string): Promise<unknown> {
  try {
    return await zohoGetWith(await accessTokenFor(conn, config), config.region, path);
  } catch (err) {
    if (!(err instanceof ZohoAuthError)) throw err;
    accessTokens.delete(conn.id); // the cached token may simply have expired early: one fresh attempt
    return zohoGetWith(await accessTokenFor(conn, config), config.region, path);
  }
}

/** The mailbox's account id and address, using a brand-new access token (used once, when connecting). */
export async function fetchAccount(token: string, region: ZohoConfig['region']) {
  const account = pickAccount(await zohoGetWith(token, region, '/api/accounts'));
  if (!account) throw new ZohoApiError('Zoho returned no mail account for this sign-in.');
  return account;
}

export async function listInbox(conn: Connection, config: ZohoConfig, start: number, limit: number): Promise<{ messages: InboxMessage[]; nextStart: number | null }> {
  let folderId = inboxFolders.get(conn.id);
  if (!folderId) {
    folderId = pickInboxFolderId(await zohoGet(conn, config, `/api/accounts/${conn.accountId}/folders`)) ?? undefined;
    if (!folderId) throw new ZohoApiError('Could not find the Inbox folder in this mailbox.');
    inboxFolders.set(conn.id, folderId);
  }
  const json = await zohoGet(conn, config, `/api/accounts/${conn.accountId}/messages/view?folderId=${folderId}&start=${start}&limit=${limit}&sortBy=date&sortorder=false`);
  const rows = (json as { data?: unknown[] } | null)?.data;
  return { messages: normalizeMessages(json), nextStart: Array.isArray(rows) && rows.length >= limit ? start + limit : null };
}

export async function messageHtml(conn: Connection, config: ZohoConfig, folderId: string, messageId: string): Promise<string> {
  const json = await zohoGet(conn, config, `/api/accounts/${conn.accountId}/folders/${folderId}/messages/${messageId}/content`);
  return normalizeContent(json) ?? '';
}

/** Best effort: tell Zoho to forget the grant. Failure is ignored (the saved token is deleted either way). */
export async function revokeRefreshToken(conn: Connection, config: ZohoConfig) {
  try {
    const refresh = decryptToken(conn.refreshTokenEnc, getResetSecret());
    await fetch(`${zohoHosts(config.region).accounts}/oauth/v2/token/revoke?token=${encodeURIComponent(refresh)}`, { method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch { /* ignore */ }
}
