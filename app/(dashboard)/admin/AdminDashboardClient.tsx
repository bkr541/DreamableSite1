'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import PasswordInput from '@/components/PasswordInput';
import { generateInvoicePDF } from '@/lib/generateInvoice';
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
  UserAdd02Icon,
  CancelCircleIcon,
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

interface ClientRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  admin: boolean;
  createdAt: string;
  company: { id: string; name: string; website: string | null; status: string } | null;
}

interface Props {
  session: SessionPayload;
  stats: { totalUsers: number; totalProjects: number; activeProjects: number; openInquiries: number };
  recentInquiries: Inquiry[];
  recentUsers: User[];
  clients: ClientRecord[];
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

function getDefaultInvoiceForm() {
  const now = new Date();
  const due = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const toInput = (d: Date) => d.toISOString().split('T')[0];
  return {
    invoiceNumber: `DS-${now.getFullYear()}-001`,
    issueDate: toInput(now),
    dueDate: toInput(due),
    clientName: '',
    clientEmail: '',
    clientCompany: '',
    projectName: '',
    taxRate: '0',
    lineItems: [{ description: '', qty: '1', rate: '' }],
  };
}

export default function AdminDashboardClient({ session, stats, recentInquiries, recentUsers, clients }: Props) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<ViewId>('dashboard');
  const [clientsGroupOpen, setClientsGroupOpen] = useState(true);
  const [showAddClient, setShowAddClient] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', email: '', role: 'CLIENT', status: 'INVITED',
    companyName: '', companyWebsite: '',
  });
  const [addError, setAddError] = useState('');
  const [addFieldError, setAddFieldError] = useState<{ field: string; message: string } | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(getDefaultInvoiceForm());
  const [invoiceFieldError, setInvoiceFieldError] = useState<{ field: string; message: string } | null>(null);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);

  function resetInvoiceForm() {
    setInvoiceForm(getDefaultInvoiceForm());
    setInvoiceFieldError(null);
    setInvoiceError('');
  }

  async function handleGenerateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setInvoiceFieldError(null);
    setInvoiceError('');

    if (!invoiceForm.invoiceNumber.trim()) { setInvoiceFieldError({ field: 'invoiceNumber', message: 'Invoice number is required.' }); return; }
    if (!invoiceForm.clientName.trim()) { setInvoiceFieldError({ field: 'clientName', message: 'Client name is required.' }); return; }
    if (!invoiceForm.clientEmail.trim()) { setInvoiceFieldError({ field: 'clientEmail', message: 'Email is required.' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceForm.clientEmail)) { setInvoiceFieldError({ field: 'clientEmail', message: 'Please enter a valid email address.' }); return; }
    if (!invoiceForm.projectName.trim()) { setInvoiceFieldError({ field: 'projectName', message: 'Project name is required.' }); return; }
    if (!invoiceForm.issueDate) { setInvoiceFieldError({ field: 'issueDate', message: 'Issue date is required.' }); return; }
    if (!invoiceForm.dueDate) { setInvoiceFieldError({ field: 'dueDate', message: 'Due date is required.' }); return; }

    for (let i = 0; i < invoiceForm.lineItems.length; i++) {
      const item = invoiceForm.lineItems[i];
      if (!item.description.trim()) { setInvoiceError(`Line item ${i + 1}: description is required.`); return; }
      const qty = parseFloat(item.qty);
      if (isNaN(qty) || qty <= 0) { setInvoiceError(`Line item ${i + 1}: quantity must be a positive number.`); return; }
      const rate = parseFloat(item.rate);
      if (isNaN(rate) || rate < 0) { setInvoiceError(`Line item ${i + 1}: rate must be a valid amount.`); return; }
    }

    const formatDate = (iso: string) => {
      const [year, month, day] = iso.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    const payload = {
      invoiceNumber: invoiceForm.invoiceNumber.trim(),
      issueDate: invoiceForm.issueDate,
      dueDate: invoiceForm.dueDate,
      clientName: invoiceForm.clientName.trim(),
      clientEmail: invoiceForm.clientEmail.trim(),
      clientCompany: invoiceForm.clientCompany.trim(),
      projectName: invoiceForm.projectName.trim(),
      taxRate: parseFloat(invoiceForm.taxRate) / 100 || 0,
      lineItems: invoiceForm.lineItems.map(item => ({
        description: item.description.trim(),
        qty: parseFloat(item.qty),
        rate: parseFloat(item.rate),
      })),
    };

    setInvoiceSubmitting(true);
    try {
      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setInvoiceError(data.error || 'Failed to save invoice.'); return; }

      generateInvoicePDF({
        ...payload,
        issueDate: formatDate(payload.issueDate),
        dueDate: formatDate(payload.dueDate),
      });

      setShowInvoice(false);
      resetInvoiceForm();
    } catch {
      setInvoiceError('Unable to connect. Please try again.');
    } finally {
      setInvoiceSubmitting(false);
    }
  }

  function resetAddForm() {
    setAddForm({ name: '', email: '', role: 'CLIENT', status: 'INVITED', companyName: '', companyWebsite: '' });
    setAddError('');
    setAddFieldError(null);
  }

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    setAddFieldError(null);
    setAddError('');

    if (!addForm.name.trim()) { setAddFieldError({ field: 'name', message: 'Full name is required.' }); return; }
    if (!addForm.email.trim()) { setAddFieldError({ field: 'email', message: 'Email is required.' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email)) { setAddFieldError({ field: 'email', message: 'Please enter a valid email address.' }); return; }
    setAddSubmitting(true);
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || 'Something went wrong.'); return; }
      setShowAddClient(false);
      resetAddForm();
      router.refresh();
    } catch {
      setAddError('Unable to connect. Please try again.');
    } finally {
      setAddSubmitting(false);
    }
  }

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
                      ? 'relative flex items-center justify-center gap-1.5 px-4 py-2 w-[120px] rounded-full text-[#1a2030] text-xs font-medium transition-[width]'
                      : 'relative p-2 rounded-full text-[#AAAAAA] hover:bg-[#EBEBEB] hover:text-[#555] transition-colors'
                  }
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-[#3DD9C8] via-[#7BB5F5] to-[#B87AF5] shadow-sm"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-1.5">
                    <HugeiconsIcon
                      icon={icon}
                      size={16}
                      color={isActive ? '#1a2030' : '#AAAAAA'}
                      strokeWidth={1.5}
                    />
                    {isActive && (
                      <motion.span
                        initial={{ maxWidth: 0, opacity: 0 }}
                        animate={{ maxWidth: 200, opacity: 1 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="whitespace-nowrap overflow-hidden inline-block"
                      >
                        {label}
                      </motion.span>
                    )}
                  </span>
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

          </>
        )}

        {activeView === 'workspace' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => { resetInvoiceForm(); setShowInvoice(true); }}
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

        {activeView === 'clients' && (
          <div className="bg-white rounded-2xl border border-[#EBEBEB] overflow-hidden">
            {/* Group header */}
            <div className="px-6 py-4 flex items-center justify-between">
              <button
                onClick={() => setClientsGroupOpen(v => !v)}
                className="flex items-center gap-3 hover:opacity-70 transition-opacity"
              >
                <h2 className="text-sm font-semibold text-[#1a1a1a]">Clients</h2>
                <span className="px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[11px] font-semibold text-[#888]">
                  {clients.length}
                </span>
                <motion.div animate={{ rotate: clientsGroupOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={15} strokeWidth={1.75} className="text-[#AAAAAA]" />
                </motion.div>
              </button>
              <button
                onClick={() => { resetAddForm(); setShowAddClient(true); }}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[#1a2030] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                <HugeiconsIcon icon={UserAdd02Icon} size={16} color="#ffffff" strokeWidth={1.5} />
                Add Client
              </button>
            </div>

            {/* Collapsible content */}
            <div
              style={{
                display: 'grid',
                gridTemplateRows: clientsGroupOpen ? '1fr' : '0fr',
                transition: 'grid-template-rows 0.2s ease-in-out',
              }}
            >
              <div className="overflow-hidden">
                <div className="p-4">
                  <div className="border border-[#EBEBEB] rounded-xl overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_1fr_120px_100px] gap-4 px-6 py-3 bg-[#FAFAFA] border-b border-[#F0F0F0]">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#AAA]">Name</p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#AAA]">Company</p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#AAA]">Role</p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#AAA]">Status</p>
                  </div>

                  {clients.length === 0 ? (
                    <p className="px-6 py-8 text-sm text-[#AAA]">No clients yet.</p>
                  ) : (
                    <ul className="divide-y divide-[#F5F5F5]">
                      {clients.map((c) => (
                        <li key={c.id} className="grid grid-cols-[1fr_1fr_120px_100px] gap-4 px-6 py-4 items-center hover:bg-[#FAFAFA] transition-colors">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-[#1a1a1a] truncate">{c.name}</p>
                              {c.admin && (
                                <span className="px-1.5 py-px rounded text-[10px] font-bold bg-[#1a2030] text-white uppercase tracking-widest shrink-0">
                                  Admin
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#888] truncate">{c.email}</p>
                          </div>
                          <div className="min-w-0">
                            {c.company ? (
                              <>
                                <p className="text-sm text-[#1a1a1a] truncate">{c.company.name}</p>
                                {c.company.website && (
                                  <p className="text-xs text-[#AAA] truncate">{c.company.website}</p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-[#CCC]">—</p>
                            )}
                          </div>
                          <p className="text-xs text-[#555] truncate">{c.role}</p>
                          <p className="text-xs text-[#555] truncate">{c.status}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView !== 'dashboard' && activeView !== 'workspace' && activeView !== 'clients' && (
          <div className="bg-white rounded-2xl border border-[#EBEBEB] p-10 text-center">
            <p className="text-sm text-[#AAA]">Coming soon</p>
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Generate Invoice modal */}
      <AnimatePresence>
        {showInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => { setShowInvoice(false); resetInvoiceForm(); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="relative w-full max-w-[720px] rounded-3xl bg-white shadow-xl border border-[#F0F0F0] max-h-[90vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => { setShowInvoice(false); resetInvoiceForm(); }}
                className="absolute top-5 right-5 text-[#CCCCCC] hover:text-[#555] transition-colors z-10"
              >
                <HugeiconsIcon icon={CancelCircleIcon} size={22} color="currentColor" strokeWidth={1.5} />
              </button>
              <form onSubmit={handleGenerateInvoice} className="p-8 space-y-5" noValidate>
                <div className="flex items-center gap-3">
                  <HugeiconsIcon icon={Invoice03Icon} size={28} color="#1a2030" strokeWidth={2} />
                  <p className="text-xl font-semibold text-[#1a1a1a]">Generate Invoice</p>
                </div>

                {/* Invoice Details */}
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#AAA]">Invoice Details</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#555]">Invoice # <span className="text-red-400">*</span></label>
                      <input
                        value={invoiceForm.invoiceNumber}
                        onChange={e => { setInvoiceForm(f => ({ ...f, invoiceNumber: e.target.value })); setInvoiceFieldError(null); }}
                        placeholder="DS-2026-001"
                        className={`w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all ${invoiceFieldError?.field === 'invoiceNumber' ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`}
                      />
                      {invoiceFieldError?.field === 'invoiceNumber' && <p className="text-xs text-[#e05252]">{invoiceFieldError.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#555]">Issue Date <span className="text-red-400">*</span></label>
                      <input
                        type="date"
                        value={invoiceForm.issueDate}
                        onChange={e => { setInvoiceForm(f => ({ ...f, issueDate: e.target.value })); setInvoiceFieldError(null); }}
                        className={`w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] border focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all ${invoiceFieldError?.field === 'issueDate' ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`}
                      />
                      {invoiceFieldError?.field === 'issueDate' && <p className="text-xs text-[#e05252]">{invoiceFieldError.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#555]">Due Date <span className="text-red-400">*</span></label>
                      <input
                        type="date"
                        value={invoiceForm.dueDate}
                        onChange={e => { setInvoiceForm(f => ({ ...f, dueDate: e.target.value })); setInvoiceFieldError(null); }}
                        className={`w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] border focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all ${invoiceFieldError?.field === 'dueDate' ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`}
                      />
                      {invoiceFieldError?.field === 'dueDate' && <p className="text-xs text-[#e05252]">{invoiceFieldError.message}</p>}
                    </div>
                  </div>
                </div>

                {/* Client Information */}
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#AAA]">Client Information</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#555]">Client Name <span className="text-red-400">*</span></label>
                      <input
                        value={invoiceForm.clientName}
                        onChange={e => { setInvoiceForm(f => ({ ...f, clientName: e.target.value })); setInvoiceFieldError(null); }}
                        placeholder="Jane Smith"
                        className={`w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all ${invoiceFieldError?.field === 'clientName' ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`}
                      />
                      {invoiceFieldError?.field === 'clientName' && <p className="text-xs text-[#e05252]">{invoiceFieldError.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#555]">Client Email <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={invoiceForm.clientEmail}
                        onChange={e => { setInvoiceForm(f => ({ ...f, clientEmail: e.target.value })); setInvoiceFieldError(null); }}
                        placeholder="jane@example.com"
                        className={`w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all ${invoiceFieldError?.field === 'clientEmail' ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`}
                      />
                      {invoiceFieldError?.field === 'clientEmail' && <p className="text-xs text-[#e05252]">{invoiceFieldError.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#555]">Company</label>
                      <input
                        value={invoiceForm.clientCompany}
                        onChange={e => setInvoiceForm(f => ({ ...f, clientCompany: e.target.value }))}
                        placeholder="Acme Inc."
                        className="w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Project */}
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#AAA]">Project</p>
                  <div className="grid grid-cols-[1fr_120px] gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#555]">Project Name <span className="text-red-400">*</span></label>
                      <input
                        value={invoiceForm.projectName}
                        onChange={e => { setInvoiceForm(f => ({ ...f, projectName: e.target.value })); setInvoiceFieldError(null); }}
                        placeholder="Brand Identity & Website"
                        className={`w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all ${invoiceFieldError?.field === 'projectName' ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`}
                      />
                      {invoiceFieldError?.field === 'projectName' && <p className="text-xs text-[#e05252]">{invoiceFieldError.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#555]">Tax Rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={invoiceForm.taxRate}
                        onChange={e => setInvoiceForm(f => ({ ...f, taxRate: e.target.value }))}
                        placeholder="0"
                        className="w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#AAA]">Line Items</p>
                  <div className="grid grid-cols-[1fr_72px_96px_36px] gap-3 px-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#CCC]">Description</p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#CCC] text-center">Qty</p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#CCC] text-right">Rate ($)</p>
                    <div />
                  </div>
                  <div className="space-y-2">
                    {invoiceForm.lineItems.map((item, i) => (
                      <div key={i} className="grid grid-cols-[1fr_72px_96px_36px] gap-3 items-center">
                        <input
                          value={item.description}
                          onChange={e => {
                            const val = e.target.value;
                            setInvoiceForm(f => { const items = [...f.lineItems]; items[i] = { ...items[i], description: val }; return { ...f, lineItems: items }; });
                            setInvoiceError('');
                          }}
                          placeholder="Service description"
                          className="w-full bg-white rounded-xl px-3 py-2 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all"
                        />
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.qty}
                          onChange={e => {
                            const val = e.target.value;
                            setInvoiceForm(f => { const items = [...f.lineItems]; items[i] = { ...items[i], qty: val }; return { ...f, lineItems: items }; });
                            setInvoiceError('');
                          }}
                          className="w-full bg-white rounded-xl px-3 py-2 text-sm text-[#1a1a1a] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all text-center"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={e => {
                            const val = e.target.value;
                            setInvoiceForm(f => { const items = [...f.lineItems]; items[i] = { ...items[i], rate: val }; return { ...f, lineItems: items }; });
                            setInvoiceError('');
                          }}
                          placeholder="0.00"
                          className="w-full bg-white rounded-xl px-3 py-2 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all text-right"
                        />
                        <button
                          type="button"
                          onClick={() => setInvoiceForm(f => ({ ...f, lineItems: f.lineItems.filter((_, idx) => idx !== i) }))}
                          disabled={invoiceForm.lineItems.length === 1}
                          className="flex items-center justify-center text-[#CCCCCC] hover:text-[#e05252] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <HugeiconsIcon icon={CancelCircleIcon} size={18} color="currentColor" strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setInvoiceForm(f => ({ ...f, lineItems: [...f.lineItems, { description: '', qty: '1', rate: '' }] }))}
                    className="text-sm text-[#AAAAAA] hover:text-[#1a2030] transition-colors"
                  >
                    + Add Line Item
                  </button>
                </div>

                {invoiceError && <p className="text-sm text-[#e05252]">{invoiceError}</p>}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowInvoice(false); resetInvoiceForm(); }}
                    className="text-sm text-[#AAAAAA] hover:text-[#000] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={invoiceSubmitting}
                    className="px-8 py-3 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    {invoiceSubmitting ? 'Saving…' : 'Generate Invoice'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Client modal */}
      <AnimatePresence>
        {showAddClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => { setShowAddClient(false); resetAddForm(); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="relative w-full max-w-[720px] rounded-3xl bg-white shadow-xl border border-[#F0F0F0]"
            >
              <button
                type="button"
                onClick={() => { setShowAddClient(false); resetAddForm(); }}
                className="absolute top-5 right-5 text-[#CCCCCC] hover:text-[#555] transition-colors"
              >
                <HugeiconsIcon icon={CancelCircleIcon} size={22} color="currentColor" strokeWidth={1.5} />
              </button>
              <form onSubmit={handleAddClient} className="p-8 space-y-5" noValidate>
                <div className="flex items-center gap-3">
                  <HugeiconsIcon icon={UserAdd02Icon} size={28} color="#1a2030" strokeWidth={2} />
                  <p className="text-xl font-semibold text-[#1a1a1a]">Add Client</p>
                </div>

                {/* User information */}
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#AAA]">User Information</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#555]">Full Name <span className="text-red-400">*</span></label>
                      <input
                        value={addForm.name}
                        onChange={e => { setAddForm(f => ({ ...f, name: e.target.value })); setAddFieldError(null); }}
                        placeholder="Jane Smith"
                        className={`w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all ${addFieldError?.field === 'name' ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`}
                      />
                      {addFieldError?.field === 'name' && <p className="text-xs text-[#e05252]">{addFieldError.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#555]">Email <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        autoComplete="email"
                        value={addForm.email}
                        onChange={e => { setAddForm(f => ({ ...f, email: e.target.value })); setAddFieldError(null); }}
                        placeholder="jane@example.com"
                        className={`w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all ${addFieldError?.field === 'email' ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`}
                      />
                      {addFieldError?.field === 'email' && <p className="text-xs text-[#e05252]">{addFieldError.message}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-[#555]">Role</label>
                        <select
                          value={addForm.role}
                          onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                          className="w-full bg-white rounded-xl px-3 py-2.5 text-sm text-[#1a1a1a] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all"
                        >
                          <option value="CLIENT">Client</option>
                          <option value="DESIGNER">Designer</option>
                          <option value="DEVELOPER">Developer</option>
                          <option value="MANAGER">Manager</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-[#555]">Status</label>
                        <select
                          value={addForm.status}
                          onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}
                          className="w-full bg-white rounded-xl px-3 py-2.5 text-sm text-[#1a1a1a] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all"
                        >
                          <option value="INVITED">Invited</option>
                          <option value="ACTIVE">Active</option>
                          <option value="ONBOARDING">Onboarding</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </div>
                  </div>
                </div>

                {/* Company information */}
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#AAA]">Company Information <span className="normal-case text-[#CCC] font-normal">— optional</span></p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#555]">Company Name</label>
                      <input
                        value={addForm.companyName}
                        onChange={e => setAddForm(f => ({ ...f, companyName: e.target.value }))}
                        placeholder="Acme Inc."
                        className="w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#555]">Website</label>
                      <input
                        type="text"
                        value={addForm.companyWebsite}
                        onChange={e => setAddForm(f => ({ ...f, companyWebsite: e.target.value }))}
                        placeholder="https://acme.com"
                        className="w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {addError && <p className="text-sm text-[#e05252]">{addError}</p>}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowAddClient(false); resetAddForm(); }}
                    className="text-sm text-[#AAAAAA] hover:text-[#000] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addSubmitting}
                    className="px-8 py-3 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    {addSubmitting ? 'Creating…' : 'Confirm Client'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
