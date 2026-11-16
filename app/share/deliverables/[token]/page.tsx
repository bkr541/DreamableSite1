import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Folder01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { getSharedDeliverables } from '@/lib/deliverablesShare';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Shared deliverables · Dreamable.studio',
  robots: { index: false, follow: false }, referrer: 'no-referrer',
};

export default async function SharedDeliverablesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await getSharedDeliverables(token);
  if (!shared) notFound();
  return (
    <main className="min-h-screen px-4 py-10 sm:py-16" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 40%, #f0f4ff 100%)' }}>
      <div className="mx-auto w-full max-w-[1000px]">
        <div className="mb-8 flex items-center gap-2.5">
          <Image src="/images/logo.png" alt="" width={32} height={32} className="rounded-md" priority />
          <span className="text-base font-semibold tracking-tight text-[#1a1a1a]">Dreamable<span className="text-[#999]">.</span>studio</span>
        </div>
        <section className="rounded-3xl border border-[#F0F0F0] bg-white p-7 shadow-lg sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#999]">{shared.name}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a] sm:text-4xl">Deliverables</h1>
          <p className="mt-3 text-base text-[#707070]">Open a folder to preview and download your files.</p>
          <p className="mt-4 text-sm font-medium text-[#888]">{shared.folders.length} {shared.folders.length === 1 ? 'folder' : 'folders'}</p>
          {shared.folders.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-dashed border-[#D0D4E0] px-6 py-12 text-center text-sm text-[#777]">No folders have been added yet. Check back soon.</p>
          ) : (
            <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shared.folders.map((folder) => (
                <li key={folder.id}>
                  <Link href={`/share/deliverables/${token}/folders/${folder.id}`} className="flex h-full min-h-[184px] flex-col rounded-2xl border border-[#E2E4EA] p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#7BB5F5] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300">
                    <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF2FF]"><HugeiconsIcon icon={Folder01Icon} size={24} color="#4f6df5" strokeWidth={1.5} /></span>
                    <h2 className="break-words text-lg font-semibold text-[#1a1a1a]">{folder.name}</h2>
                    {folder.description && <p className="mt-1 line-clamp-3 break-words text-sm text-[#777]">{folder.description}</p>}
                    <span className="mt-auto flex items-center justify-between pt-4 text-sm text-[#888]">
                      <span>{folder._count.deliverables} {folder._count.deliverables === 1 ? 'file' : 'files'}</span>
                      <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="#4f6df5" strokeWidth={1.5} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
