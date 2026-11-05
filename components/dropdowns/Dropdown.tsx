'use client';

import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Cancel01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { DropdownOption, useDropdown } from './shared';

interface DropdownProps {
  id?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** Names the field: used for the panel header and screen readers, and as the empty text when no "" option is given. */
  label: string;
  /** Tailwind width class. Filters use a fixed width so the field never resizes; forms pass 'w-full'. */
  width?: string;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * The admin portal's standard dropdown.
 *  - Empty: a white field with a dashed outline, showing the "" option's text (e.g. "All statuses") and a chevron.
 *  - Chosen: a pale-indigo field with the value in blue and a small gray ✕ right after it. The chevron is hidden
 *    while the ✕ is showing. Icons and status dots live in the list, never in the field.
 *  - The field never changes size with its value; long values are truncated.
 *  - A field with no "" option (a required choice) can't be cleared and keeps its chevron.
 */
export default function Dropdown({ id, value, options, onChange, label, width = 'w-[228px]', disabled = false, invalid = false }: DropdownProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const emptyOption = options.find((o) => o.value === '');
  const clearable = !!emptyOption;
  const items = options.filter((o) => o.value !== '');
  const selected = items.find((o) => o.value === value) ?? null;
  const unsetText = emptyOption?.label ?? `Select ${label.toLowerCase()}`;
  const showClear = !!selected && clearable && !disabled;

  const d = useDropdown({
    triggerRef,
    popRef,
    count: items.length,
    selectedIndex: items.findIndex((o) => o.value === value),
    onSelect: (i) => onChange(items[i].value),
    estimatedHeight: Math.min(items.length * 46 + 64, 320),
    popoverWidth: 220,
  });

  const shell = selected
    ? `border ${invalid ? 'border-[#e05252]' : 'border-[#E1E7FB]'} bg-[#EEF2FF] text-[#4f6df5]`
    : `border border-dashed bg-white ${invalid ? 'border-[#e05252] text-[#5d6680]' : d.open ? 'border-[#4f6df5] text-[#4f6df5]' : 'border-[#B8BFD3] text-[#5d6680] hover:border-[#7a869f]'}`;

  return (
    <div className={width === 'w-full' ? 'block' : 'inline-block'}>
      <div className={`flex items-center overflow-hidden rounded-lg transition-colors ${width} ${shell} ${disabled ? 'opacity-40' : ''}`}>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          role="combobox"
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={d.open}
          aria-controls={listId}
          disabled={disabled}
          onClick={() => (d.open ? d.setOpen(false) : d.openList())}
          onKeyDown={d.handleKeyDown}
          className={`flex min-w-0 items-center gap-2 py-2 pl-3 text-left text-sm font-medium focus:outline-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${showClear ? 'flex-initial pr-2' : 'flex-1 pr-3'}`}
        >
          <span className={`truncate ${selected ? 'font-semibold' : 'font-medium'}`}>{selected ? selected.label : unsetText}</span>
          {!showClear && (
            <HugeiconsIcon icon={ArrowDown01Icon} size={13} color="currentColor" strokeWidth={2.25} className={`ml-auto shrink-0 transition-transform ${selected ? 'text-[#4f6df5]' : 'text-[#7a869f]'} ${d.open ? 'rotate-180' : ''}`} />
          )}
        </button>
        {showClear && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="mr-3 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#E3E5EB] text-black hover:bg-[#D2D6DF] transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={9} color="currentColor" strokeWidth={3.5} />
          </button>
        )}
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {d.open && d.pos && (
              <motion.div
                ref={popRef}
                initial={{ opacity: 0, y: d.pos.above ? 6 : -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: d.pos.above ? 6 : -6 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{ position: 'fixed', left: d.pos.left, width: Math.max(d.pos.width, 220), top: d.pos.above ? undefined : d.pos.top, bottom: d.pos.above ? window.innerHeight - d.pos.top : undefined }}
                className="z-[200] overflow-hidden rounded-2xl border border-[#E2E4EA] bg-white shadow-[0_24px_60px_-16px_rgba(26,32,48,0.3)]"
              >
                <p className="px-4 pb-2 pt-3.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7a869f]">{label}</p>
                <ul id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-auto px-1.5 pb-1.5">
                  {items.length === 0 && <li className="px-3 py-4 text-sm text-[#999]">Nothing to choose yet</li>}
                  {items.map((o, i) => {
                    const isSelected = o.value === value;
                    const active = d.activeIndex === i;
                    return (
                      <li key={o.value} role="presentation" className={i > 0 ? 'border-t border-dashed border-[#DDE1EC]' : ''}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onMouseEnter={() => d.setActiveIndex(i)}
                          onClick={() => d.pick(i)}
                          className={`relative flex w-full items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-left text-sm transition-colors ${active ? 'bg-[#F3F5FB]' : ''}`}
                        >
                          <span className={`absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-gradient-to-b from-[#3DD9C8] via-[#7BB5F5] to-[#B87AF5] transition-opacity ${active || isSelected ? 'opacity-100' : 'opacity-0'}`} />
                          {o.icon ? (
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isSelected ? 'bg-gradient-to-br from-[#3DD9C8] to-[#7BB5F5] text-white' : 'bg-[#EEF2FF] text-[#4f6df5]'}`}>
                              <HugeiconsIcon icon={o.icon} size={16} color="currentColor" strokeWidth={1.7} />
                            </span>
                          ) : o.dot ? (
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${o.dot}`} />
                          ) : null}
                          <span className={`flex-1 truncate ${isSelected ? 'font-semibold text-[#1a2030]' : 'text-[#555]'}`}>{o.label}</span>
                          {isSelected && !o.icon && <HugeiconsIcon icon={Tick02Icon} size={14} color="#4f6df5" strokeWidth={2.5} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
