import type { MetadataRoute } from 'next';
import { PRIVATE_PATH_PREFIXES, siteUrl } from '@/lib/site';

// A courtesy to well-behaved crawlers, NOT access control: anyone can still request these addresses. They are protected
// by sign-in or unguessable tokens, and send `X-Robots-Tag: noindex` (see next.config.ts).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE_PATH_PREFIXES }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
