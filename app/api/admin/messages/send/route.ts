import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { enqueueEmail } from '@/lib/emailOutbox';
import { dispatchOutbox } from '@/lib/dispatch';
import { headerText, safeEmailAddress } from '@/lib/html';
import { htmlToText } from '@/lib/emailText';

const MAX_HTML = 200_000;

// Sends one email written in Message Hub → Templates. Admin only. Like every other email it goes through the outbox (so it
// is retried if the mail server is down, and shows up in Notifications if it can't be delivered), never straight to SMTP.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const to = safeEmailAddress(body.to);
  const subject = headerText(body.subject, 200);
  const html = typeof body.html === 'string' ? body.html : '';
  const template = typeof body.template === 'string' ? headerText(body.template, 60) : '';

  const fail = (field: string, error: string) => NextResponse.json({ ok: false, field, error }, { status: 422 });
  if (!to) return fail('to', 'Enter a valid email address.');
  if (!subject) return fail('subject', 'Enter a subject.');
  if (!html.trim()) return fail('html', 'The message is empty.');
  if (html.length > MAX_HTML) return fail('html', 'The message is too long.');

  try {
    await prisma.$transaction(async (tx) => {
      await enqueueEmail(tx, {
        eventType: 'admin.message', recipient: to, dedupeKey: `admin:${randomUUID()}`,
        payload: { subject, html, text: htmlToText(html).slice(0, 50_000) },
        entityType: 'admin_message',
      });
      await recordAudit(tx, { actorId: auth.user.id, action: 'email.admin_send', targetType: 'email', metadata: { to, subject, template: template || null } });
    });
    dispatchOutbox();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/messages/send]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'Could not queue the email.' }, { status: 500 });
  }
}
