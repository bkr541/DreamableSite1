import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { fileResponse } from '@/lib/serveFile';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const session = getSessionFromRequest(req);
  if (!session?.admin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id, attachmentId } = await params;

  try {
    const file = await prisma.inquiryAttachment.findFirst({
      where: { id: attachmentId, inquiryId: id },
    });
    if (!file) {
      return NextResponse.json({ ok: false, error: 'Attachment not found.' }, { status: 404 });
    }
    return fileResponse(file, req.nextUrl.searchParams.get('inline') === '1');
  } catch (err) {
    console.error('[admin/inquiries attachment GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
