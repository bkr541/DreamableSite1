'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CancelCircleIcon } from '@hugeicons/core-free-icons';

export interface PreviewFile {
  url: string;
  fileName: string;
  size: number;
  description?: string | null;
}

export type PreviewKind = 'image' | 'pdf' | 'video' | 'text' | null;

export function previewKind(fileName: string): PreviewKind {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
  if (['txt', 'md', 'csv'].includes(ext)) return 'text';
  return null;
}

export function formatBytes(size: number) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function TextPreview({ src }: { src: string }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => { if (!cancelled) setText(t); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [src]);

  if (failed) return <p className="text-sm text-[#888]">Could not load this file.</p>;
  if (text === null) return <p className="text-sm text-[#AAA]">Loading…</p>;
  return <pre className="w-full text-sm text-[#333] whitespace-pre-wrap break-words font-mono">{text}</pre>;
}

/** Previews a file served by a route that supports `?inline=1`; falls back to a download prompt. */
export default function FilePreviewModal({ file, onClose }: { file: PreviewFile | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {file && (() => {
        const kind = previewKind(file.fileName);
        const inlineUrl = `${file.url}?inline=1`;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={file.fileName}
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[860px] max-h-[88vh] flex flex-col overflow-hidden"
            >
              <div className="px-6 py-4 flex items-center justify-between gap-4 border-b border-[#F0F0F0]">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1a1a1a] truncate">{file.fileName}</p>
                  <p className="text-xs text-[#888]">{formatBytes(file.size)}</p>
                  {file.description && <p className="text-sm text-[#555] mt-1.5 whitespace-pre-wrap">{file.description}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <a
                    href={file.url}
                    className="inline-flex items-center h-9 px-4 rounded-full bg-[#1a2030] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all"
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close preview"
                    className="text-[#888] hover:text-[#333] transition-colors"
                  >
                    <HugeiconsIcon icon={CancelCircleIcon} size={22} color="currentColor" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-[#FAFAFA] p-4 flex items-center justify-center min-h-[240px]">
                {kind === 'image' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={inlineUrl} alt={file.fileName} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                )}
                {kind === 'video' && <video src={inlineUrl} controls className="max-w-full max-h-[70vh] rounded-lg" />}
                {kind === 'pdf' && <iframe src={inlineUrl} title={file.fileName} className="w-full h-[70vh] rounded-lg bg-white" />}
                {kind === 'text' && <div className="w-full self-start"><TextPreview src={inlineUrl} /></div>}
                {kind === null && (
                  <div className="text-center py-8">
                    <p className="text-sm font-semibold text-[#1a1a1a] mb-1">This file can&apos;t be previewed</p>
                    <p className="text-sm text-[#888]">Download it to view it on your device.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        );
      })()}
    </AnimatePresence>
  );
}
