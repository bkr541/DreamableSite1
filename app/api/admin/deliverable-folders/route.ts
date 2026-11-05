import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { newShareToken } from '@/lib/shareLinks';

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { targetType, targetId, name, description, isPublic, commentsEnabled, commentsModerated } = await req.json();

    if (targetType !== 'inquiry' && targetType !== 'project') return fail('Invalid target.');
    if (!targetId || typeof targetId !== 'string') return fail('Invalid target.');
    if (typeof name !== 'string' || !name.trim()) return fail('Folder name is required.');
    if (name.trim().length > 120) return fail('Folder name must be 120 characters or fewer.');

    const target =
      targetType === 'inquiry'
        ? await prisma.inquiry.findUnique({ where: { id: targetId }, select: { id: true } })
        : await prisma.project.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) return fail('Target not found.', 404);

    const folder = await prisma.deliverableFolder.create({
      data: {
        [targetType === 'inquiry' ? 'inquiryId' : 'projectId']: targetId,
        name: name.trim(),
        description: typeof description === 'string' && description.trim() ? description.trim().slice(0, 1000) : null,
        isPublic: isPublic === true,
        commentsEnabled: commentsEnabled !== false,
        commentsModerated: commentsModerated === true,
        // Unguessable link token. Turning sharing on later issues a fresh one (see lib/shareLinks.ts).
        shareToken: newShareToken(),
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: folder.id });
  } catch (err) {
    console.error('[admin/deliverable-folders POST]', err);
    return fail('Internal server error.', 500);
  }
}
