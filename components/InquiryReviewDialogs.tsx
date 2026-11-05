'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Tick02Icon, UserCheck01Icon } from '@hugeicons/core-free-icons';
import { useToast } from '@/components/Toast';
import DialogFocus from '@/components/DialogFocus';

export interface ReviewTarget {
  id: string;
  name: string;
  email: string;
  company: string | null;
  service: string;
  projectName: string | null;
}

function Shell({ title, icon, tone, onClose, busy, children }: { title: string; icon: typeof Tick02Icon; tone: 'indigo' | 'red'; onClose: () => void; busy: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <motion.div
        role="alertdialog" aria-modal="true" aria-label={title}
        initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="relative w-full max-w-[460px] rounded-2xl bg-white shadow-2xl border border-[#F0F0F0] p-6"
      >
        <DialogFocus />
        <div className="flex items-center gap-3 mb-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${tone === 'red' ? 'bg-red-50 text-[#e05252]' : 'bg-[#EEF2FF] text-[#4f6df5]'}`}>
            <HugeiconsIcon icon={icon} size={20} color="currentColor" strokeWidth={1.5} />
          </span>
          <h3 className="text-base font-semibold text-[#1a1a1a]">{title}</h3>
        </div>
        {children}
      </motion.div>
    </div>,
    document.body,
  );
}

const cancelCls = 'inline-flex items-center h-10 px-5 rounded-full border border-[#D0D0D0] text-[#555] text-sm font-medium hover:bg-[#F5F5F5] transition-colors disabled:opacity-50';

/** Confirms an approval, shows exactly what it will create, and calls the secured approve endpoint once. */
export function ApproveInquiryDialog({ inquiry, onClose }: { inquiry: ReviewTarget; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function approve() {
    if (busy) return;               // a second click while the first is in flight does nothing
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/inquiries/${inquiry.id}/approve`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        // Server messages here are already written for staff (missing fields, an existing account, wrong state).
        setError(typeof data.error === 'string' ? data.error : 'We could not approve this inquiry. Please try again.');
        return;
      }
      if (data.alreadyApproved) toast.success('Already approved', `${inquiry.name}’s inquiry had already been approved — nothing was created twice.`);
      else toast.success('Inquiry approved', `${inquiry.name} now has a client account and project, and an invitation is on its way.`);
      onClose();
      router.refresh();
    } catch {
      setError('Unable to connect. Nothing was changed — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Approve this inquiry?" icon={UserCheck01Icon} tone="indigo" onClose={onClose} busy={busy}>
      <p className="text-sm text-[#555] leading-relaxed">This will create:</p>
      <ul className="mt-2 space-y-1.5 text-sm text-[#333]">
        <li className="flex gap-2"><HugeiconsIcon icon={Tick02Icon} size={16} color="#4f6df5" strokeWidth={2} className="mt-0.5 shrink-0" /><span>A client account for <span className="font-medium">{inquiry.name}</span> ({inquiry.email})</span></li>
        <li className="flex gap-2"><HugeiconsIcon icon={Tick02Icon} size={16} color="#4f6df5" strokeWidth={2} className="mt-0.5 shrink-0" /><span>A company: <span className="font-medium">{inquiry.company || inquiry.name}</span></span></li>
        <li className="flex gap-2"><HugeiconsIcon icon={Tick02Icon} size={16} color="#4f6df5" strokeWidth={2} className="mt-0.5 shrink-0" /><span>A project: <span className="font-medium">{inquiry.service} Project</span></span></li>
      </ul>
      <p className="text-xs text-[#888] mt-3 leading-relaxed">
        An invitation email is then sent so they can choose their own password. No password is created or emailed, and if the email can&apos;t be delivered the approval still stands — you can resend it from Clients.
      </p>
      {error && <p className="text-sm text-[#e05252] mt-3" role="alert">{error}</p>}
      <div className="flex items-center justify-end gap-3 mt-6">
        <button type="button" onClick={onClose} disabled={busy} className={cancelCls}>Cancel</button>
        <button type="button" onClick={approve} disabled={busy} className="inline-flex items-center h-10 px-5 rounded-full bg-[#1a2030] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-50 disabled:hover:translate-y-0">
          {busy ? 'Approving…' : 'Approve & invite'}
        </button>
      </div>
    </Shell>
  );
}

/** Closes an inquiry without creating anything. The note is internal and never emailed. */
export function RejectInquiryDialog({ inquiry, onClose }: { inquiry: ReviewTarget; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  async function reject() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setError(typeof data.error === 'string' ? data.error : 'We could not reject this inquiry. Please try again.'); return; }
      toast.success(data.alreadyRejected ? 'Already rejected' : 'Inquiry rejected', `${inquiry.name}’s inquiry was closed. You can reopen it later.`);
      onClose();
      router.refresh();
    } catch {
      setError('Unable to connect. Nothing was changed — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Reject this inquiry?" icon={Cancel01Icon} tone="red" onClose={onClose} busy={busy}>
      <p className="text-sm text-[#555] leading-relaxed">
        The inquiry from <span className="font-medium text-[#1a1a1a]">{inquiry.name}</span> will be closed. No client or project is created, nothing is deleted, and <span className="font-medium">no email is sent</span>. You can reopen it later.
      </p>
      <label htmlFor="reject-reason" className="block text-sm font-medium text-[#555] mt-4 mb-1.5">Internal note <span className="text-[#BBB] font-normal">— optional, only staff see this</span></label>
      <textarea
        id="reject-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy}
        placeholder="Why is this being declined?"
        className="w-full resize-none rounded-xl border border-[#D0D0D0] bg-white px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-purple-200/50"
      />
      {error && <p className="text-sm text-[#e05252] mt-3" role="alert">{error}</p>}
      <div className="flex items-center justify-end gap-3 mt-5">
        <button type="button" onClick={onClose} disabled={busy} className={cancelCls}>Cancel</button>
        <button type="button" onClick={reject} disabled={busy} className="inline-flex items-center h-10 px-5 rounded-full bg-[#e05252] text-white text-sm font-semibold hover:bg-[#c93f3f] transition-colors disabled:opacity-50">
          {busy ? 'Rejecting…' : 'Reject inquiry'}
        </button>
      </div>
    </Shell>
  );
}
