import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SharedFolderView from '@/app/share/[token]/SharedFolderView';
import { getSharedDeliverablesFolder } from '@/lib/deliverablesShare';
import { PUBLIC_COMMENT_FILTER } from '@/lib/shareAccess';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Shared files · Dreamable.studio',
  robots: { index: false, follow: false }, referrer: 'no-referrer',
};

export default async function SharedDeliverablesFolderPage({ params }: { params: Promise<{ token: string; folderId: string }> }) {
  const { token, folderId } = await params;
  const folder = await getSharedDeliverablesFolder(token, folderId);
  if (!folder) notFound();
  const comments = await prisma.deliverableComment.findMany({
    where: { deliverableId: { in: folder.deliverables.map((file) => file.id) }, ...PUBLIC_COMMENT_FILTER },
    orderBy: { createdAt: 'asc' },
    select: { id: true, deliverableId: true, authorName: true, body: true, createdAt: true },
  }).catch(() => []);
  return <SharedFolderView
    token={token} name={folder.name} description={folder.description} projectName={folder.project?.name ?? null}
    files={folder.deliverables} commentsEnabled={folder.commentsEnabled}
    comments={comments.map((comment) => ({ ...comment, createdAt: comment.createdAt.toISOString() }))}
    apiBase={`/api/share/deliverables/${token}`} backHref={`/share/deliverables/${token}`}
  />;
}
