'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon, Alert02Icon, CheckmarkCircle02Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { ModalSectionHeader } from '@/components/ModalParts';
import type { ClientNotice, NoticeSeverity } from '@/lib/clientNotices';

// The notices for one client: every message, warning, error and piece of information about them, in one place. Shown on the
// client's page (components/ClientDetail.tsx).

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

export default function ClientNotices({ notices, onAction }: { notices: ClientNotice[]; onAction: (notice: ClientNotice) => void }) {
  const attention = notices.filter((n) => n.severity === 'error' || n.severity === 'warning');
  const information = notices.filter((n) => n.severity === 'info' || n.severity === 'success');

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
    <div className="space-y-8">
      {attention.length > 0 ? (
        <div className="space-y-3">
          <ModalSectionHeader icon={Alert02Icon}>Needs attention</ModalSectionHeader>
          <ul className="space-y-3">{attention.map(row)}</ul>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50/60 p-4 text-sm font-medium text-[#2a8a50]">
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
    </div>
  );
}
