import { organizationJsonLd, pageMetadata } from '@/lib/site';
import HomeClient from './HomeClient';

export const metadata = pageMetadata('/');

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()).replace(/</g, '\\u003c') }} />
      <HomeClient />
    </>
  );
}
