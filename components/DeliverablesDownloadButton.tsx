'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Download04Icon } from '@hugeicons/core-free-icons';

export default function DeliverablesDownloadButton({ projectId, folderId, disabled = false, compact = false }: {
  projectId: string; folderId?: string; disabled?: boolean; compact?: boolean;
}) {
  const label = folderId ? 'Download this folder as ZIP' : 'Download all deliverable folders as ZIP';
  const query = new URLSearchParams({ projectId, ...(folderId ? { folderId } : {}) });
  return (
    <a
      href={disabled ? undefined : `/api/admin/deliverables/download?${query}`}
      download
      title={label}
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[#D5D9E4] bg-white text-[#4b5260] transition-colors hover:border-[#7BB5F5] hover:bg-[#EEF2FF] focus-visible:outline-2 focus-visible:outline-[#4f6df5] ${compact ? 'h-9 w-9' : 'h-10 w-10'} ${disabled ? 'pointer-events-none opacity-40' : ''}`}
    >
      <HugeiconsIcon icon={Download04Icon} size={compact ? 18 : 20} color="currentColor" strokeWidth={1.5} />
    </a>
  );
}
