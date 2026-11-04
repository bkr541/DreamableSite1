import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session?.admin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.deliverableComment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2025') {
      return NextResponse.json({ ok: false, error: 'Comment not found.' }, { status: 404 });
    }
    console.error('[admin/deliverable-comments DELETE]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
