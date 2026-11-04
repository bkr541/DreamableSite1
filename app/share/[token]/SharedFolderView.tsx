'use client';

import { useState } from 'react';
import Image from 'next/image';
import { HugeiconsIcon } from '@hugeicons/react';
import { File02Icon, Folder01Icon } from '@hugeicons/core-free-icons';
import FilePreviewModal, { PreviewFile, formatBytes, previewKind } from '@/components/FilePreviewModal';

interface SharedFile {
  id: string;
  fileName: string;
  size: number;
  title: string | null;
  description: string | null;
}

interface Props {
  token: string;
  name: string;
  description: string | null;
  projectName: string | null;
  files: SharedFile[];
}

export default function SharedFolderView({ token, name, description, projectName, files }: Props) {
  const [preview, setPreview] = useState<PreviewFile | null>(null);
  const urlFor = (id: string) => `/api/share/${token}/files/${id}`;

  return (
    <main
      className="min-h-screen px-4 py-10 sm:py-16"
      style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 40%, #f0f4ff 100%)' }}
    >
      <div className="mx-auto w-full max-w-[1000px]">
        {/* Brand */}
        <div className="mb-8 flex items-center gap-2.5">
          <Image src="/images/logo_transparent.png" alt="" width={32} height={32} className="rounded-md" priority />
          <span className="text-base font-semibold tracking-tight text-[#1a1a1a]">
            Dreamable<span className="text-[#999]">.</span>studio
          </span>
        </div>

        {/* Folder header */}
        <section className="rounded-3xl bg-white p-7 sm:p-10 shadow-lg border border-[#F0F0F0]">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF2FF]">
              <HugeiconsIcon icon={Folder01Icon} size={26} color="#4f6df5" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              {projectName && <p className="text-xs font-semibold uppercase tracking-widest text-[#999]">{projectName}</p>}
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1a1a1a] break-words">{name}</h1>
              {description && <p className="mt-3 max-w-[640px] text-base leading-relaxed text-[#707070] whitespace-pre-wrap">{description}</p>}
              <p className="mt-4 text-sm font-medium text-[#888]">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </p>
            </div>
          </div>

          {/* Files */}
          {files.length === 0 ? (
            <p className="mt-10 rounded-2xl border border-dashed border-[#D0D4E0] px-6 py-12 text-center text-sm text-[#777]">
              Nothing has been added to this folder yet. Check back soon.
            </p>
          ) : (
            <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {files.map((f) => {
                const kind = previewKind(f.fileName);
                const ext = f.fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
                const url = urlFor(f.id);
                const label = f.title || f.fileName;
                const asPreview: PreviewFile = { url, fileName: f.fileName, size: f.size, title: f.title, description: f.description };
                return (
                  <li key={f.id} className="flex flex-col overflow-hidden rounded-2xl border border-[#E8E8EC] bg-white shadow-sm hover:shadow-md transition-shadow">
                    <button
                      type="button"
                      onClick={() => setPreview(asPreview)}
                      className="relative block h-44 w-full bg-[#F6F7FB] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                      aria-label={`Open ${label}`}
                    >
                      {kind === 'image' && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${url}?inline=1`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                      )}
                      {kind === 'video' && (
                        <video src={`${url}?inline=1#t=0.1`} preload="metadata" muted playsInline className="absolute inset-0 h-full w-full object-cover pointer-events-none" />
                      )}
                      {kind !== 'image' && kind !== 'video' && (
                        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <HugeiconsIcon icon={File02Icon} size={40} color="#AAAAAA" strokeWidth={1.25} />
                          <span className="text-xs font-semibold tracking-widest text-[#AAA]">{ext}</span>
                        </span>
                      )}
                    </button>
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <p className="text-sm font-semibold text-[#1a1a1a] truncate" title={label}>{label}</p>
                      <p className="text-xs text-[#888] truncate">{f.title && f.title !== f.fileName ? `${f.fileName} · ` : ''}{formatBytes(f.size)}</p>
                      {f.description && <p className="mt-1 text-sm leading-snug text-[#666]">{f.description}</p>}
                      <div className="mt-auto flex items-center gap-4 pt-3">
                        <button
                          type="button"
                          onClick={() => setPreview(asPreview)}
                          className="text-sm font-medium text-[#4f6df5] hover:text-[#3b54d6] transition-colors"
                        >
                          View
                        </button>
                        <a href={url} className="text-sm font-medium text-[#555] hover:text-[#1a2030] transition-colors">Download</a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-[#999]">Shared by Dreamable.studio</p>
      </div>

      <FilePreviewModal file={preview} onClose={() => setPreview(null)} />
    </main>
  );
}
