'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, Briefcase06Icon, Mail01Icon, Notification03Icon, User02Icon } from '@hugeicons/core-free-icons';
import { Avatar, StatusDot } from '@/components/RecordList';
import { ModalSectionHeader } from '@/components/ModalParts';
import ClientNotices from '@/components/ClientNotices';
import ClientCompanyInfo from '@/components/ClientCompanyInfo';
import type { ClientNotice } from '@/lib/clientNotices';

// One client's own page (opened from the Clients list): who they are, their company, how many projects and invoices they
// have, everything worth knowing about them (notices), their projects, and the Create Project button.

export interface ClientDetailData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  company: { id: string; name: string; website: string | null } | null;
}

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null);

function Stat({ label, value, tone = 'plain' }: { label: string; value: ReactNode; tone?: 'plain' | 'red' | 'amber' }) {
  const color = tone === 'red' ? 'text-[#c23b3b]' : tone === 'amber' ? 'text-[#a36200]' : 'text-[#1a1a1a]';
  return (
    <div className="rounded-2xl border border-[#E2E4EA] bg-white px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#7a869f]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${color}`}>{value}</p>
    </div>
  );
}

const primaryBtn = 'inline-flex h-10 items-center gap-2 rounded-full bg-[#1a2030] px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-md';
const secondaryBtn = 'inline-flex h-10 items-center gap-2 rounded-full border border-[#D5D8DE] bg-white px-5 text-sm font-medium text-[#4b5260] transition-colors hover:bg-[#F5F6F8] hover:text-[#1a1a1a]';

export default function ClientDetail({
  client, notices, projectCount, invoiceCount, projectCards, onBack, onCreateProject, onResendInvite, onNoticeAction, onCompanySaved,
}: {
  client: ClientDetailData;
  notices: ClientNotice[];
  projectCount: number;
  invoiceCount: number;
  /** The client's projects, already rendered as cards by the parent (which owns status colours and navigation). */
  projectCards: ReactNode;
  onBack: () => void;
  onCreateProject: () => void;
  onResendInvite: () => void;
  onNoticeAction: (n: ClientNotice) => void;
  onCompanySaved: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  const attention = notices.filter((n) => n.severity === 'error' || n.severity === 'warning').length;
  const hasError = notices.some((n) => n.severity === 'error');

  const facts: [string, ReactNode][] = [
    ['Email', client.email],
    ['Role', <span key="r" className="capitalize">{client.role.toLowerCase()}</span>],
    ['Status', <StatusDot key="s" status={client.status} />],
    ['Client since', day(client.createdAt) ?? '—'],
    ['Last signed in', day(client.lastLoginAt) ?? 'Not yet'],
  ];

  return (
    <section aria-labelledby="client-title" className="w-full space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#D5D8DE] bg-white py-1.5 pl-2.5 pr-4 text-sm font-medium text-[#4b5260] transition-colors hover:bg-[#F5F6F8] hover:text-[#1a1a1a]"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={16} color="currentColor" strokeWidth={2} />
        Back to clients
      </button>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#E2E4EA] bg-white p-5">
        <Avatar name={client.name} size={56} />
        <div className="min-w-0 flex-1">
          <h2 id="client-title" ref={heading} tabIndex={-1} className="truncate text-2xl font-semibold tracking-tight text-[#1a1a1a] outline-none">{client.name}</h2>
          <p className="truncate text-sm text-[#666]">{client.email}{client.company ? ` · ${client.company.name}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {client.status === 'INVITED' && (
            <button type="button" onClick={onResendInvite} className={secondaryBtn}>
              <HugeiconsIcon icon={Mail01Icon} size={17} color="currentColor" strokeWidth={1.75} />
              Resend invitation
            </button>
          )}
          <button type="button" onClick={onCreateProject} className={primaryBtn}>
            <HugeiconsIcon icon={Briefcase06Icon} size={17} color="currentColor" strokeWidth={1.75} />
            Create Project
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Projects" value={projectCount} />
        <Stat label="Invoices" value={invoiceCount} />
        <Stat label="Needs attention" value={attention} tone={attention === 0 ? 'plain' : hasError ? 'red' : 'amber'} />
        <Stat label="Last signed in" value={<span className="text-lg">{day(client.lastLoginAt) ?? 'Not yet'}</span>} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E2E4EA] bg-white p-5">
          <ModalSectionHeader icon={User02Icon}>Client Information</ModalSectionHeader>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#999]">{label}</dt>
                <dd className="mt-0.5 truncate text-sm text-[#333]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ClientCompanyInfo
          key={`${client.company?.id}-${client.company?.website ?? ''}`}
          flush
          company={client.company}
          onSaved={onCompanySaved}
        />
      </div>

      <div className="space-y-3">
        <ModalSectionHeader icon={Notification03Icon}>Notices</ModalSectionHeader>
        <ClientNotices notices={notices} onAction={onNoticeAction} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-[#EDEEF2] pb-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4f6df5]">
              <HugeiconsIcon icon={Briefcase06Icon} size={17} color="currentColor" strokeWidth={1.75} />
            </span>
            <h3 className="text-[15px] font-semibold tracking-tight text-[#1a2030]">Projects <span className="font-normal text-[#999]">({projectCount})</span></h3>
          </div>
          <button type="button" onClick={onCreateProject} className={secondaryBtn}>Create Project</button>
        </div>
        {projectCount === 0
          ? <p className="rounded-2xl border border-[#E2E4EA] bg-white p-8 text-center text-sm text-[#888]">There are currently no projects for {client.name}.</p>
          : <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{projectCards}</ul>}
      </div>
    </section>
  );
}
