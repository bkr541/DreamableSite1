import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deliverFile } from '@/lib/serveFile';

// Public: serves a file from a folder only while that folder's link is live. Rotating the link or turning
// sharing off changes the folder's token, so a previously issued URL stops matching immediately.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;

  try {
    if (typeof token !== 'string' || token.length < 8 || token.length > 200) {
      return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
    }
    const file = await prisma.deliverable.findFirst({
      where: { id, status: 'READY', folder: { shareToken: token, isPublic: true } },
    });
    if (!file) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

    const res = await deliverFile(file, { inline: req.nextUrl.searchParams.get('inline') === '1', range: req.headers.get('range') });
    res.headers.set('X-Robots-Tag', 'noindex');
    return res;
  } catch (err) {
    console.error('[share file GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
