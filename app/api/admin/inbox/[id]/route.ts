import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { ZohoApiError, ZohoAuthError, loadConnection, messageHtml, zohoConfig } from '@/lib/zohoClient';
import { isZohoId } from '@/lib/zohoMail';

const noStore = { 'Cache-Control': 'no-store' };

// One message's body. Zoho ids are plain numbers and are checked before they go into an API path. The HTML comes from
// whoever sent the email, so it is only ever displayed inside a locked-down, script-free frame (components/InboxPanel.tsx).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const folderId = req.nextUrl.searchParams.get('folderId');
  if (!isZohoId(id) || !isZohoId(folderId)) return NextResponse.json({ ok: false, error: 'Message not found.' }, { status: 404, headers: noStore });

  const cfg = zohoConfig();
  if (!cfg.ok) return NextResponse.json({ ok: false, error: 'Zoho is not configured.' }, { status: 503, headers: noStore });
  try {
    const { connection } = await loadConnection();
    if (!connection) return NextResponse.json({ ok: false, error: 'The inbox is not connected.' }, { status: 409, headers: noStore });
    const html = await messageHtml(connection, cfg.config, folderId, id);
    return NextResponse.json({ ok: true, html }, { headers: noStore });
  } catch (err) {
    if (err instanceof ZohoAuthError) return NextResponse.json({ ok: false, error: 'The Zoho connection needs to be set up again.' }, { status: 409, headers: noStore });
    if (err instanceof ZohoApiError) return NextResponse.json({ ok: false, error: err.message }, { status: 502, headers: noStore });
    console.error('[admin/inbox message]', err instanceof Error ? `${err.name}: ${err.message}` : 'unknown error');
    return NextResponse.json({ ok: false, error: 'Could not load the message.' }, { status: 500, headers: noStore });
  }
}
