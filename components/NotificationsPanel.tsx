'use client';

import { useCallback, useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert02Icon, CheckmarkCircle02Icon, FolderUploadIcon, Mail01Icon, Message01Icon, Notification03Icon, UserCheck01Icon,
} from '@hugeicons/core-free-icons';
import { useToast } from '@/components/Toast';

interface Item { id: string; type: string; title: string; body: string | null; url: string; createdAt: string; read: boolean }
interface MailRow { id: string; label: string; to: string; status: string; attempts: number; maxAttempts: number; nextAttemptAt: string; lastError: string | null; createdAt: string }
interface MailProblems { failed: MailRow[]; retrying: MailRow[]; stuckPending: number; mode: string; smtpConfigured: boolean }

const ICONS: Record<string, typeof Mail01Icon> = {
  'inquiry.new': Mail01Icon,
  'inquiry.approved': CheckmarkCircle02Icon,
  'client.activated': UserCheck01Icon,
  'deliverable.uploaded': FolderUploadIcon,
  'comment.new': Message01Icon,
  'email.failed': Alert02Icon,
};

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const inTime = (iso: string) => {
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  return s <= 60 ? 'any moment' : s < 3600 ? `in ${Math.round(s / 60)} min` : `in ${Math.round(s / 3600)} h`;
};

/** Admin activity feed + the state of outgoing email. Everything here is fetched from admin-only endpoints. */
export default function NotificationsPanel({ onOpen, onUnreadChange }: { onOpen: (url: string) => void; onUnreadChange: (n: number) => void }) {
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [mail, setMail] = useState<MailProblems | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/notifications?filter=${filter}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (!d.ok) throw new Error();
        setItems(d.items); setCursor(d.nextCursor); setState('ready'); onUnreadChange(d.unread);
      })
      .catch(() => alive && setState('error'));
    fetch('/api/admin/email-outbox').then((r) => r.json()).then((d) => alive && d.ok && setMail(d)).catch(() => {});
    return () => { alive = false; };
  }, [filter, version, onUnreadChange]);

  const reload = useCallback(() => { setState('loading'); setVersion((v) => v + 1); }, []);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const d = await (await fetch(`/api/admin/notifications?filter=${filter}&cursor=${encodeURIComponent(cursor)}`)).json();
      if (d.ok) { setItems((prev) => [...prev, ...d.items]); setCursor(d.nextCursor); }
    } finally { setLoadingMore(false); }
  }

  async function markRead(body: { ids: string[] } | { all: true }) {
    const d = await (await fetch('/api/admin/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    if (d.ok) onUnreadChange(d.unread);
    return d.ok as boolean;
  }

  async function open(n: Item) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      markRead({ ids: [n.id] }).catch(() => {});
    }
    onOpen(n.url);
  }

  async function markAll() {
    if (await markRead({ all: true })) setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    else toast.error('Could not mark as read', 'Please try again.');
  }

  async function retry(id?: string) {
    try {
      const res = await fetch(id ? `/api/admin/email-outbox/${id}/retry` : '/api/admin/email-outbox/retry-all', { method: 'POST' });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || 'Could not retry.');
      toast.success('Retrying', id ? 'The email is being sent again.' : `${d.retried} failed ${d.retried === 1 ? 'email is' : 'emails are'} being sent again.`);
      setTimeout(reload, 2500);
    } catch (err) {
      toast.error('Could not retry', err instanceof Error ? err.message : undefined);
    }
  }

  const problems = mail ? mail.failed.length + mail.retrying.length + mail.stuckPending : 0;
  const unreadCount = items.filter((i) => !i.read).length;

  return (
    <div className="space-y-6">
      {mail && (problems > 0 || mail.mode !== 'smtp' || !mail.smtpConfigured) && (
        <section className="rounded-2xl border border-[#EBEBEB] bg-white" aria-label="Email delivery">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#F0F0F0]">
            <div>
              <h2 className="text-sm font-semibold text-[#1a1a1a]">Email delivery</h2>
              <p className="text-xs text-[#888] mt-0.5">
                {problems > 0
                  ? `${mail.failed.length} failed, ${mail.retrying.length} waiting to retry${mail.stuckPending ? `, ${mail.stuckPending} not yet sent` : ''}. Inquiries are always saved — only the email is affected.`
                  : 'Everything queued has been sent.'}
              </p>
            </div>
            {mail.failed.length > 0 && (
              <button type="button" onClick={() => retry()} className="inline-flex items-center h-9 px-4 rounded-full bg-[#1a2030] text-white text-xs font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all">Retry all failed</button>
            )}
          </div>
          {mail.mode === 'smtp' && !mail.smtpConfigured && (
            <p className="px-6 py-3 text-xs text-[#b45309] bg-amber-50 border-b border-amber-100">SMTP isn&apos;t configured on this server, so emails cannot be delivered. Set SMTP_HOST, SMTP_USER and SMTP_PASS, then retry.</p>
          )}
          {mail.mode !== 'smtp' && (
            <p className="px-6 py-3 text-xs text-[#555] bg-[#F6F7FB] border-b border-[#F0F0F0]">This environment does not deliver real email{mail.mode === 'allowlist' ? ' (only to addresses on the development allowlist)' : mail.mode === 'fake' ? ' (test mode)' : ''}.</p>
          )}
          {[...mail.failed, ...mail.retrying].length > 0 && (
            <ul className="divide-y divide-[#F0F0F0]">
              {[...mail.failed, ...mail.retrying].map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.status === 'DEAD' ? 'bg-red-500' : 'bg-amber-400'}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[#222] truncate">{m.label} <span className="text-[#999] font-normal">→ {m.to}</span></p>
                    <p className="text-xs text-[#888] truncate">
                      {m.status === 'DEAD' ? `Gave up after ${m.attempts} attempts` : `Attempt ${m.attempts} of ${m.maxAttempts}, next try ${inTime(m.nextAttemptAt)}`}
                      {m.lastError ? ` · ${m.lastError}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => retry(m.id)} className="shrink-0 text-xs font-semibold text-[#4f6df5] hover:underline">Retry now</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-[#EBEBEB] bg-white" aria-label="Activity">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#F0F0F0]">
          <div className="inline-flex rounded-full bg-[#F1F2F5] p-0.5" role="tablist" aria-label="Filter notifications">
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f} type="button" role="tab" aria-selected={filter === f}
                onClick={() => { if (f !== filter) { setState('loading'); setFilter(f); } }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === f ? 'bg-white text-[#1a2030] shadow-sm' : 'text-[#888] hover:text-[#555]'}`}
              >
                {f === 'all' ? 'All' : 'Unread'}
              </button>
            ))}
          </div>
          <button type="button" onClick={markAll} disabled={unreadCount === 0 && filter === 'all'} className="text-xs font-semibold text-[#4f6df5] hover:underline disabled:opacity-40 disabled:no-underline">Mark all as read</button>
        </div>

        {state === 'loading' && <p className="px-6 py-10 text-center text-sm text-[#AAA]">Loading…</p>}
        {state === 'error' && (
          <p className="px-6 py-10 text-center text-sm text-[#888]">Couldn&apos;t load notifications. <button type="button" onClick={reload} className="font-semibold text-[#4f6df5] hover:underline">Try again</button></p>
        )}
        {state === 'ready' && items.length === 0 && (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#EEF2FF] text-[#4f6df5]">
              <HugeiconsIcon icon={Notification03Icon} size={22} color="currentColor" strokeWidth={1.5} />
            </span>
            <p className="text-sm font-medium text-[#1a1a1a]">{filter === 'unread' ? 'You’re all caught up' : 'No notifications yet'}</p>
            <p className="text-xs text-[#888] mt-1">{filter === 'unread' ? 'Nothing new since you last looked.' : 'New inquiries, approvals, activations, uploads, comments and email problems will appear here.'}</p>
          </div>
        )}
        {state === 'ready' && items.length > 0 && (
          <ul className="divide-y divide-[#F0F0F0]">
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => open(n)} className={`flex w-full items-start gap-4 px-6 py-3.5 text-left transition-colors hover:bg-[#F6F8FF] ${n.read ? '' : 'bg-[#FAFBFF]'}`}>
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.type === 'email.failed' ? 'bg-red-50 text-[#e05252]' : 'bg-[#EEF2FF] text-[#4f6df5]'}`}>
                    <HugeiconsIcon icon={ICONS[n.type] ?? Notification03Icon} size={18} color="currentColor" strokeWidth={1.5} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm truncate ${n.read ? 'font-medium text-[#444]' : 'font-semibold text-[#1a1a1a]'}`}>{n.title}</span>
                    {n.body && <span className="block text-xs text-[#777] truncate">{n.body}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 pt-0.5">
                    <span className="text-xs text-[#999]">{ago(n.createdAt)}</span>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-[#4f6df5]" aria-label="Unread" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {cursor && state === 'ready' && (
          <div className="border-t border-[#F0F0F0] px-6 py-3 text-center">
            <button type="button" onClick={loadMore} disabled={loadingMore} className="text-xs font-semibold text-[#4f6df5] hover:underline disabled:opacity-50">{loadingMore ? 'Loading…' : 'Show older'}</button>
          </div>
        )}
      </section>
    </div>
  );
}
