'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import type { HugeiconsIcon } from '@hugeicons/react';

type IconData = Parameters<typeof HugeiconsIcon>[0]['icon'];

export interface DropdownOption {
  value: string;
  label: string;
  /** Tailwind background class for a status dot, e.g. 'bg-green-500'. */
  dot?: string;
  icon?: IconData;
}

export interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** Short name of the thing being filtered, e.g. "Status". */
  label: string;
  id?: string;
}

export interface Anchor {
  left: number;
  top: number;
  width: number;
  above: boolean;
}

/**
 * Shared behavior for the filter dropdowns under review: open state, keyboard navigation, and a popover
 * that's positioned against the trigger (and rendered at <body> level so dialogs and scroll areas can't clip it).
 */
export function useDropdown({
  triggerRef,
  popRef,
  count,
  selectedIndex,
  onSelect,
  estimatedHeight = 280,
  popoverWidth = 0,
  closeDelay = 0,
}: {
  /** Refs are created by the component (not here) so reading them stays in effects and handlers. */
  triggerRef: RefObject<HTMLElement | null>;
  popRef: RefObject<HTMLElement | null>;
  count: number;
  selectedIndex: number;
  /** Called with the chosen index; the hook then closes the popover and returns focus to the trigger. */
  onSelect: (index: number) => void;
  estimatedHeight?: number;
  popoverWidth?: number;
  /** Wait this long (ms) before closing after a pick, so a selection animation can finish. */
  closeDelay?: number;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pos, setPos] = useState<Anchor | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const above = window.innerHeight - r.bottom < estimatedHeight + 16 && r.top > estimatedHeight + 16;
      const w = Math.max(r.width, popoverWidth);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      setPos({ left, top: above ? r.top - 8 : r.bottom + 8, width: w, above });
    };
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    place();
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, estimatedHeight, popoverWidth, triggerRef, popRef]);

  const pick = (index: number) => {
    onSelect(index);
    const finish = () => {
      setOpen(false);
      triggerRef.current?.focus();
    };
    if (closeDelay > 0) setTimeout(finish, closeDelay);
    else finish();
  };

  const openList = () => {
    setActiveIndex(Math.max(0, selectedIndex));
    setOpen(true);
  };

  /** Arrow / Enter / Escape handling; attach to the trigger (or a search input inside the popover). */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (count ? (i + 1) % count : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (count ? (i - 1 + count) % count : 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); }
    else if (e.key === 'End') { e.preventDefault(); setActiveIndex(Math.max(0, count - 1)); }
    else if (e.key === 'Enter' || (e.key === ' ' && !(e.target instanceof HTMLInputElement))) {
      e.preventDefault();
      if (count) pick(activeIndex);
    } else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return { open, setOpen, activeIndex, setActiveIndex, pos, handleKeyDown, openList, pick };
}
