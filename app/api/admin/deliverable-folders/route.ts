import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSessionFromRequest } from '@/lib/session';
import { prisma } from '@/lib/prisma';

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session?.admin) return fail('Unauthorized.', 401);

  try {
    const { targetType, targetId, name, description, isPublic } = await req.json();

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
        // Unguessable link token; generated up front so turning sharing on later never changes the URL.
        shareToken: randomBytes(18).toString('base64url'),
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: folder.id });
  } catch (err) {
    console.error('[admin/deliverable-folders POST]', err);
    return fail('Internal server error.', 500);
  }
}
