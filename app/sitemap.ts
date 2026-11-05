import type { MetadataRoute } from 'next';
import { INDEXABLE_PAGES, absoluteUrl } from '@/lib/site';

// Lists only the public marketing pages. Signed-in screens, reset links and share links are deliberately absent.
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PAGES.map((p) => ({
    url: absoluteUrl(p.path),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
