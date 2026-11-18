import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { ZohoApiError, ZohoAuthError, listInbox, loadConnection, zohoConfig } from '@/lib/zohoClient';
import { zohoWebInbox, type InboxMessage, type ZohoRegion } from '@/lib/zohoMail';

type InboxState =
  | { ok: true; state: 'not_configured'; problems: string[] }
  | { ok: true; state: 'needs_database' }
  | { ok: true; state: 'not_connected' }
  | { ok: true; state: 'reconnect'; mailbox: string }
  | { ok: true; state: 'connected'; mailbox: string; webUrl: string; messages: InboxMessage[]; nextStart: number | null };

const noStore = { 'Cache-Control': 'no-store' };
const json = (body: InboxState | { ok: false; error: string }, status = 200) => NextResponse.json(body, { status, headers: noStore });

// The admin Inbox: recent mail from the connected Zoho mailbox, read live (nothing is stored). Admin only.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const cfg = zohoConfig();
  if (!cfg.ok) return json({ ok: true, state: 'not_configured', problems: cfg.problems });

  try {
    const { connection, tableMissing } = await loadConnection();
    if (tableMissing) return json({ ok: true, state: 'needs_database' });
    if (!connection) return json({ ok: true, state: 'not_connected' });

    const params = req.nextUrl.searchParams;
    const start = Math.max(1, Math.floor(Number(params.get('start'))) || 1);
    const limit = Math.min(50, Math.max(1, Math.floor(Number(params.get('limit'))) || 25));
    try {
      const { messages, nextStart } = await listInbox(connection, cfg.config, start, limit);
      return json({ ok: true, state: 'connected', mailbox: connection.mailboxAddress, webUrl: zohoWebInbox(cfg.config.region as ZohoRegion), messages, nextStart });
    } catch (err) {
      if (err instanceof ZohoAuthError) return json({ ok: true, state: 'reconnect', mailbox: connection.mailboxAddress });
      throw err;
    }
  } catch (err) {
    if (err instanceof ZohoApiError) return json({ ok: false, error: err.message }, 502);
    console.error('[admin/inbox]', err instanceof Error ? `${err.name}: ${err.message}` : 'unknown error');
    return json({ ok: false, error: 'Could not load the inbox.' }, 500);
  }
}
