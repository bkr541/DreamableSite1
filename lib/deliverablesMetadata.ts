import type { Metadata } from 'next';
import type { getSharedDeliverables } from '@/lib/deliverablesShare';
import { absoluteUrl, NOINDEX, SITE_NAME } from '@/lib/site';

type SharedDeliverables = NonNullable<Awaited<ReturnType<typeof getSharedDeliverables>>>;

export function deliverablesPreviewInfo(shared: SharedDeliverables) {
  const folderCount = shared.folders.length;
  const fileCount = shared.folders.reduce((total, folder) => total + folder._count.deliverables, 0);
  const foldersLabel = `${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`;
  const filesLabel = `${fileCount} ${fileCount === 1 ? 'file' : 'files'}`;
  const counts = `${foldersLabel} · ${filesLabel}`;
  const folderNames = shared.folders.slice(0, 3).map((folder) => folder.name).join(' · ');
  return {
    projectName: shared.name, folderNames, foldersLabel, filesLabel, counts,
    title: `${shared.name} — Deliverables`,
    description: `${counts} for ${shared.name}. ${folderNames ? `${folderNames}. ` : ''}Browse, preview, and download your project files.`,
  };
}

export function sharedDeliverablesMetadata(token: string, shared: SharedDeliverables): Metadata {
  const info = deliverablesPreviewInfo(shared);
  const path = `/share/deliverables/${encodeURIComponent(token)}`;
  const title = `${info.title} | ${SITE_NAME}`;
  const image = { url: absoluteUrl(`${path}/preview`), width: 1200, height: 630, alt: `${info.title} — ${info.counts}` };
  return {
    ...NOINDEX,
    title: { absolute: title },
    description: info.description,
    openGraph: { type: 'website', siteName: SITE_NAME, title, description: info.description, url: absoluteUrl(path), images: [image] },
    twitter: { card: 'summary_large_image', title, description: info.description, images: [image] },
  };
}
