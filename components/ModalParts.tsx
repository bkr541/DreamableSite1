import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

// The three pieces every pop-up shares, so a dialog looks the same wherever it appears.

/** Close (X) button for a pop-up's top-right corner. A tinted circle with a dark icon, so it is easy to see and to hit. */
export function ModalCloseButton({ onClick, label = 'Close', inline = false, disabled = false }: { onClick: () => void; label?: string; inline?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`${inline ? 'shrink-0' : 'absolute top-4 right-4 z-10'} flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F2F5] text-[#4b5260] transition-colors hover:bg-[#E4E6EB] hover:text-[#1a1a1a] focus-visible:outline-2 focus-visible:outline-[#4f6df5] disabled:opacity-50`}
    >
      <HugeiconsIcon icon={Cancel01Icon} size={18} color="currentColor" strokeWidth={2} />
    </button>
  );
}

/** Heading for a group of fields inside a pop-up: an icon tile on the left, a clear title, and a hairline underneath. */
export function ModalSectionHeader({ icon, children }: { icon: Parameters<typeof HugeiconsIcon>[0]['icon']; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[#EDEEF2] pb-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4f6df5]">
        <HugeiconsIcon icon={icon} size={17} color="currentColor" strokeWidth={1.75} />
      </span>
      <h3 className="text-[15px] font-semibold tracking-tight text-[#1a2030]">{children}</h3>
    </div>
  );
}

/** Secondary button for "Cancel": a light grey rounded outline. Put it directly to the left of the primary button, right-aligned. */
export const MODAL_CANCEL_CLASS =
  'inline-flex h-10 items-center justify-center rounded-full border border-[#D5D8DE] bg-white px-6 text-sm font-medium text-[#4b5260] transition-colors hover:border-[#B9BEC8] hover:bg-[#F5F6F8] hover:text-[#1a1a1a] focus-visible:outline-2 focus-visible:outline-[#4f6df5] disabled:opacity-50';
