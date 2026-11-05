import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Marks notifications read for THIS admin only. Idempotent: marking twice is harmless.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const me = auth.user.id;
  try {
    let ids: string[];
    if (body.all === true) {
      const unread = await prisma.adminNotification.findMany({ where: { reads: { none: { userId: me } } }, select: { id: true }, take: 1000 });
      ids = unread.map((n) => n.id);
    } else if (Array.isArray(body.ids) && body.ids.length > 0 && body.ids.length <= 100 && body.ids.every((i: unknown) => typeof i === 'string' && UUID.test(i))) {
      ids = body.ids;
    } else {
      return NextResponse.json({ ok: false, error: 'Send { ids: [...] } (up to 100) or { all: true }.' }, { status: 400 });
    }
    if (ids.length) await prisma.notificationRead.createMany({ data: ids.map((notificationId) => ({ notificationId, userId: me })), skipDuplicates: true });
    const unread = await prisma.adminNotification.count({ where: { reads: { none: { userId: me } } } });
    return NextResponse.json({ ok: true, unread });
  } catch (err) {
    console.error('[admin/notifications read]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
