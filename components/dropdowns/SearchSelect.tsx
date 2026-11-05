'use client';

import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { useDropdown } from './shared';
import { filterOptions, norm, type SearchSelectOption } from '@/lib/searchFilter';

interface Props {
  id?: string;
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  /** Names the field for screen readers. */
  label: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}

/** The label with the part that matched what was typed in bold. */
function Highlight({ text, query }: { text: string; query: string }) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return <>{text}</>;
  const flat = norm(text);
  // Normalisation can change length for exotic characters; only highlight when positions still line up.
  if (flat.length !== text.length) return <>{text}</>;
  const marks = new Array<boolean>(text.length).fill(false);
  for (const w of words) for (let at = flat.indexOf(w); at !== -1; at = flat.indexOf(w, at + w.length)) for (let k = at; k < at + w.length; k++) marks[k] = true;
  const parts: { t: string; on: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.on === marks[i]) last.t += text[i];
    else parts.push({ t: text[i], on: marks[i] });
  }
  return <>{parts.map((p, i) => (p.on ? <strong key={i} className="font-semibold text-[#1a2030]">{p.t}</strong> : <Fragment key={i}>{p.t}</Fragment>))}</>;
}

/**
 * A search box with a list of matches. Click it (or start typing) and the list shows the options that match what you
 * typed; pick one with the mouse or with ↑ ↓ and Enter. Esc closes the list; leaving the box without picking puts the
 * current choice back, so free text is never saved by accident. The ✕ clears the choice.
 */
export default function SearchSelect({ id, value, options, onChange, label, placeholder, disabled = false, invalid = false }: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [typed, setTyped] = useState(false);

  const selected = options.find((o) => o.value === value) ?? null;
  const matches = filterOptions(options, typed ? query : '');

  const d = useDropdown({
    triggerRef: inputRef,
    popRef,
    count: matches.length,
    selectedIndex: matches.findIndex((o) => o.value === value),
    onSelect: (i) => { onChange(matches[i].value); setTyped(false); setQuery(''); },
    estimatedHeight: Math.min(matches.length * 52 + 16, 280),
  });

  const optionId = (i: number) => `${listId}-opt-${i}`;
  useEffect(() => {
    if (d.open) document.getElementById(optionId(d.activeIndex))?.scrollIntoView({ block: 'nearest' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.activeIndex, d.open]);

  const shown = d.open && typed ? query : selected?.label ?? '';

  const show = () => {
    if (disabled || d.open) return;
    setTyped(false);
    setQuery('');
    d.openList();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!d.open) { show(); return; }
      const n = matches.length;
      if (n) d.setActiveIndex((i) => (e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n));
    } else if (e.key === 'Enter') {
      e.preventDefault(); // never submit the surrounding form from here
      if (!d.open) show();
      else if (matches[d.activeIndex]) d.pick(d.activeIndex);
    } else if (e.key === 'Escape') {
      if (d.open) { e.preventDefault(); e.stopPropagation(); d.setOpen(false); setTyped(false); setQuery(''); }
    } else if (e.key === 'Tab') {
      d.setOpen(false);
    }
  };

  const border = invalid ? 'border-[#e05252]' : d.open ? 'border-[#4f6df5]' : 'border-[#D0D0D0] hover:border-[#B3B8C6]';

  return (
    <div className="relative">
      <HugeiconsIcon icon={Search01Icon} size={16} color="currentColor" strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa1b2]" />
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={d.open}
        aria-controls={listId}
        aria-activedescendant={d.open && matches[d.activeIndex] ? optionId(d.activeIndex) : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        disabled={disabled}
        value={shown}
        placeholder={placeholder ?? `Search ${label.toLowerCase()}…`}
        onFocus={(e) => { show(); e.currentTarget.select(); }}
        onClick={(e) => { show(); if (!typed) e.currentTarget.select(); }}
        onChange={(e) => { setTyped(true); setQuery(e.target.value); d.setActiveIndex(0); if (!d.open) d.setOpen(true); }}
        onKeyDown={onKeyDown}
        className={`w-full rounded-xl border bg-white py-2.5 pl-10 text-sm text-[#1a1a1a] placeholder:text-[#8a90a0] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all disabled:opacity-40 ${selected ? 'pr-10 font-medium' : 'pr-4'} ${border}`}
      />
      {selected && !disabled && (
        <button
          type="button"
          onClick={() => { onChange(''); setTyped(false); setQuery(''); inputRef.current?.focus(); }}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="absolute right-3 top-1/2 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full bg-[#E3E5EB] text-black transition-colors hover:bg-[#D2D6DF]"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={9} color="currentColor" strokeWidth={3.5} />
        </button>
      )}

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
                style={{ position: 'fixed', left: d.pos.left, width: d.pos.width, top: d.pos.above ? undefined : d.pos.top, bottom: d.pos.above ? window.innerHeight - d.pos.top : undefined }}
                onMouseDown={(e) => e.preventDefault() /* keep the cursor in the search box while clicking an option */}
                className="z-[200] overflow-hidden rounded-2xl border border-[#E2E4EA] bg-white shadow-[0_24px_60px_-16px_rgba(26,32,48,0.3)]"
              >
                <p role="status" className="sr-only">{matches.length === 0 ? 'No matches' : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`}</p>
                <ul id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-auto p-1.5">
                  {matches.length === 0 && (
                    <li role="presentation" className="px-3 py-4 text-sm text-[#8a90a0]">
                      {options.length === 0 ? 'Nothing to choose yet' : <>No matches for “{query}”</>}
                    </li>
                  )}
                  {matches.map((o, i) => {
                    const isSelected = o.value === value;
                    const active = d.activeIndex === i;
                    return (
                      <li
                        key={o.value}
                        id={optionId(i)}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => d.setActiveIndex(i)}
                        onClick={() => d.pick(i)}
                        className={`relative cursor-pointer rounded-lg py-2 pl-4 pr-3 transition-colors ${active ? 'bg-[#F3F5FB]' : ''}`}
                      >
                        <span className={`absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-gradient-to-b from-[#3DD9C8] via-[#7BB5F5] to-[#B87AF5] transition-opacity ${active || isSelected ? 'opacity-100' : 'opacity-0'}`} />
                        <p className={`truncate text-sm ${isSelected ? 'font-semibold text-[#1a2030]' : 'text-[#555]'}`}><Highlight text={o.label} query={typed ? query : ''} /></p>
                        {o.description && <p className="truncate text-xs text-[#8a90a0]"><Highlight text={o.description} query={typed ? query : ''} /></p>}
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
