import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/clientIp';
import { RULES, consume, firstDenied, tooManyRequests } from '@/lib/rateLimit';
import { logRef, logSecurity } from '@/lib/securityLog';
import { cleanAuthorName, cleanCommentBody } from '@/lib/commentText';
import { findSharedFile } from '@/lib/shareAccess';
import { links, notify } from '@/lib/notifications';

const MAX_PER_FILE = 200;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_BODY_BYTES = 16 * 1024;

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

// Public: anyone holding a public folder's link can comment on a file inside it — if the folder allows comments.
// Visitors are never verified: the name is whatever they typed, and it is shown as "unverified".
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const ip = getClientIp(req.headers);

  // Per-source limit first: it also bounds how many throwaway tokens/ids one visitor can probe.
  const ipDecision = await consume(RULES.commentIp, ip);
  if (!ipDecision.allowed) return tooManyRequests(ipDecision, 'comments');

  try {
    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return fail('That comment is too large.', 413);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return fail('We could not read that comment.');

    // Honeypot: bots fill hidden fields; pretend it worked.
    if (body.website) return NextResponse.json({ ok: true, comment: null });

    const name = cleanAuthorName(body.name);
    if (!name.ok) return fail(name.error);
    const text = cleanCommentBody(body.body);
    if (!text.ok) return fail(text.error);

    // Every write re-checks that the link is live (public folder, matching token) — never trust an earlier page load.
    const file = await findSharedFile(token, id);
    if (!file) return fail('This link is no longer available.', 404);
    if (!file.folder?.commentsEnabled) return fail('Comments are turned off for this folder.', 403);

    // Valid link from here on, so these buckets can't be inflated by random tokens.
    const blocked = firstDenied(
      await consume(RULES.commentLink, token),
      await consume(RULES.commentIpFile, ip, file.id),
    );
    if (blocked) {
      logSecurity('comment.throttled', { ip: logRef(ip), file: logRef(file.id) });
      return tooManyRequests(blocked, 'comments');
    }

    if (file._count.comments >= MAX_PER_FILE) return fail('This file has reached its comment limit.', 429);

    // Same author posting the same words again (double click, retry, copy-paste spam).
    const duplicate = await prisma.deliverableComment.findFirst({
      where: { deliverableId: file.id, authorName: name.value, body: text.value, createdAt: { gt: new Date(Date.now() - DUPLICATE_WINDOW_MS) } },
      select: { id: true },
    });
    if (duplicate) return fail('You already posted that comment.', 409);

    const moderated = file.folder.commentsModerated;
    const comment = await prisma.deliverableComment.create({
      data: { deliverableId: file.id, authorName: name.value, body: text.value, status: moderated ? 'PENDING' : 'APPROVED' },
      select: { id: true, deliverableId: true, authorName: true, body: true, createdAt: true },
    });

    // Staff hear about it once per comment, whatever happens to the response.
    await notify(prisma, {
      type: 'comment.new',
      title: moderated ? `Comment awaiting review on ${file.title || file.fileName}` : `New comment on ${file.title || file.fileName}`,
      body: `From ${name.value} (guest, unverified) in “${file.folder.name}”`,
      entityType: 'deliverable_comment', entityId: comment.id, url: links.folder(file.folder), dedupeKey: `comment.new:${comment.id}`,
    }).catch((e) => console.error('[share comments] notification failed', e instanceof Error ? e.message : e));

    // Held comments are not returned: the visitor sees a notice, everyone else sees nothing until approval.
    if (moderated) {
      return NextResponse.json({ ok: true, comment: null, pending: true, message: 'Thanks! Your comment will appear once it has been reviewed.' });
    }
    return NextResponse.json({ ok: true, comment: { ...comment, createdAt: comment.createdAt.toISOString() } });
  } catch (err) {
    console.error('[share comments POST]', err);
    return fail('Something went wrong. Please try again.', 500);
  }
}
