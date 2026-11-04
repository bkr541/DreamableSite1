import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fileResponse } from '@/lib/serveFile';
import { applyWatermark, canWatermark } from '@/lib/watermark';

// Public: serves a file from a folder only while that folder's "Publicly accessible" switch is on.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;

  try {
    const file = await prisma.deliverable.findFirst({
      where: { id, folder: { shareToken: token, isPublic: true } },
    });
    if (!file) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

    const wantInline = req.nextUrl.searchParams.get('inline') === '1';
    const res =
      file.watermark && canWatermark(file.fileName)
        ? await applyWatermark(file.fileName, file.data).then((data) => fileResponse({ fileName: file.fileName, size: data.length, data }, wantInline))
        : fileResponse(file, wantInline);

    res.headers.set('Cache-Control', 'private, no-store');
    res.headers.set('X-Robots-Tag', 'noindex');
    return res;
  } catch (err) {
    console.error('[share file GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
