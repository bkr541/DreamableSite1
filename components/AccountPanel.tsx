'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PasswordInput from '@/components/PasswordInput';
import { PASSWORD_HINT, passwordProblem } from '@/lib/passwordPolicy';

const input = 'w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all';
const primary = 'inline-flex items-center h-10 px-6 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-50 disabled:hover:translate-y-0';

/** The customer's own account: change their name and password. Email and company are shown but changed by the studio. */
export default function AccountPanel({ name, email, company }: { name: string; email: string; company: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [newName, setNewName] = useState(name);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingName, setSavingName] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (savingName) return;
    if (!newName.trim()) { setNameMsg({ ok: false, text: 'Name is required.' }); return; }
    setSavingName(true);
    setNameMsg(null);
    try {
      const res = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setNameMsg({ ok: false, text: data.error || 'Could not save your name.' }); return; }
      setNameMsg({ ok: true, text: 'Saved.' });
      router.refresh();
    } catch {
      setNameMsg({ ok: false, text: 'Unable to connect. Please try again.' });
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (savingPw) return;
    if (!current) { setPwMsg({ ok: false, text: 'Enter your current password.' }); return; }
    const weak = passwordProblem(next, { email });
    if (weak) { setPwMsg({ ok: false, text: weak }); return; }
    if (next !== confirm) { setPwMsg({ ok: false, text: 'The new passwords don’t match.' }); return; }
    setSavingPw(true);
    setPwMsg(null);
    try {
      const res = await fetch('/api/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setPwMsg({ ok: false, text: data.error || 'Could not change your password.' }); return; }
      setCurrent(''); setNext(''); setConfirm('');
      setPwMsg({ ok: true, text: 'Password changed. You stay signed in here; any other devices were signed out.' });
    } catch {
      setPwMsg({ ok: false, text: 'Unable to connect. Please try again.' });
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <section className="mt-10 bg-white rounded-2xl border border-[#EBEBEB]" aria-label="Your account">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 p-6 text-left">
        <div>
          <p className="text-sm font-semibold text-[#1a1a1a]">Your account</p>
          <p className="text-sm text-[#888]">Update your name or change your password.</p>
        </div>
        <span className="text-xs font-semibold text-[#4f6df5]">{open ? 'Hide' : 'Manage'}</span>
      </button>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-[#F0F0F0] p-6">
          <form onSubmit={saveName} noValidate className="space-y-4">
            <p className="text-xs font-semibold text-[#999] uppercase tracking-widest">Your details</p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="acct-name" className="text-sm font-medium text-[#555]">Name</label>
              <input id="acct-name" value={newName} maxLength={120} onChange={(e) => { setNewName(e.target.value); setNameMsg(null); }} className={input} autoComplete="name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#555]">Email</span>
              <p className="rounded-xl bg-[#F6F7FB] px-4 py-2.5 text-sm text-[#555] break-all">{email}</p>
              <p className="text-xs text-[#999]">To change your email address or company, contact Dreamable.studio.</p>
            </div>
            {company && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[#555]">Company</span>
                <p className="rounded-xl bg-[#F6F7FB] px-4 py-2.5 text-sm text-[#555]">{company}</p>
              </div>
            )}
            <div className="flex items-center gap-4">
              <button type="submit" disabled={savingName || newName.trim() === name} className={primary}>{savingName ? 'Saving…' : 'Save name'}</button>
              {nameMsg && <p role="status" className={`text-sm ${nameMsg.ok ? 'text-green-600' : 'text-[#e05252]'}`}>{nameMsg.text}</p>}
            </div>
          </form>

          <form onSubmit={savePassword} noValidate className="space-y-4">
            <p className="text-xs font-semibold text-[#999] uppercase tracking-widest">Change password</p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="acct-current" className="text-sm font-medium text-[#555]">Current password</label>
              <PasswordInput id="acct-current" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); setPwMsg(null); }} className="bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="acct-new" className="text-sm font-medium text-[#555]">New password</label>
              <PasswordInput id="acct-new" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); setPwMsg(null); }} className="bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50" />
              <p className="text-xs text-[#999]">{PASSWORD_HINT}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="acct-confirm" className="text-sm font-medium text-[#555]">Confirm new password</label>
              <PasswordInput id="acct-confirm" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setPwMsg(null); }} className="bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50" />
            </div>
            <div className="flex items-center gap-4">
              <button type="submit" disabled={savingPw} className={primary}>{savingPw ? 'Saving…' : 'Change password'}</button>
            </div>
            {pwMsg && <p role="status" className={`text-sm ${pwMsg.ok ? 'text-green-600' : 'text-[#e05252]'}`}>{pwMsg.text}</p>}
          </form>
        </div>
      )}
    </section>
  );
}
