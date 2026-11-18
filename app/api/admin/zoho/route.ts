import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { forgetCached, loadConnection, revokeRefreshToken, zohoConfig } from '@/lib/zohoClient';

// Disconnects the Inbox: tells Zoho to forget the grant (best effort) and deletes the saved token.
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const { connection } = await loadConnection();
    if (connection) {
      const cfg = zohoConfig();
      if (cfg.ok) await revokeRefreshToken(connection, cfg.config);
      await prisma.$transaction(async (tx) => {
        await tx.zohoConnection.deleteMany({});
        await recordAudit(tx, { actorId: auth.user.id, action: 'zoho.disconnect', targetType: 'zoho_connection', metadata: { mailbox: connection.mailboxAddress } });
      });
    }
    forgetCached();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/zoho disconnect]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'Could not disconnect.' }, { status: 500 });
  }
}
