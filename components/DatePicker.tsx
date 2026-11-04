'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon, Calendar03Icon } from '@hugeicons/core-free-icons';

interface DatePickerProps {
  id?: string;
  /** ISO date, YYYY-MM-DD, or '' for no date. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parse(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? { y: +match[1], m: +match[2] - 1, d: +match[3] } : null;
}

function display(iso: string) {
  const p = parse(iso);
  return p ? new Date(p.y, p.m, p.d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

/** Date field with the site's own calendar popover, instead of the browser's native date input. */
export default function DatePicker({ id, value, onChange, placeholder = 'Select a date', invalid = false, disabled = false, className = '' }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const p = parse(value);
    const now = new Date();
    return { y: p?.y ?? now.getFullYear(), m: p?.m ?? now.getMonth() };
  });
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const height = 372;
      const above = window.innerHeight - r.bottom < height + 16 && r.top > height + 16;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 304));
      setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above });
    };
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    place();
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  const toggle = () => {
    if (disabled) return;
    if (!open) {
      const p = parse(value);
      const now = new Date();
      setView({ y: p?.y ?? now.getFullYear(), m: p?.m ?? now.getMonth() });
    }
    setOpen((o) => !o);
  };

  const shiftMonth = (delta: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const first = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const selected = parse(value);
  const now = new Date();
  const todayIso = toIso(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popId}
        disabled={disabled}
        onClick={toggle}
        className={`w-full flex items-center justify-between gap-2 bg-white rounded-xl px-4 py-2.5 text-sm text-left border focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-200/50 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${invalid ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`}
      >
        <span className={`truncate ${value ? 'text-[#1a1a1a]' : 'text-[#bbb]'}`}>{value ? display(value) : placeholder}</span>
        <HugeiconsIcon icon={Calendar03Icon} size={16} color="currentColor" strokeWidth={1.75} className="shrink-0 text-[#999]" />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={popRef}
                id={popId}
                role="dialog"
                aria-label="Choose a date"
                initial={{ opacity: 0, y: pos.above ? 6 : -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: pos.above ? 6 : -6 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  left: pos.left,
                  top: pos.above ? undefined : pos.top,
                  bottom: pos.above ? window.innerHeight - pos.top : undefined,
                }}
                className="z-[200] w-[296px] rounded-2xl bg-white border border-[#E5E5E5] shadow-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-full text-[#555] hover:bg-[#F1F2F7] transition-colors">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={16} color="currentColor" strokeWidth={2} />
                  </button>
                  <p className="text-sm font-semibold text-[#1a1a1a]">{MONTHS[view.m]} {view.y}</p>
                  <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-full text-[#555] hover:bg-[#F1F2F7] transition-colors">
                    <HugeiconsIcon icon={ArrowRight01Icon} size={16} color="currentColor" strokeWidth={2} />
                  </button>
                </div>

                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAYS.map((w) => (
                    <span key={w} className="text-center text-[10px] font-semibold uppercase tracking-widest text-[#AAA] py-1">{w}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1">
                  {cells.map((day, i) => {
                    if (!day) return <span key={i} />;
                    const iso = toIso(view.y, view.m, day);
                    const isSelected = !!selected && selected.y === view.y && selected.m === view.m && selected.d === day;
                    const isToday = iso === todayIso;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => pick(iso)}
                        aria-label={display(iso)}
                        aria-pressed={isSelected}
                        className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
                          isSelected
                            ? 'bg-[#1a2030] text-white font-semibold'
                            : isToday
                              ? 'border border-[#1a2030]/40 text-[#1a1a1a] hover:bg-[#eef2ff]'
                              : 'text-[#333] hover:bg-[#eef2ff]'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F0F0F0]">
                  <button type="button" onClick={() => pick('')} className="text-sm font-medium text-[#888] hover:text-[#1a2030] transition-colors">
                    Clear
                  </button>
                  <button type="button" onClick={() => pick(todayIso)} className="text-sm font-medium text-[#7c3aed] hover:text-[#5b21b6] transition-colors">
                    Today
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
