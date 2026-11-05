import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { shareChange } from '@/lib/shareLinks';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// Admin-only link controls.
//   rotate – replace the link with a new one; the old URL stops working at once. Only while the folder is shared.
//   revoke – turn sharing off and retire the link; re-enabling later issues a different URL.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return fail('Folder not found.', 404);

  const { action } = await req.json().catch(() => ({}));
  if (action !== 'rotate' && action !== 'revoke') return fail('action must be "rotate" or "revoke".', 400);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const folder = await tx.deliverableFolder.findUnique({ where: { id }, select: { isPublic: true } });
      if (!folder) return 'missing' as const;
      if (action === 'rotate' && !folder.isPublic) return 'not_shared' as const;
      const updated = await tx.deliverableFolder.update({
        where: { id },
        data: shareChange(action),
        select: { shareToken: true, isPublic: true, shareRotatedAt: true },
      });
      await recordAudit(tx, { actorId: auth.user.id, action: `folder.share_${action}`, targetType: 'deliverable_folder', targetId: id });
      return updated;
    });
    if (result === 'missing') return fail('Folder not found.', 404);
    if (result === 'not_shared') return fail('Turn sharing on before rotating its link.', 409);
    return NextResponse.json({ ok: true, shareToken: result.shareToken, isPublic: result.isPublic, shareRotatedAt: result.shareRotatedAt?.toISOString() ?? null });
  } catch (err) {
    console.error('[admin/deliverable-folders share]', err);
    return fail('Internal server error.', 500);
  }
}
