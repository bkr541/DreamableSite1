'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { generateInvoicePDF, getSampleInvoiceData } from '@/lib/generateInvoice';
import { useRouter } from 'next/navigation';
import { SessionPayload } from '@/lib/session';
import { motion, AnimatePresence } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PermanentJobIcon,
  UserGroup02Icon,
  Briefcase06Icon,
  WorkflowSquare03Icon,
  CreditCardPosIcon,
  ComplaintIcon,
  Invoice03Icon,
} from '@hugeicons/core-free-icons';

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

const NAV_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',     icon: PermanentJobIcon },
  { id: 'clients',       label: 'Clients',       icon: UserGroup02Icon },
  { id: 'projects',      label: 'Projects',      icon: Briefcase06Icon },
  { id: 'workspace',     label: 'Workspace',     icon: WorkflowSquare03Icon },
  { id: 'billing',       label: 'Billing',       icon: CreditCardPosIcon },
  { id: 'notifications', label: 'Notifications', icon: ComplaintIcon },
] as const;

type ViewId = typeof NAV_ITEMS[number]['id'];

const VIEW_META: Record<ViewId, { title: string; subtitle: string }> = {
  dashboard:     { title: 'Overview',       subtitle: 'All activity across Dreamable.studio' },
  clients:       { title: 'Clients',        subtitle: 'Manage your client accounts and relationships' },
  projects:      { title: 'Projects',       subtitle: 'Track and manage all active projects' },
  workspace:     { title: 'Workspace',      subtitle: 'Tools and shared resources for your team' },
  billing:       { title: 'Billing',        subtitle: 'Invoices, payments, and subscription details' },
  notifications: { title: 'Notifications', subtitle: 'Stay up to date with recent activity' },
};

export default function AdminDashboardClient({ session, stats, recentInquiries, recentUsers }: Props) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<ViewId>('dashboard');

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/portal');
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8]">
      {/* Top nav */}
      <header className="sticky top-0 z-40 w-full px-4 pt-4">
        <div className="max-w-[1280px] mx-auto bg-white/80 backdrop-blur-md rounded-full shadow-[0_2px_20px_rgba(0,0,0,0.08)] border border-[#E8E8E8]/60 px-6 h-16 grid grid-cols-3 items-center">

          {/* Left: Logo + Admin badge */}
          <Link href="/" className="flex items-center">
            <Image src="/images/logo_transparent.png" alt="Dreamable.studio logo" width={40} height={40} className="rounded-md" />
          </Link>

          {/* Center: Navigation icons */}
          <div className="flex items-center justify-center gap-1">
            {NAV_ITEMS.map(({ id, label, icon }) => {
              const isActive = activeView === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveView(id)}
                  title={label}
                  className={
                    isActive
                      ? 'flex items-center gap-1.5 pl-2 pr-3 py-2 rounded-full bg-[#F0F0F0] border border-[#E4E4E4] text-[#1a2030] text-xs font-medium transition-colors'
                      : 'p-2 rounded-full bg-[#F5F5F5] text-[#AAAAAA] hover:bg-[#EBEBEB] hover:text-[#555] transition-colors'
                  }
                >
                  <HugeiconsIcon
                    icon={icon}
                    size={16}
                    color={isActive ? '#1a2030' : '#AAAAAA'}
                    strokeWidth={1.5}
                  />
                  <AnimatePresence>
                    {isActive && (
                      <motion.span
                        initial={{ maxWidth: 0, opacity: 0 }}
                        animate={{ maxWidth: 200, opacity: 1 }}
                        exit={{ maxWidth: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="whitespace-nowrap overflow-hidden inline-block"
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </div>

          {/* Right: Email + Sign out */}
          <div className="flex items-center justify-end gap-4">
            <span className="text-sm text-[#707070] hidden sm:block">{session.email}</span>
            <button
              onClick={logout}
              className="inline-flex items-center justify-center h-8 sm:h-9 px-3 sm:px-5 rounded-full bg-[#1a2030] text-white text-[12px] sm:text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all whitespace-nowrap"
            >
              Sign out
            </button>
          </div>

        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
        {/* Page heading — shared across all views */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a]">{VIEW_META[activeView].title}</h1>
          <p className="text-sm text-[#888] mt-1">{VIEW_META[activeView].subtitle}</p>
        </div>

        {activeView === 'dashboard' && (
          <>

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
          </>
        )}

        {activeView === 'workspace' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => generateInvoicePDF(getSampleInvoiceData())}
              className="bg-white rounded-2xl border border-[#EBEBEB] p-6 text-left hover:border-[#1a2030]/25 hover:shadow-md transition-all group"
            >
              <p className="text-xs font-semibold text-[#999] uppercase tracking-widest mb-4">Generate Invoices</p>
              <HugeiconsIcon
                icon={Invoice03Icon}
                size={32}
                color="#1a2030"
                strokeWidth={1.5}
                className="group-hover:scale-110 transition-transform"
              />
            </button>
          </div>
        )}

        {activeView !== 'dashboard' && activeView !== 'workspace' && (
          <div className="bg-white rounded-2xl border border-[#EBEBEB] p-10 text-center">
            <p className="text-sm text-[#AAA]">Coming soon</p>
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
