import type { Metadata } from 'next';
import { Inter, Quicksand } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const quicksand = Quicksand({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Dreamable.studio',
  description: 'A digital product and creative studio that turns ideas into structured brands, software, and systems that ship.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${quicksand.variable} font-sans scroll-smooth snap-y snap-mandatory`}>
      <body className="min-h-screen flex flex-col bg-white text-[#000000] antialiased selection:bg-black selection:text-white">
        {children}
      </body>
    </html>
  );
}
