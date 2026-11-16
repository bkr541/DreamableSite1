import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const validShareToken = (token: string) => typeof token === 'string' && token.length >= 8 && token.length <= 200;

/** Check the folder's owning project, so unrelated and unfiled artifacts never qualify. */
export function deliverablesFolderAccess(token: string): Prisma.DeliverableFolderWhereInput {
  return { project: { deliverablesShare: { shareToken: token, isPublic: true } } };
}

export async function getSharedDeliverables(token: string) {
  if (!validShareToken(token)) return null;
  const share = await prisma.deliverablesShare.findFirst({
    where: { shareToken: token, isPublic: true },
    select: { projectId: true, project: { select: { name: true } } },
  });
  if (!share) return null;
  const folders = await prisma.deliverableFolder.findMany({
    where: { projectId: share.projectId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, name: true, description: true,
      _count: { select: { deliverables: { where: { status: 'READY' } } } },
    },
  });
  return { name: share.project.name, folders };
}

export async function getSharedDeliverablesFolder(token: string, folderId: string) {
  if (!validShareToken(token) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(folderId)) return null;
  return prisma.deliverableFolder.findFirst({
    where: { id: folderId, ...deliverablesFolderAccess(token) },
    select: {
      name: true, description: true, commentsEnabled: true,
      project: { select: { name: true } },
      deliverables: {
        where: { status: 'READY' }, orderBy: { createdAt: 'asc' },
        select: { id: true, fileName: true, size: true, title: true, description: true },
      },
    },
  });
}
