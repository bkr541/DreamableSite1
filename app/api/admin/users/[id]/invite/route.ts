import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { enqueueEmail } from '@/lib/emailOutbox';
import { dispatchOutbox } from '@/lib/dispatch';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status: number, extra: object = {}) => NextResponse.json({ ok: false, error, ...extra }, { status });

// Sends a client a fresh invitation. Only for someone who still has to set up their account. The new link is
// created when the email is sent, and doing so retires every older invitation, so only the latest one works.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return fail('Client not found.', 404);

  try {
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, status: true, admin: true } });
    if (!user || user.admin) return fail('Client not found.', 404);
    if (user.status === 'ACTIVE') return fail('This client has already set up their account.', 409, { code: 'ACCEPTED' });
    if (user.status !== 'INVITED') return fail('This account is suspended. Restore it before sending an invitation.', 409, { code: 'NOT_INVITABLE' });

    const earlier = await prisma.emailOutbox.findMany({ where: { eventType: 'client.invitation', entityId: id }, orderBy: { createdAt: 'desc' }, take: 50 });
    const latest = earlier[0];
    // Still on its way: answering "ok" without queueing another is what makes repeated clicks harmless.
    if (latest && ['PENDING', 'SENDING', 'RETRY'].includes(latest.status)) return NextResponse.json({ ok: true, alreadyQueued: true });
    if (latest?.status === 'SENT' && latest.sentAt && Date.now() - latest.sentAt.getTime() < 60_000) {
      return fail('An invitation was sent a moment ago. Give it a minute before sending another.', 429);
    }

    await enqueueEmail(prisma, {
      eventType: 'client.invitation', recipient: user.email, dedupeKey: `invite:${id}:r${earlier.length}`,
      payload: { userId: id }, entityType: 'user', entityId: id,
    });
    await recordAudit(prisma, { actorId: auth.user.id, action: 'client.invite_resend', targetType: 'user', targetId: id });
    dispatchOutbox();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/users invite]', err);
    return fail('Internal server error.', 500);
  }
}
