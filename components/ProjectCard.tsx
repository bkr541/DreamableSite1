import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import ServiceArt from '@/components/ServiceArt';
import { dueBadge } from '@/lib/projectDue';
import { File01Icon, Invoice01Icon, Calendar03Icon } from '@hugeicons/core-free-icons';

// A project as a card: service, status, progress through the workflow, dates, a due-date badge and how many files and
// invoices belong to it. Used where a client's projects are listed.

export interface ProjectCardData {
  id: string;
  name: string;
  service: string;
  status: string;
  createdAt: string;
  startDate: string | null;
  targetEndDate: string | null;
}

const STEPS = ['Onboarding', 'In Progress', 'In Review', 'Completed'];
const STEP_OF: Record<string, number> = { ONBOARDING: 1, IN_PROGRESS: 2, REVIEW: 3, COMPLETED: 4 };
// Dates are calendar days (no time of day), so read and show them in UTC to avoid shifting by a day.
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null);

const TONE = { red: 'bg-red-50 text-[#c23b3b]', amber: 'bg-amber-50 text-[#a36200]', slate: 'bg-[#F1F3F8] text-[#5a6275]' };

export default function ProjectCard({
  project, statusBadge, files, invoices, onOpen,
}: {
  project: ProjectCardData;
  /** The app's status pill, so colours stay the same everywhere. */
  statusBadge: ReactNode;
  files: number;
  invoices: number;
  onOpen: () => void;
}) {
  const step = STEP_OF[project.status] ?? 0;
  const due = dueBadge(project.status, project.targetEndDate);
  const start = fmt(project.startDate);
  const target = fmt(project.targetEndDate);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open project ${project.name}`}
      className="group flex h-full w-full items-start gap-4 rounded-2xl border border-[#E8E8EC] bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#1a2030]/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#4f6df5]"
    >
      <ServiceArt service={project.service} size={56} className="shrink-0" />
      <div className="flex h-full min-w-0 flex-1 flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex max-w-[60%] items-center truncate rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#4f6df5]">{project.service}</span>
        {statusBadge}
      </div>

      <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-[#1a1a1a]">{project.name}</h3>

      {step > 0 && (
        <div>
          <div className="mb-1.5 flex justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#1a2030]">{STEPS[step - 1]}</span>
            <span className="text-[10px] font-semibold tracking-wide text-[#999]">Step {step} of 4</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#F0F0F0]" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={step} aria-label={`${project.name} progress`}>
            <div className="h-full rounded-full bg-[#1a2030]" style={{ width: `${(step / 4) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs text-[#707070]">
          <HugeiconsIcon icon={Calendar03Icon} size={14} color="currentColor" strokeWidth={1.5} />
          <span>{start ? `Started ${start}` : `Created ${fmt(project.createdAt)}`}{target ? ` · Target ${target}` : ''}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[#F3F3F5] pt-3">
          {due && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE[due.tone]}`}>{due.label}</span>}
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F7F7F8] px-2.5 py-0.5 text-[11px] font-medium text-[#555]">
            <HugeiconsIcon icon={File01Icon} size={12} color="currentColor" strokeWidth={1.5} />
            {files} {files === 1 ? 'file' : 'files'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F7F7F8] px-2.5 py-0.5 text-[11px] font-medium text-[#555]">
            <HugeiconsIcon icon={Invoice01Icon} size={12} color="currentColor" strokeWidth={1.5} />
            {invoices} {invoices === 1 ? 'invoice' : 'invoices'}
          </span>
        </div>
      </div>
      </div>
    </button>
  );
}
