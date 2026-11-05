import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { retryEmail } from '@/lib/emailOutbox';
import { dispatchOutbox } from '@/lib/dispatch';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only a failed or waiting email can be retried; one that was SENT never can, so a retry can't cause a duplicate.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: 'Email not found.' }, { status: 404 });

  try {
    if (!(await retryEmail(id))) return NextResponse.json({ ok: false, error: 'Only a failed or waiting email can be retried.' }, { status: 409 });
    await recordAudit(prisma, { actorId: auth.user.id, action: 'email.retry', targetType: 'email_outbox', targetId: id });
    dispatchOutbox();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/email-outbox retry]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
