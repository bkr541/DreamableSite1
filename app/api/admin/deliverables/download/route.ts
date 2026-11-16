import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { contentDisposition } from '@/lib/fileTypes';
import { archiveEntries, archiveFileResponse, archiveFits, streamArchive } from '@/lib/deliverablesZip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const projectId = req.nextUrl.searchParams.get('projectId');
  const folderId = req.nextUrl.searchParams.get('folderId');
  if (!projectId || !UUID.test(projectId) || (folderId !== null && !UUID.test(folderId))) return fail('Invalid project or folder.');
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
    if (!project) return fail('Project not found.', 404);
    const folders = await prisma.deliverableFolder.findMany({
      where: { projectId, ...(folderId ? { id: folderId } : {}) },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true,
        deliverables: {
          where: { status: 'READY' }, orderBy: { createdAt: 'asc' },
          select: { id: true, fileName: true, size: true },
        },
      },
    });
    if (folderId && !folders.length) return fail('Folder not found.', 404);
    if (!folders.length) return fail('There are no deliverable folders to download.');
    if (folderId && !folders[0].deliverables.length) return fail('There are no files in this folder yet.');
    const entries = archiveEntries(folders, !!folderId);
    if (!archiveFits(entries)) return fail('This ZIP is too large. Download folders separately.', 413);
    const stream = streamArchive(entries, async (entry, signal) => {
      const file = await prisma.deliverable.findFirst({
        where: { id: entry.fileId!, folderId: entry.folderId!, status: 'READY', folder: { projectId } },
      });
      if (!file) throw new Error('An artifact is no longer available. Please retry the download.');
      return archiveFileResponse(file, signal);
    }, req.signal);
    const filename = folderId ? `${folders[0].name}.zip` : `${project.name} Deliverables.zip`;
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/zip', 'Content-Disposition': contentDisposition('attachment', filename),
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex',
      },
    });
  } catch (error) {
    console.error('[deliverables ZIP GET]', error instanceof Error ? error.message : 'Archive preparation failed');
    return fail('Could not prepare the ZIP download. Please try again.', 500);
  }
}
