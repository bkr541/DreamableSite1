import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deliverFile } from '@/lib/serveFile';
import { deliverablesFolderAccess } from '@/lib/deliverablesShare';

// Every download and preview checks the live project link against the file’s owning folder.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;

  try {
    if (typeof token !== 'string' || token.length < 8 || token.length > 200) {
      return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
    }
    const file = await prisma.deliverable.findFirst({
      where: { id, status: 'READY', folder: deliverablesFolderAccess(token) },
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
