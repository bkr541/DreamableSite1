import { prisma } from './prisma';
import { deliverablesFolderAccess } from './deliverablesShare';

// Comment access is scoped to either a folder link or a project deliverables link.
// Both require a live token and a READY file in the matching folder or project.

/** Only approved comments are ever shown to visitors. */
export const PUBLIC_COMMENT_FILTER = { status: 'APPROVED' } as const;

export async function findSharedFile(token: string, fileId: string, scope: 'folder' | 'deliverables' = 'folder') {
  if (typeof token !== 'string' || token.length < 8 || token.length > 200) return null;
  return prisma.deliverable.findFirst({
    where: { id: fileId, status: 'READY', folder: scope === 'deliverables' ? deliverablesFolderAccess(token) : { shareToken: token, isPublic: true } },
    select: {
      id: true,
      title: true,
      fileName: true,
      folder: { select: { id: true, name: true, inquiryId: true, projectId: true, commentsEnabled: true, commentsModerated: true } },
      _count: { select: { comments: true } },
    },
  });
}
