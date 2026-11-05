import { prisma } from './prisma';

// The one place that decides whether a public share link may be used. Both reading a shared folder and
// posting to it go through here, so turning a folder private (or, later, expiring/rotating its link) closes
// every public path at once.

/** Only approved comments are ever shown to visitors. */
export const PUBLIC_COMMENT_FILTER = { status: 'APPROVED' } as const;

export async function findSharedFile(token: string, fileId: string) {
  if (typeof token !== 'string' || token.length < 8 || token.length > 200) return null;
  return prisma.deliverable.findFirst({
    where: { id: fileId, status: 'READY', folder: { shareToken: token, isPublic: true } },
    select: {
      id: true,
      title: true,
      fileName: true,
      folder: { select: { id: true, name: true, inquiryId: true, projectId: true, commentsEnabled: true, commentsModerated: true } },
      _count: { select: { comments: true } },
    },
  });
}
