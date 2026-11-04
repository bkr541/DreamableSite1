import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Best-effort, per-instance rate limit (same approach as the inquiry form).
const hits = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 8;
const WINDOW = 60_000;
const MAX_PER_FILE = 200;

function limited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > LIMIT;
}

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

// Public: anyone holding a public folder's link can comment on a file inside it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (limited(ip)) return fail('Too many comments. Please wait a moment and try again.', 429);

  try {
    const body = await req.json();

    // Honeypot: bots fill hidden fields; pretend it worked.
    if (body.website) return NextResponse.json({ ok: true, comment: null });

    const authorName = typeof body.name === 'string' ? body.name.trim() : '';
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!authorName) return fail('Please enter your name.');
    if (authorName.length > 80) return fail('Name must be 80 characters or fewer.');
    if (!text) return fail('Please write a comment.');
    if (text.length > 2000) return fail('Comments must be 2000 characters or fewer.');

    const file = await prisma.deliverable.findFirst({
      where: { id, folder: { shareToken: token, isPublic: true } },
      select: { id: true, _count: { select: { comments: true } } },
    });
    if (!file) return fail('This link is no longer available.', 404);
    if (file._count.comments >= MAX_PER_FILE) return fail('This file has reached its comment limit.', 429);

    const comment = await prisma.deliverableComment.create({
      data: { deliverableId: file.id, authorName, body: text },
      select: { id: true, authorName: true, body: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, comment: { ...comment, createdAt: comment.createdAt.toISOString() } });
  } catch (err) {
    console.error('[share comments POST]', err);
    return fail('Something went wrong. Please try again.', 500);
  }
}
