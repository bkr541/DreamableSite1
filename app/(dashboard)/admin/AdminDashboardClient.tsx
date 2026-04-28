'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SessionPayload } from '@/lib/session';

interface Inquiry {
  id: string;
  name: string;
  email: string;
  service: string;
  status: string;
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  admin: boolean;
  createdAt: string;
}

interface Props {
  session: SessionPayload;
  stats: { totalUsers: number; totalProjects: number; activeProjects: number; openInquiries: number };
  recentInquiries: Inquiry[];
  recentUsers: User[];
}

const STATUS_COLORS: Record<string, string> = {
  INQUIRY: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  ACTIVE: 'bg-blue-100 text-blue-700',
  INVITED: 'bg-purple-100 text-purple-700',
  ONBOARDING: 'bg-sky-100 text-sky-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
};

function Badge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminDashboardClient({ session, stats, recentInquiries, recentUsers }: Props) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/portal');
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8]">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#EBEBEB]">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/images/logo_transparent.png" alt="Dreamable.studio logo" width={28} height={28} className="rounded-md" />
            <span className="text-sm font-semibold tracking-tight text-[#1a1a1a]">
              Dreamable<span className="text-[#999]">.</span>studio
            </span>
            <span className="ml-2 px-2 py-0.5 rounded-md bg-[#1a2030] text-white text-[10px] font-bold uppercase tracking-widest">
              Admin
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

      <div className="max-w-[1280px] mx-auto px-6 py-10">
        {/* Page heading */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a]">Overview</h1>
          <p className="text-sm text-[#888] mt-1">All activity across Dreamable.studio</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total Clients', value: stats.totalUsers },
            { label: 'Active Projects', value: stats.activeProjects },
            { label: 'Total Projects', value: stats.totalProjects },
            { label: 'Open Inquiries', value: stats.openInquiries },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-[#EBEBEB] p-6">
              <p className="text-xs font-semibold text-[#999] uppercase tracking-widest mb-3">{s.label}</p>
              <p className="text-4xl font-semibold tracking-tight text-[#1a1a1a]">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Two-column tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Inquiries */}
          <div className="bg-white rounded-2xl border border-[#EBEBEB] overflow-hidden">
            <div className="px-6 py-5 border-b border-[#F0F0F0] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1a1a1a]">Recent Inquiries</h2>
            </div>
            {recentInquiries.length === 0 ? (
              <p className="px-6 py-8 text-sm text-[#AAA]">No inquiries yet.</p>
            ) : (
              <ul className="divide-y divide-[#F5F5F5]">
                {recentInquiries.map((inq) => (
                  <li key={inq.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1a1a1a] truncate">{inq.name}</p>
                      <p className="text-xs text-[#888] truncate">{inq.email}</p>
                      <p className="text-xs text-[#AAA] mt-0.5">{inq.service} · {fmt(inq.createdAt)}</p>
                    </div>
                    <Badge status={inq.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent Users */}
          <div className="bg-white rounded-2xl border border-[#EBEBEB] overflow-hidden">
            <div className="px-6 py-5 border-b border-[#F0F0F0] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1a1a1a]">Recent Clients</h2>
            </div>
            {recentUsers.length === 0 ? (
              <p className="px-6 py-8 text-sm text-[#AAA]">No clients yet.</p>
            ) : (
              <ul className="divide-y divide-[#F5F5F5]">
                {recentUsers.map((u) => (
                  <li key={u.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#1a1a1a] truncate">{u.name}</p>
                        {u.admin && (
                          <span className="px-1.5 py-px rounded text-[10px] font-bold bg-[#1a2030] text-white uppercase tracking-widest">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#888] truncate">{u.email}</p>
                      <p className="text-xs text-[#AAA] mt-0.5">{u.role} · {fmt(u.createdAt)}</p>
                    </div>
                    <Badge status={u.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
