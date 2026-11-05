import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// Admin-only. Newest first, cursor-paginated; `filter=unread` shows what this admin hasn't opened yet.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const q = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(q.get('limit')) || 25, 1), 50);
  const unreadOnly = q.get('filter') === 'unread';
  const cursor = q.get('cursor');
  const before = cursor ? new Date(cursor) : null;
  if (before && Number.isNaN(before.getTime())) return fail('Invalid cursor.', 400);
  const me = auth.user.id;

  try {
    const rows = await prisma.adminNotification.findMany({
      where: { ...(before ? { createdAt: { lt: before } } : {}), ...(unreadOnly ? { reads: { none: { userId: me } } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      select: { id: true, type: true, title: true, body: true, url: true, entityType: true, entityId: true, createdAt: true, reads: { where: { userId: me }, select: { readAt: true } } },
    });
    const page = rows.slice(0, limit);
    const unread = await prisma.adminNotification.count({ where: { reads: { none: { userId: me } } } });
    return NextResponse.json({
      ok: true,
      unread,
      items: page.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, url: n.url, createdAt: n.createdAt.toISOString(), read: (n.reads?.length ?? 0) > 0 })),
      nextCursor: rows.length > limit ? page[page.length - 1].createdAt.toISOString() : null,
    });
  } catch (err) {
    console.error('[admin/notifications GET]', err);
    return fail('Internal server error.', 500);
  }
}
