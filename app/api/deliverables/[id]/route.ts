import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { fileResponse } from '@/lib/serveFile';
import { applyWatermark, canWatermark } from '@/lib/watermark';

// Serves a deliverable to an admin, or to the client it was delivered to.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { id } = await params;

  try {
    const file = await prisma.deliverable.findUnique({
      where: { id },
      include: { project: { select: { primaryUserId: true } } },
    });
    if (!file) {
      return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
    }

    if (!user.admin) {
      const ownsProject = file.project?.primaryUserId === user.id;
      const ownsInquiry = !!file.inquiryId && file.inquiryId === user.inquiryId;
      if (!ownsProject && !ownsInquiry) {
        return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
      }
    }

    const wantInline = req.nextUrl.searchParams.get('inline') === '1';
    if (file.watermark && canWatermark(file.fileName)) {
      const data = await applyWatermark(file.fileName, file.data);
      return fileResponse({ fileName: file.fileName, size: data.length, data }, wantInline);
    }
    return fileResponse(file, wantInline);
  } catch (err) {
    console.error('[deliverables GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
