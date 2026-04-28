'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SessionPayload } from '@/lib/session';

interface Project {
  id: string;
  name: string;
  service: string;
  status: string;
  description: string;
  startDate: string | null;
  targetEndDate: string | null;
  createdAt: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  company: { name: string } | null;
  projects: Project[];
}

interface Props {
  session: SessionPayload;
  user: UserData;
}

const STATUS_META: Record<string, { label: string; color: string; step: number }> = {
  ONBOARDING:  { label: 'Onboarding',   color: 'bg-sky-100 text-sky-700',     step: 1 },
  IN_PROGRESS: { label: 'In Progress',  color: 'bg-blue-100 text-blue-700',   step: 2 },
  REVIEW:      { label: 'In Review',    color: 'bg-amber-100 text-amber-700', step: 3 },
  COMPLETED:   { label: 'Completed',    color: 'bg-green-100 text-green-700', step: 4 },
  CANCELLED:   { label: 'Cancelled',    color: 'bg-red-100 text-red-700',     step: 0 },
};

const STEPS = ['Onboarding', 'In Progress', 'In Review', 'Completed'];

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: 'bg-gray-100 text-gray-600', step: 0 };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function ProgressBar({ status }: { status: string }) {
  const step = STATUS_META[status]?.step ?? 0;
  if (step === 0) return null;
  return (
    <div className="mt-4">
      <div className="flex justify-between mb-2">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`text-[10px] font-semibold uppercase tracking-wide ${i + 1 <= step ? 'text-[#1a2030]' : 'text-[#CCC]'}`}
          >
            {s}
          </span>
        ))}
      </div>
      <div className="h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#1a2030] rounded-full transition-all"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>
    </div>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CustomerDashboardClient({ session, user }: Props) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/portal');
  }

  const firstName = user.name.split(' ')[0];

  return (
    <div className="min-h-screen bg-[#F7F7F8]">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#EBEBEB]">
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/images/logo_transparent.png" alt="Dreamable.studio logo" width={28} height={28} className="rounded-md" />
            <span className="text-sm font-semibold tracking-tight text-[#1a1a1a]">
              Dreamable<span className="text-[#999]">.</span>studio
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#707070] hidden sm:block">{session.email}</span>
            <button
              onClick={logout}
              className="text-sm font-medium text-[#555] hover:text-[#000] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto px-6 py-10">
        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a]">
            Welcome back, {firstName}.
          </h1>
          {user.company && (
            <p className="text-sm text-[#888] mt-1">{user.company.name}</p>
          )}
        </div>

        {/* Projects */}
        {user.projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#EBEBEB] p-10 text-center">
            <p className="text-sm font-medium text-[#1a1a1a] mb-2">No projects yet</p>
            <p className="text-sm text-[#888] mb-6">Your projects will appear here once work kicks off.</p>
            <Link
              href="/contact"
              className="inline-flex items-center px-6 py-2.5 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              Start a Project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {user.projects.map((project) => (
              <div key={project.id} className="bg-white rounded-2xl border border-[#EBEBEB] p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#999] uppercase tracking-widest mb-1">{project.service}</p>
                    <h2 className="text-lg font-semibold tracking-tight text-[#1a1a1a]">{project.name}</h2>
                  </div>
                  <StatusBadge status={project.status} />
                </div>

                <p className="text-sm text-[#707070] leading-relaxed line-clamp-2">{project.description}</p>

                <ProgressBar status={project.status} />

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#F5F5F5]">
                  <div>
                    <p className="text-[10px] font-semibold text-[#BBB] uppercase tracking-widest mb-0.5">Start Date</p>
                    <p className="text-sm text-[#555]">{fmtDate(project.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-[#BBB] uppercase tracking-widest mb-0.5">Target End</p>
                    <p className="text-sm text-[#555]">{fmtDate(project.targetEndDate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Help footer */}
        <div className="mt-10 p-6 bg-white rounded-2xl border border-[#EBEBEB] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#1a1a1a]">Need to reach us?</p>
            <p className="text-sm text-[#888]">We're here to help — just send a message.</p>
          </div>
          <Link
            href="/contact"
            className="inline-flex items-center px-6 py-2.5 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all whitespace-nowrap"
          >
            Contact Team
          </Link>
        </div>
      </div>
    </div>
  );
}
