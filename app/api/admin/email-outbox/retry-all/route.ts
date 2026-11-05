import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { retryAllFailed } from '@/lib/emailOutbox';
import { dispatchOutbox } from '@/lib/dispatch';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const ids = await retryAllFailed(50);
    if (ids.length) {
      await recordAudit(prisma, { actorId: auth.user.id, action: 'email.retry_all', targetType: 'email_outbox', metadata: { count: ids.length } });
      dispatchOutbox();
    }
    return NextResponse.json({ ok: true, retried: ids.length });
  } catch (err) {
    console.error('[admin/email-outbox retry-all]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
