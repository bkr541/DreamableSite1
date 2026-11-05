import { NOINDEX } from '@/lib/site';

// Signed-in areas: never indexed (they are also protected by authentication; this only keeps them out of search results).
export const metadata = { ...NOINDEX, title: 'Dashboard' };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F7F8]">
      {children}
    </div>
  );
}
