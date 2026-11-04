import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import SharedFolderView from './SharedFolderView';

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
      project: { select: { name: true } },
      deliverables: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, fileName: true, size: true, title: true, description: true },
      },
    },
  });

  if (!folder) notFound();

  return (
    <SharedFolderView
      token={token}
      name={folder.name}
      description={folder.description}
      projectName={folder.project?.name ?? null}
      files={folder.deliverables}
    />
  );
}
