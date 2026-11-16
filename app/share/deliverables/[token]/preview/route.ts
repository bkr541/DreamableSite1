import { getSharedDeliverables } from '@/lib/deliverablesShare';
import { deliverablesPreviewInfo } from '@/lib/deliverablesMetadata';
import { deliverablesPreviewImage } from '@/lib/deliverablesPreview';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await getSharedDeliverables(token);
  if (!shared) return new Response('Not found.', { status: 404, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });
  return deliverablesPreviewImage(deliverablesPreviewInfo(shared));
}
