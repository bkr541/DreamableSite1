import { describe, expect, it } from 'vitest';
import {
  ZOHO_SCOPES, authorizeUrl, decodeEntities, decryptToken, encryptToken, isZohoId, newState, normalizeContent, normalizeMessages,
  pickAccount, pickInboxFolderId, readZohoConfig, statesMatch, zohoHosts,
} from '@/lib/zohoMail';

const secret = 'a'.repeat(40);

describe('configuration', () => {
  it('needs the client id and secret, defaults to the US data centre and builds the callback from APP_URL', () => {
    const r = readZohoConfig({ ZOHO_CLIENT_ID: ' id ', ZOHO_CLIENT_SECRET: 'sec' }, 'https://dreamable.studio/');
    expect(r).toEqual({ ok: true, config: { clientId: 'id', clientSecret: 'sec', region: 'com', redirectUri: 'https://dreamable.studio/api/auth/zoho/callback' } });
  });
  it('lists what is missing, and rejects an unknown region rather than guessing', () => {
    expect(readZohoConfig({}, 'https://x.co')).toEqual({ ok: false, problems: ['ZOHO_CLIENT_ID is not set.', 'ZOHO_CLIENT_SECRET is not set.'] });
    const bad = readZohoConfig({ ZOHO_CLIENT_ID: 'a', ZOHO_CLIENT_SECRET: 'b', ZOHO_REGION: 'mars' }, 'https://x.co');
    expect(bad.ok).toBe(false);
  });
  it('honours the region and an explicit redirect override', () => {
    const r = readZohoConfig({ ZOHO_CLIENT_ID: 'a', ZOHO_CLIENT_SECRET: 'b', ZOHO_REGION: 'EU', ZOHO_REDIRECT_URI: 'https://z.co/cb' }, 'https://x.co');
    expect(r.ok && r.config).toMatchObject({ region: 'eu', redirectUri: 'https://z.co/cb' });
    expect(zohoHosts('eu')).toEqual({ accounts: 'https://accounts.zoho.eu', mail: 'https://mail.zoho.eu' });
  });
});

describe('sign-in URL', () => {
  it('asks only for read access, offline, with a state and the exact registered callback', () => {
    const cfg = { clientId: 'CID', clientSecret: 'S', region: 'com' as const, redirectUri: 'https://dreamable.studio/api/auth/zoho/callback' };
    const u = new URL(authorizeUrl(cfg, 'STATE123'));
    expect(u.origin + u.pathname).toBe('https://accounts.zoho.com/oauth/v2/auth');
    expect(u.searchParams.get('client_id')).toBe('CID');
    expect(u.searchParams.get('redirect_uri')).toBe('https://dreamable.studio/api/auth/zoho/callback');
    expect(u.searchParams.get('access_type')).toBe('offline');
    expect(u.searchParams.get('state')).toBe('STATE123');
    const scopes = u.searchParams.get('scope')!.split(',');
    expect(scopes).toEqual([...ZOHO_SCOPES]);
    expect(scopes.every((s) => s.endsWith('.READ'))).toBe(true); // never write access
    expect(u.toString()).not.toContain('S&'); // the client secret is never in the URL
  });
  it('state values are unique, and compared safely', () => {
    expect(newState()).not.toBe(newState());
    const s = newState();
    expect(statesMatch(s, s)).toBe(true);
    expect(statesMatch(s, s.slice(0, -1) + (s.endsWith('a') ? 'b' : 'a'))).toBe(false);
    expect(statesMatch(null, s)).toBe(false);
    expect(statesMatch('', '')).toBe(false);
  });
});

describe('the stored refresh token', () => {
  it('round-trips, is not readable in the database, and differs every time it is encrypted', () => {
    const blob = encryptToken('1000.abcdef.refresh', secret);
    expect(blob).not.toContain('1000.abcdef');
    expect(blob.startsWith('v1.')).toBe(true);
    expect(decryptToken(blob, secret)).toBe('1000.abcdef.refresh');
    expect(encryptToken('1000.abcdef.refresh', secret)).not.toBe(blob);
  });
  it('refuses a tampered blob or the wrong secret', () => {
    const blob = encryptToken('tok', secret);
    const parts = blob.split('.');
    parts[3] = Buffer.from('evil').toString('base64url');
    expect(() => decryptToken(parts.join('.'), secret)).toThrow();
    expect(() => decryptToken(blob, 'b'.repeat(40))).toThrow();
    expect(() => decryptToken('garbage', secret)).toThrow();
  });
});

describe('reading Zoho responses', () => {
  const list = { status: { code: 200 }, data: [
    { messageId: '1700000000001', folderId: '555', sender: 'Jane &amp; Co', fromAddress: 'jane@acme.com', subject: 'Re: Logo &lt;v2&gt;', summary: 'Hi   there\nthanks', receivedTime: '1762300800000', status: '0', hasAttachment: '1' },
    { messageId: '1700000000002', folderId: '555', sender: '', fromAddress: 'bob@x.co', subject: '', summary: '', receivedTime: 'nope', status: '1', hasAttachment: '0' },
    { messageId: '../etc/passwd', folderId: '555', subject: 'bad id' },
    { folderId: '555' },
    null,
  ] };
  it('turns messages into the shape the screen uses, decoding text and skipping rows it cannot open', () => {
    const [a, b, ...rest] = normalizeMessages(list);
    expect(rest).toEqual([]);
    expect(a).toEqual({ id: '1700000000001', folderId: '555', fromName: 'Jane & Co', fromAddress: 'jane@acme.com', subject: 'Re: Logo <v2>', summary: 'Hi there thanks', receivedAt: '2025-11-05T00:00:00.000Z', unread: true, hasAttachment: true });
    expect(b).toMatchObject({ fromName: 'bob@x.co', subject: '(no subject)', receivedAt: null, unread: false, hasAttachment: false });
  });
  it('copes with an empty or malformed response', () => {
    expect(normalizeMessages(null)).toEqual([]);
    expect(normalizeMessages({ data: 'x' })).toEqual([]);
    expect(normalizeContent({ data: { content: '<p>hi</p>' } })).toBe('<p>hi</p>');
    expect(normalizeContent({ data: {} })).toBeNull();
  });
  it('finds the Inbox folder and the mail account', () => {
    expect(pickInboxFolderId({ data: [{ folderId: '1', folderType: 'Sent' }, { folderId: '2', folderType: 'Inbox', folderName: 'Inbox' }] })).toBe('2');
    expect(pickInboxFolderId({ data: [{ folderId: '9', folderName: 'inbox' }] })).toBe('9');
    expect(pickInboxFolderId({ data: [{ folderId: '1', folderType: 'Sent' }] })).toBeNull();
    expect(pickAccount({ data: [{ accountId: '12345', primaryEmailAddress: 'kody@dreamable.studio' }] })).toEqual({ accountId: '12345', mailbox: 'kody@dreamable.studio' });
    expect(pickAccount({ data: [] })).toBeNull();
    expect(pickAccount({ data: [{ accountId: 'abc' }] })).toBeNull();
  });
  it('only treats plain numbers as Zoho ids (they go into API paths)', () => {
    expect(isZohoId('1700000000001')).toBe(true);
    for (const bad of ['', '12/34', '../1', '1 2', 'abc', '1'.repeat(30), 5, null]) expect(isZohoId(bad)).toBe(false);
    expect(decodeEntities('a &amp;amp; b')).toBe('a &amp; b');
  });
});
