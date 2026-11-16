'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, ArrowDown01Icon, FolderAddIcon, MoreHorizontalIcon } from '@hugeicons/core-free-icons';

export default function DeliverablesAddMenu({ onNewFolder }: { onNewFolder: () => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open || !trigger.current || !menu.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const bounds = menu.current.getBoundingClientRect();
    const below = anchor.bottom + 8;
    const desiredTop = below + bounds.height > window.innerHeight - 12 ? anchor.top - bounds.height - 8 : below;
    menu.current.style.top = `${Math.max(12, Math.min(desiredTop, window.innerHeight - bounds.height - 12))}px`;
    menu.current.style.left = `${Math.max(12, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 12))}px`;
    menu.current.style.visibility = 'visible';
    firstItem.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      else if (event.key === 'Tab') { setOpen(false); trigger.current?.focus(); }
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        firstItem.current?.focus(); // The future options are intentionally disabled.
      }
    };
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => { if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true); } }}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1a2030] px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#4f6df5]"
      >
        <HugeiconsIcon icon={Add01Icon} size={17} color="currentColor" strokeWidth={1.75} />
        Add New
        <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="currentColor" strokeWidth={1.75} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={menu} id={menuId} role="menu" aria-label="Add deliverable" style={{ top: 0, left: 0, visibility: 'hidden' }} className="fixed z-[160] w-64 max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-[#E2E4EA] bg-white p-2 shadow-xl">
          <button
            ref={firstItem}
            role="menuitem"
            type="button"
            onClick={() => { trigger.current?.focus(); setOpen(false); onNewFolder(); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#1a2030] hover:bg-[#EEF2FF] focus:bg-[#EEF2FF] focus:outline-none"
          >
            <HugeiconsIcon icon={FolderAddIcon} size={19} color="#4f6df5" strokeWidth={1.5} />
            New Folder
          </button>
          <div role="separator" className="my-1 border-t border-[#F0F1F5]" />
          {[1, 2, 3].map((number) => (
            <button key={number} role="menuitem" type="button" disabled className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[#999]">
              <HugeiconsIcon icon={MoreHorizontalIcon} size={19} color="currentColor" strokeWidth={1.5} />
              <span className="flex-1">Future option {number}</span>
              <span className="rounded-full bg-[#F6F7F9] px-2 py-1 text-[10px] font-medium">Coming soon</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
