import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { shareChange } from '@/lib/shareLinks';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const fail = (error: string, status = 400) => json({ ok: false, error }, status);
const select = { isPublic: true, shareToken: true, shareRotatedAt: true } as const;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId || !UUID.test(projectId)) return fail('Invalid project.');
  try {
    if (!await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })) return fail('Project not found.', 404);
    return json({ ok: true, share: await prisma.deliverablesShare.findUnique({ where: { projectId }, select }) });
  } catch (err) {
    console.error('[deliverables sharing GET]', err);
    return fail('Could not load deliverables sharing.', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  const projectId = body?.projectId;
  if (typeof projectId !== 'string' || !UUID.test(projectId)) return fail('Invalid project.');
  const action = body?.action;
  if (action !== 'enable' && action !== 'rotate' && action !== 'revoke') return fail('Invalid sharing action.');
  try {
    if (!await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })) return fail('Project not found.', 404);
    const result = await prisma.$transaction(async (tx) => {
      if (action === 'enable') {
        const share = await tx.deliverablesShare.upsert({ where: { projectId }, create: { projectId, ...shareChange('enable') }, update: {} });
        // Concurrent enable requests reuse the active token rather than invalidating each other's links.
        if (!share.isPublic) await tx.deliverablesShare.updateMany({ where: { id: share.id, isPublic: false }, data: shareChange('enable') });
      } else {
        const changed = await tx.deliverablesShare.updateMany({
          where: { projectId, ...(action === 'rotate' ? { isPublic: true } : {}) }, data: shareChange(action),
        });
        if (!changed.count) return null;
      }
      await recordAudit(tx, { actorId: auth.user.id, action: `deliverables.share_${action}`, targetType: 'project', targetId: projectId });
      return tx.deliverablesShare.findUnique({ where: { projectId }, select });
    });
    if (!result) return fail('Turn deliverables sharing on first.', 409);
    return json({ ok: true, share: result });
  } catch (err) {
    console.error('[deliverables sharing POST]', err);
    return fail('Could not update deliverables sharing.', 500);
  }
}
