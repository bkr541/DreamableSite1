'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { File02Icon, CancelCircleIcon, Edit02Icon } from '@hugeicons/core-free-icons';
import { formatBytes, previewKind } from '@/components/FilePreviewModal';

interface FileTileProps {
  url: string;
  fileName: string;
  size: number;
  title?: string | null;
  description?: string | null;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/** 120px rounded square with a thumbnail for images/videos and a file icon for everything else. */
export default function FileTile({ url, fileName, size, title, description, onOpen, onEdit, onDelete }: FileTileProps) {
  const kind = previewKind(fileName);
  const ext = fileName.split('.').pop()?.toUpperCase() ?? 'FILE';

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onOpen}
        title={`${title || fileName} · ${fileName} · ${formatBytes(size)}`}
        className="relative block w-[120px] h-[120px] rounded-2xl overflow-hidden border border-[#EBEBEB] hover:border-[#1a2030]/25 hover:shadow-md transition-all"
      >
        {kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${url}?inline=1`} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {kind === 'video' && (
          <video src={`${url}?inline=1#t=0.1`} preload="metadata" muted playsInline className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        )}
        {kind !== 'image' && kind !== 'video' && (
          <div className="absolute inset-0 pb-7 flex flex-col items-center justify-center gap-1.5">
            <HugeiconsIcon icon={File02Icon} size={32} color="#AAAAAA" strokeWidth={1.5} />
            <span className="text-[10px] font-semibold tracking-widest text-[#AAA]">{ext}</span>
          </div>
        )}
        <span className="absolute inset-x-0 bottom-0 px-2.5 py-1.5 bg-white border-t border-[#F0F0F0] text-[11px] text-[#1a1a1a] truncate text-left">
          {title || fileName}
        </span>
      </button>
      {description && <p className="w-[120px] mt-1.5 text-[11px] leading-snug text-[#888] line-clamp-2" title={description}>{description}</p>}
      {(onEdit || onDelete) && (
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${title || fileName}`}
              title="Edit title and description"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#555] shadow-sm hover:text-[#1a2030]"
            >
              <HugeiconsIcon icon={Edit02Icon} size={14} color="currentColor" strokeWidth={1.75} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${title || fileName}`}
              title="Delete"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#e05252] shadow-sm hover:text-[#c03a3a]"
            >
              <HugeiconsIcon icon={CancelCircleIcon} size={16} color="currentColor" strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
