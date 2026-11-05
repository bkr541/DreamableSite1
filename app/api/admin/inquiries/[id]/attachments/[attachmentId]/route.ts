import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { deliverFile } from '@/lib/serveFile';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id, attachmentId } = await params;

  try {
    const file = await prisma.inquiryAttachment.findFirst({
      where: { id: attachmentId, inquiryId: id, status: 'READY' },
    });
    if (!file) {
      return NextResponse.json({ ok: false, error: 'Attachment not found.' }, { status: 404 });
    }
    return await deliverFile(file, { inline: req.nextUrl.searchParams.get('inline') === '1', range: req.headers.get('range') });
  } catch (err) {
    console.error('[admin/inquiries attachment GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
