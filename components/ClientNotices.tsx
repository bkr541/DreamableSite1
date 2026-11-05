'use client';

import { useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon, Alert02Icon, ArrowLeft01Icon, CheckmarkCircle02Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { Avatar, StatusDot } from '@/components/RecordList';
import { ModalSectionHeader } from '@/components/ModalParts';
import type { ClientNotice, NoticeSeverity } from '@/lib/clientNotices';

// The "Notices" screen for one client: every message, warning, error and piece of information about them, in one place.

const LOOK: Record<NoticeSeverity, { icon: typeof AlertCircleIcon; tile: string; label: string; chip: string }> = {
  error:   { icon: AlertCircleIcon,       tile: 'bg-red-50 text-[#e05252]',     label: 'Error',   chip: 'bg-red-50 text-[#c23b3b]' },
  warning: { icon: Alert02Icon,           tile: 'bg-amber-50 text-[#b86e00]',   label: 'Warning', chip: 'bg-amber-50 text-[#a36200]' },
  info:    { icon: InformationCircleIcon, tile: 'bg-[#EEF2FF] text-[#4f6df5]',  label: 'Info',    chip: 'bg-[#EEF2FF] text-[#4f6df5]' },
  success: { icon: CheckmarkCircle02Icon, tile: 'bg-green-50 text-[#2f9e5b]',   label: 'OK',      chip: 'bg-green-50 text-[#2a8a50]' },
};

function when(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const dateOnly = iso.endsWith('T00:00:00.000Z');
  return d.toLocaleString('en-US', dateOnly
    ? { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
    : { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface ClientInfo { id: string; name: string; email: string; status: string; company: { name: string } | null }

export default function ClientNoticesScreen({ client, notices, onBack, onAction }: {
  client: ClientInfo;
  notices: ClientNotice[];
  onBack: () => void;
  onAction: (notice: ClientNotice) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  const attention = notices.filter((n) => n.severity === 'error' || n.severity === 'warning');
  const information = notices.filter((n) => n.severity === 'info' || n.severity === 'success');
  const count = (s: NoticeSeverity) => notices.filter((n) => n.severity === s).length;

  const row = (n: ClientNotice) => {
    const look = LOOK[n.severity];
    const at = when(n.at);
    return (
      <li key={n.id} className="flex items-start gap-4 rounded-2xl border border-[#EBEBEF] bg-white p-4">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${look.tile}`}>
          <HugeiconsIcon icon={look.icon} size={19} color="currentColor" strokeWidth={1.75} />
          <span className="sr-only">{look.label}:</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#1a1a1a]">{n.title}</p>
          {n.detail && <p className="mt-1 text-sm leading-relaxed text-[#666] break-words">{n.detail}</p>}
          {n.action && (
            <button
              type="button"
              onClick={() => onAction(n)}
              className="mt-3 inline-flex h-8 items-center rounded-full bg-[#1a2030] px-4 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              {n.action.label}
            </button>
          )}
        </div>
        {at && <p className="shrink-0 pt-0.5 text-xs text-[#999]">{at}</p>}
      </li>
    );
  };

  return (
    <section aria-labelledby="client-notices-title" className="mx-auto w-full max-w-[860px]">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[#D5D8DE] bg-white py-1.5 pl-2.5 pr-4 text-sm font-medium text-[#4b5260] transition-colors hover:bg-[#F5F6F8] hover:text-[#1a1a1a]"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={16} color="currentColor" strokeWidth={2} />
        Back to clients
      </button>

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-[#EBEBEF] bg-white p-5">
        <Avatar name={client.name} size={48} />
        <div className="min-w-0 flex-1">
          <h2 id="client-notices-title" ref={heading} tabIndex={-1} className="text-lg font-semibold tracking-tight text-[#1a1a1a] outline-none">Notices for {client.name}</h2>
          <p className="truncate text-sm text-[#666]">{client.email}{client.company ? ` · ${client.company.name}` : ''}</p>
        </div>
        <StatusDot status={client.status} />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(['error', 'warning', 'info', 'success'] as NoticeSeverity[]).filter((s) => count(s) > 0).map((s) => (
          <span key={s} className={`rounded-full px-3 py-1 text-xs font-semibold ${LOOK[s].chip}`}>{count(s)} {LOOK[s].label.toLowerCase()}{count(s) === 1 ? '' : 's'}</span>
        ))}
      </div>

      {attention.length > 0 ? (
        <div className="mb-8 space-y-3">
          <ModalSectionHeader icon={Alert02Icon}>Needs attention</ModalSectionHeader>
          <ul className="space-y-3">{attention.map(row)}</ul>
        </div>
      ) : (
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50/60 p-4 text-sm font-medium text-[#2a8a50]">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color="currentColor" strokeWidth={1.75} />
          Nothing needs attention for this client.
        </div>
      )}

      {information.length > 0 && (
        <div className="space-y-3">
          <ModalSectionHeader icon={InformationCircleIcon}>Information</ModalSectionHeader>
          <ul className="space-y-3">{information.map(row)}</ul>
        </div>
      )}
    </section>
  );
}
