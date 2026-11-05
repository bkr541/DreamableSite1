'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons';

export type SelectOption = string | { value: string; label: string };

type Variant = 'default' | 'form' | 'compact' | 'underline';

interface CustomSelectProps {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Shown (muted) when `value` matches no option. */
  placeholder?: string;
  disabled?: boolean;
  /** Marks the field as having a validation error. */
  invalid?: boolean;
  /** default: marketing forms · form: admin dialogs · compact: filter bars · underline: line-style forms. */
  variant?: Variant;
  className?: string;
}

// Horizontal padding is shared by the label and the chevron, so the space to the right of the icon matches the space left of the text.
const TRIGGER: Record<Variant, string> = {
  default: 'w-full gap-2 bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] border focus-visible:ring-2 focus-visible:ring-cyan-200/50',
  form: 'w-full gap-2 bg-white rounded-xl px-3 py-2.5 text-sm text-[#1a1a1a] border focus-visible:ring-2 focus-visible:ring-purple-200/50',
  compact: 'gap-2 bg-[#FAFAFA] rounded-xl px-3 py-2 text-sm text-[#1a1a1a] border focus-visible:ring-2 focus-visible:ring-purple-200/50',
  underline: 'w-full gap-2 bg-transparent rounded-none px-0 py-3 text-[#1a1a1a] border-0 border-b',
};

const normalize = (o: SelectOption) => (typeof o === 'string' ? { value: o, label: o } : o);

export default function CustomSelect({
  id,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  invalid = false,
  variant = 'default',
  className = '',
}: CustomSelectProps) {
  const items = options.map(normalize);
  const optionCount = options.length;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; above: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selectedIndex = items.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;

  // The list is portalled to <body> and positioned against the trigger, so dialogs and scroll areas can't clip it.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const needed = Math.min(256, optionCount * 40 + 12);
      const above = window.innerHeight - r.bottom < needed + 16 && r.top > needed + 16;
      setPos({ left: r.left, top: above ? r.top - 8 : r.bottom + 8, width: r.width, above });
    };
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
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
  }, [open, optionCount]);

  const openList = () => {
    if (disabled) return;
    setActiveIndex(Math.max(0, selectedIndex));
    setOpen(true);
  };

  const select = (option: string) => {
    onChange(option);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(items.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (items[activeIndex]) select(items[activeIndex].value);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const border = invalid
    ? 'border-[#e05252]'
    : variant === 'underline'
      ? 'border-[#E5E5E5] focus-visible:border-[#000000]'
      : variant === 'compact'
        ? 'border-[#EBEBEB]'
        : 'border-[#D0D0D0]';

  return (
    <div className={`${variant === 'compact' ? 'inline-block' : 'block'} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        className={`flex items-center justify-between text-left focus:outline-none transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${TRIGGER[variant]} ${border}`}
      >
        <span className={`truncate ${selected ? '' : 'text-[#6b6b6b]'}`}>{selected ? selected.label : placeholder ?? ''}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          color="currentColor"
          strokeWidth={2}
          className={`shrink-0 text-[#999] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.ul
                ref={listRef}
                id={listId}
                role="listbox"
                initial={{ opacity: 0, y: pos.above ? 6 : -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: pos.above ? 6 : -6 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  left: pos.left,
                  minWidth: pos.width,
                  top: pos.above ? undefined : pos.top,
                  bottom: pos.above ? window.innerHeight - pos.top : undefined,
                }}
                className="z-[200] w-max max-w-[min(360px,calc(100vw-16px))] max-h-64 overflow-auto rounded-xl bg-white border border-[#E5E5E5] shadow-lg p-1.5"
              >
                {items.map((option, i) => {
                  const isSelected = option.value === value;
                  const isActive = i === activeIndex;
                  return (
                    <li
                      key={`${option.value}-${i}`}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => select(option.value)}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors ${isActive ? 'bg-[#eef2ff]' : ''} ${isSelected ? 'text-[#1a2030] font-medium' : 'text-[#555]'}`}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && (
                        <HugeiconsIcon icon={Tick02Icon} size={14} color="currentColor" strokeWidth={2.5} className="shrink-0 text-[#1a2030]" />
                      )}
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
