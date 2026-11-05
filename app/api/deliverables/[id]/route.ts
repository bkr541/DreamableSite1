import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { deliverFile } from '@/lib/serveFile';

// Serves a deliverable to an admin, or to the client it was delivered to.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { id } = await params;

  try {
    // Only verified files (status READY) are ever served; an upload still in progress doesn't exist yet.
    const file = await prisma.deliverable.findFirst({
      where: { id, status: 'READY' },
      include: { project: { select: { primaryUserId: true } } },
    });
    if (!file) {
      return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
    }

    // Ownership is checked here, before any storage link is created, so another client's file is just "not found".
    if (!user.admin) {
      const ownsProject = file.project?.primaryUserId === user.id;
      const ownsInquiry = !!file.inquiryId && file.inquiryId === user.inquiryId;
      if (!ownsProject && !ownsInquiry) {
        return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
      }
    }

    return await deliverFile(file, { inline: req.nextUrl.searchParams.get('inline') === '1', range: req.headers.get('range') });
  } catch (err) {
    console.error('[deliverables GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
