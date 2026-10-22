import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { fileResponse } from '@/lib/serveFile';

// Serves a deliverable to an admin, or to the client it was delivered to.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const file = await prisma.deliverable.findUnique({
      where: { id },
      include: { project: { select: { primaryUserId: true } } },
    });
    if (!file) {
      return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
    }

    if (!session.admin) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { inquiryId: true },
      });
      const ownsProject = file.project?.primaryUserId === session.userId;
      const ownsInquiry = !!file.inquiryId && file.inquiryId === user?.inquiryId;
      if (!ownsProject && !ownsInquiry) {
        return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
      }
    }

    return fileResponse(file, req.nextUrl.searchParams.get('inline') === '1');
  } catch (err) {
    console.error('[deliverables GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
