import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import SharedFolderView from './SharedFolderView';
import { PUBLIC_COMMENT_FILTER } from '@/lib/shareAccess';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shared files · Dreamable.studio',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function SharedFolderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // The link only works while the folder's "Publicly accessible" switch is on.
  const folder = await prisma.deliverableFolder.findFirst({
    where: { shareToken: token, isPublic: true },
    select: {
      name: true,
      description: true,
      commentsEnabled: true,
      project: { select: { name: true } },
      deliverables: {
        where: { status: 'READY' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, fileName: true, size: true, title: true, description: true },
      },
    },
  });

  if (!folder) notFound();

  // Comments are newer than the rest of the schema; an unmigrated database just shows none.
  const comments = await prisma.deliverableComment
    .findMany({
      // Pending and hidden comments never leave the server.
      where: { deliverableId: { in: folder.deliverables.map((d) => d.id) }, ...PUBLIC_COMMENT_FILTER },
      orderBy: { createdAt: 'asc' },
      select: { id: true, deliverableId: true, authorName: true, body: true, createdAt: true },
    })
    .catch(() => []);

  return (
    <SharedFolderView
      token={token}
      name={folder.name}
      description={folder.description}
      projectName={folder.project?.name ?? null}
      files={folder.deliverables}
      commentsEnabled={folder.commentsEnabled}
      comments={comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
    />
  );
}
