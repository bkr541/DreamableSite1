'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon } from '@hugeicons/core-free-icons';

export const STATUS_DOT: Record<string, string> = {
  INQUIRY: 'bg-amber-400',
  APPROVED: 'bg-green-500',
  REJECTED: 'bg-red-500',
  ACTIVE: 'bg-blue-500',
  INVITED: 'bg-purple-500',
  SUSPENDED: 'bg-red-500',
  ARCHIVED: 'bg-gray-400',
  ONBOARDING: 'bg-sky-500',
  COMPLETED: 'bg-gray-400',
  CANCELLED: 'bg-red-400',
  // Invoice statuses
  Unsent: 'bg-gray-400',
  'Not Paid': 'bg-amber-400',
  Paid: 'bg-green-500',
};

const AVATAR_GRADIENTS = [
  'from-[#3DD9C8] to-[#7BB5F5]',
  'from-[#7BB5F5] to-[#B87AF5]',
  'from-[#B87AF5] to-[#F58AC8]',
  'from-[#F5B87A] to-[#F58A8A]',
  'from-[#6EDC9B] to-[#3DD9C8]',
];

/** Round initials badge; the gradient is picked from the name so a person always gets the same color. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  const hue = Array.from(name).reduce((h, c) => h + c.charCodeAt(0), 0) % AVATAR_GRADIENTS.length;
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={`shrink-0 inline-flex items-center justify-center rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[hue]} font-semibold text-white`}
    >
      {initials}
    </span>
  );
}

/** Colored dot + capitalized label, e.g. "● active". */
export function StatusDot({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-medium capitalize text-[#333]">
      <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status] ?? 'bg-gray-300'}`} />
      {status.toLowerCase()}
    </span>
  );
}

export interface RecordColumn<T> {
  key: string;
  label: string;
  /** CSS grid track, e.g. 'minmax(0,2fr)' or '120px'. */
  width: string;
  render: (row: T) => React.ReactNode;
}

export interface RecordTrailing<T> {
  label?: string;
  width: string;
  render: (row: T) => React.ReactNode;
  /** True when the cell holds its own buttons, so clicking it must not trigger the row click. */
  interactive?: boolean;
}

interface RecordListProps<T> {
  /** Rows currently shown (after filters). */
  rows: T[];
  rowKey: (row: T) => string;
  columns: RecordColumn<T>[];
  trailing?: RecordTrailing<T>;
  onRowClick?: (row: T) => void;
  search: { value: string; onChange: (v: string) => void; placeholder: string };
  /** Filter controls shown next to the search box. */
  filters?: React.ReactNode;
  emptyMessage: string;
  expanded?: (row: T) => boolean;
  renderExpanded?: (row: T) => React.ReactNode;
}

/**
 * The standard record listing: card with search + filters,
 * an always-visible column header row, zebra rows, and optional expandable detail rows.
 */
export default function RecordList<T>({
  rows,
  rowKey,
  columns,
  trailing,
  onRowClick,
  search,
  filters,
  emptyMessage,
  expanded,
  renderExpanded,
}: RecordListProps<T>) {
  // Hover is tracked in state (not CSS) so the effect is identical in every browser and build.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const template = [...columns.map((c) => c.width), ...(trailing ? [trailing.width] : [])].join(' ');
  const gridStyle = { gridTemplateColumns: template };
  const headers = [...columns.map((c) => c.label), ...(trailing ? [trailing.label ?? ''] : [])];

  return (
    <div className="bg-white rounded-2xl border border-[#E2E4EA] shadow-sm overflow-hidden">
      <div className="px-6 pt-4 pb-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <HugeiconsIcon icon={Search01Icon} size={18} color="#999999" strokeWidth={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={search.placeholder}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            className="w-full bg-[#F6F7FA] border border-transparent rounded-full pl-11 pr-4 py-2 text-sm text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:bg-white focus:border-[#D0D4E0] focus:ring-2 focus:ring-purple-200/60 transition-all"
          />
        </div>
        {filters}
      </div>

      {/* One scroll area: long lists scroll here while the column headings stay pinned. */}
      <div className="overflow-auto max-h-[calc(100vh-300px)] min-h-[260px]">
        <div className="min-w-[880px]">
          {/* Column headings stay visible even when there are no records */}
          <div style={gridStyle} className="sticky top-0 z-10 grid gap-1.5 px-6 py-2.5 bg-[#EEF0F6] border-y border-[#E2E4EA]">
            {headers.map((h, i) => (
              <p key={i} className="text-xs font-bold uppercase tracking-wider text-[#4a5368]">{h}</p>
            ))}
          </div>

          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-[#666]">{emptyMessage}</p>
          ) : (
            <ul>
              {rows.map((row, idx) => {
                const key = rowKey(row);
                const active = activeKey === key;
                const isExpanded = expanded?.(row) ?? false;
                const clickable = !!onRowClick;
                return (
                  <li key={key} className={`border-b border-[#EEF0F4] last:border-b-0 ${idx % 2 === 1 ? 'bg-[#FAFBFD]' : 'bg-white'}`}>
                    <div
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      aria-expanded={renderExpanded ? isExpanded : undefined}
                      data-active={active ? 'true' : undefined}
                      onClick={clickable ? () => onRowClick(row) : undefined}
                      onMouseEnter={clickable ? () => setActiveKey(key) : undefined}
                      onMouseLeave={clickable ? () => setActiveKey((k) => (k === key ? null : k)) : undefined}
                      onFocus={clickable ? (e) => { if (e.target === e.currentTarget) setActiveKey(key); } : undefined}
                      onBlur={clickable ? () => setActiveKey((k) => (k === key ? null : k)) : undefined}
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                onRowClick(row);
                              }
                            }
                          : undefined
                      }
                      className={`relative text-left ${clickable ? 'cursor-pointer focus:outline-none' : ''}`}
                    >
                      {/* Accent bar that grows from the middle of the row's left edge. */}
                      {clickable && (
                        <motion.span
                          aria-hidden="true"
                          initial={false}
                          animate={{ scaleY: active ? 1 : 0, opacity: active ? 1 : 0 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="pointer-events-none absolute left-0 top-2 bottom-2 w-1 origin-center rounded-r-full bg-gradient-to-b from-[#3DD9C8] via-[#7BB5F5] to-[#B87AF5]"
                        />
                      )}
                      <div style={gridStyle} className="grid gap-1.5 px-6 py-2 items-center">
                        {columns.map((c) => (
                          <div key={c.key} className="min-w-0">{c.render(row)}</div>
                        ))}
                        {trailing && (
                          <div className="min-w-0" onClick={trailing.interactive ? (e) => e.stopPropagation() : undefined}>
                            {trailing.render(row)}
                          </div>
                        )}
                      </div>
                    </div>

                    {renderExpanded && (
                      <div style={{ display: 'grid', gridTemplateRows: isExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.2s ease-in-out' }}>
                        <div className="overflow-hidden">{renderExpanded(row)}</div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
