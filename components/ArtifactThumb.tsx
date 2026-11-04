'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { File02Icon } from '@hugeicons/core-free-icons';
import { previewKind } from '@/components/FilePreviewModal';

interface ArtifactThumbProps {
  /** URL to load the media from (a served file, or a blob URL for a file that isn't uploaded yet). */
  src: string;
  fileName: string;
  /** Square size in px. */
  size?: number;
  className?: string;
}

/** Square thumbnail: the image itself, a video's first frame, or a file icon with the extension. */
export default function ArtifactThumb({ src, fileName, size = 72, className = '' }: ArtifactThumbProps) {
  const kind = previewKind(fileName);
  const ext = fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
  return (
    <span
      style={{ width: size, height: size }}
      className={`relative inline-block shrink-0 overflow-hidden rounded-xl border border-[#EBEBEB] bg-[#F6F7FB] ${className}`}
    >
      {kind === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {kind === 'video' && (
        <video src={`${src}#t=0.1`} preload="metadata" muted playsInline className="absolute inset-0 h-full w-full object-cover pointer-events-none" />
      )}
      {kind !== 'image' && kind !== 'video' && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <HugeiconsIcon icon={File02Icon} size={Math.round(size * 0.36)} color="#AAAAAA" strokeWidth={1.5} />
          <span className="text-[9px] font-semibold tracking-widest text-[#AAA]">{ext}</span>
        </span>
      )}
    </span>
  );
}
