import type { Metadata } from 'next';
import { Inter, Quicksand } from 'next/font/google';
import './globals.css';
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/site';
import MotionPreferences from '@/components/MotionPreferences';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const quicksand = Quicksand({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Every page below sets its own canonical, title, description and previews (lib/site.ts); these are the fallbacks.
  openGraph: { type: 'website', siteName: SITE_NAME, images: [{ url: OG_IMAGE.path, width: OG_IMAGE.width, height: OG_IMAGE.height, alt: OG_IMAGE.alt }] },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE.path] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${quicksand.variable} font-sans scroll-smooth snap-y snap-mandatory scroll-pt-20`}>
      <body className="min-h-screen flex flex-col bg-white text-[#000000] antialiased selection:bg-black selection:text-white">
        <MotionPreferences>{children}</MotionPreferences>
      </body>
    </html>
  );
}
