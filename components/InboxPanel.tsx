'use client';

import { useCallback, useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, Attachment01Icon, Mailbox01Icon, MailReply01Icon, Refresh01Icon } from '@hugeicons/core-free-icons';
import { useToast } from '@/components/Toast';
import type { InboxMessage } from '@/lib/zohoMail';

// The admin Inbox: recent mail from the connected Zoho mailbox. Read-only; nothing is stored on our side.

type Inbox =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | { state: 'not_configured'; problems: string[] }
  | { state: 'needs_database' }
  | { state: 'not_connected' }
  | { state: 'reconnect'; mailbox: string }
  | { state: 'connected'; mailbox: string; webUrl: string; messages: InboxMessage[]; nextStart: number | null };

const PAGE = 25;

function ago(iso: string | null) {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** An email's HTML comes from whoever sent it. It is shown in a frame with no scripts, no forms, no links that open, no
 *  network access (the policy below only allows images embedded in the message) and no access to this site. */
function frameDoc(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"><style>body{font:14px/1.55 system-ui,-apple-system,sans-serif;color:#222;margin:16px;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:#4f6df5}</style></head><body>${html}</body></html>`;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-full rounded-2xl border border-[#E2E4EA] bg-white p-8 text-center shadow-sm">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4f6df5]">
        <HugeiconsIcon icon={Mailbox01Icon} size={24} color="currentColor" strokeWidth={1.5} />
      </span>
      <h2 className="text-lg font-semibold tracking-tight text-[#1a1a1a]">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-[#666]">{children}</div>
    </div>
  );
}

const connectBtn = 'inline-flex h-10 items-center justify-center rounded-full bg-[#1a2030] px-6 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-md';

export default function InboxPanel() {
  const toast = useToast();
  const [inbox, setInbox] = useState<Inbox>({ state: 'loading' });
  const [busyMore, setBusyMore] = useState(false);
  const [open, setOpen] = useState<InboxMessage | null>(null);
  const [body, setBody] = useState<{ id: string; html: string } | { id: string; error: string } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // Fetches the first page. (It only sets state after the response arrives, so it is safe to call from an effect.)
  const fetchInbox = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/inbox?limit=${PAGE}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load the inbox.');
      setInbox(data as Inbox);
    } catch (e) {
      setInbox({ state: 'error', error: e instanceof Error ? e.message : 'Could not load the inbox.' });
    }
  }, []);

  const load = useCallback(() => { setInbox({ state: 'loading' }); return fetchInbox(); }, [fetchInbox]);

  useEffect(() => {
    const t = setTimeout(() => void fetchInbox(), 0);
    return () => clearTimeout(t);
  }, [fetchInbox]);

  // Coming back from Zoho's consent screen: say how it went, then tidy the address bar.
  useEffect(() => {
    const url = new URL(window.location.href);
    const z = url.searchParams.get('zoho');
    if (!z) return;
    const t = setTimeout(() => {
      if (z === 'connected') toast.success('Zoho Mail connected', 'Your inbox is now available here.');
      else if (z === 'denied') toast.error('Not connected', 'Access was not approved in Zoho.');
      else if (z === 'not_configured') toast.error('Zoho is not set up', 'The Zoho client settings are missing on the server.');
      else toast.error('Could not connect Zoho Mail', 'Please try again.');
      url.searchParams.delete('zoho');
      window.history.replaceState(null, '', url.toString());
    }, 0);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadMore() {
    if (inbox.state !== 'connected' || inbox.nextStart === null) return;
    setBusyMore(true);
    try {
      const res = await fetch(`/api/admin/inbox?start=${inbox.nextStart}&limit=${PAGE}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || data.state !== 'connected') throw new Error(data.error || 'Could not load more.');
      setInbox({ ...inbox, messages: [...inbox.messages, ...(data.messages as InboxMessage[])], nextStart: data.nextStart });
    } catch (e) {
      toast.error('Could not load more', e instanceof Error ? e.message : undefined);
    } finally {
      setBusyMore(false);
    }
  }

  async function read(m: InboxMessage) {
    setOpen(m);
    setBody(null);
    try {
      const res = await fetch(`/api/admin/inbox/${m.id}?folderId=${m.folderId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load the message.');
      setBody({ id: m.id, html: data.html as string });
    } catch (e) {
      setBody({ id: m.id, error: e instanceof Error ? e.message : 'Could not load the message.' });
    }
  }

  async function disconnect() {
    const res = await fetch('/api/admin/zoho', { method: 'DELETE' });
    if (!res.ok) { toast.error('Could not disconnect'); return; }
    setConfirmDisconnect(false);
    setOpen(null);
    toast.success('Zoho Mail disconnected');
    void load();
  }

  if (inbox.state === 'loading') return <p className="py-16 text-center text-sm text-[#999]" role="status">Loading your inbox…</p>;

  if (inbox.state === 'error') {
    return (
      <Notice title="Couldn’t load the inbox">
        <p role="alert">{inbox.error}</p>
        <button type="button" onClick={() => void load()} className={connectBtn}>Try again</button>
      </Notice>
    );
  }

  if (inbox.state === 'not_configured') {
    return (
      <Notice title="Zoho isn’t set up on the server yet">
        <ul className="list-inside list-disc text-left">{inbox.problems.map((p) => <li key={p}>{p}</li>)}</ul>
        <p>Add them under Vercel → Settings → Environment Variables, redeploy, and come back. See the README’s “Zoho Mail” section.</p>
      </Notice>
    );
  }

  if (inbox.state === 'needs_database') {
    return (
      <Notice title="One database step is missing">
        <p>Run the SQL file <span className="font-mono text-[13px]">20261118000000_zoho_mail_connection</span> in the Supabase SQL editor (it is also the last section of <span className="font-mono text-[13px]">prisma/APPLY_ALL_PENDING.sql</span>), then reload.</p>
      </Notice>
    );
  }

  if (inbox.state === 'not_connected' || inbox.state === 'reconnect') {
    return (
      <Notice title={inbox.state === 'reconnect' ? 'Reconnect Zoho Mail' : 'Connect your Zoho mailbox'}>
        <p>
          {inbox.state === 'reconnect'
            ? `Zoho no longer accepts the saved connection for ${inbox.mailbox}. Sign in again to restore the inbox.`
            : 'Sign in to Zoho once to read your mailbox here. This connection is read-only: it can read mail but can’t send, delete or move it. (Emails the site sends, such as from Templates, use separate email settings.)'}
        </p>
        <a href="/api/admin/zoho/connect" className={connectBtn}>{inbox.state === 'reconnect' ? 'Reconnect Zoho Mail' : 'Connect Zoho Mail'}</a>
      </Notice>
    );
  }

  // ── Reading one message ──
  if (open) {
    const ready = body && body.id === open.id ? body : null;
    return (
      <section aria-labelledby="inbox-message-title" className="w-full">
        <button type="button" onClick={() => setOpen(null)} className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[#D5D8DE] bg-white py-1.5 pl-2.5 pr-4 text-sm font-medium text-[#4b5260] transition-colors hover:bg-[#F5F6F8] hover:text-[#1a1a1a]">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} color="currentColor" strokeWidth={2} />
          Back to inbox
        </button>
        <div className="overflow-hidden rounded-2xl border border-[#E2E4EA] bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#EEF0F4] p-5">
            <div className="min-w-0">
              <h2 id="inbox-message-title" className="text-lg font-semibold tracking-tight text-[#1a1a1a] break-words">{open.subject}</h2>
              <p className="mt-1 text-sm text-[#555]">{open.fromName}{open.fromAddress && open.fromName !== open.fromAddress ? <span className="text-[#888]"> &lt;{open.fromAddress}&gt;</span> : null}</p>
              {open.receivedAt && <p className="text-xs text-[#999]">{new Date(open.receivedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
            </div>
            {open.fromAddress && (
              <a
                href={`mailto:${encodeURIComponent(open.fromAddress).replace(/%40/g, '@')}?subject=${encodeURIComponent(/^re:/i.test(open.subject) ? open.subject : `Re: ${open.subject}`)}`}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[#D5D8DE] bg-white px-4 text-sm font-medium text-[#4b5260] transition-colors hover:bg-[#F5F6F8]"
              >
                <HugeiconsIcon icon={MailReply01Icon} size={16} color="currentColor" strokeWidth={1.75} />
                Reply
              </a>
            )}
          </div>
          {!ready && <p className="p-8 text-center text-sm text-[#999]" role="status">Loading message…</p>}
          {ready && 'error' in ready && <p className="p-8 text-center text-sm text-[#e05252]" role="alert">{ready.error}</p>}
          {ready && 'html' in ready && (
            <iframe title={`Message: ${open.subject}`} sandbox="" srcDoc={frameDoc(ready.html)} className="h-[60vh] w-full border-0 bg-white" referrerPolicy="no-referrer" />
          )}
          <p className="border-t border-[#EEF0F4] px-5 py-3 text-xs text-[#999]">
            For safety, scripts, links and images that load from the internet are switched off here{open.hasAttachment ? ', and attachments aren’t shown. Open the message in Zoho Mail to see them' : ''}.
          </p>
        </div>
      </section>
    );
  }

  // ── The list ──
  return (
    <section className="w-full">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E4EA] bg-white px-5 py-4 shadow-sm">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#1a1a1a]">{inbox.mailbox}</p>
          <p className="text-xs text-[#2a8a50]">Connected · read-only</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void load()} className="inline-flex h-9 items-center gap-2 rounded-full border border-[#D5D8DE] bg-white px-4 text-sm font-medium text-[#4b5260] transition-colors hover:bg-[#F5F6F8]">
            <HugeiconsIcon icon={Refresh01Icon} size={16} color="currentColor" strokeWidth={1.75} />
            Refresh
          </button>
          <a href={inbox.webUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-full border border-[#D5D8DE] bg-white px-4 text-sm font-medium text-[#4b5260] transition-colors hover:bg-[#F5F6F8]">Open in Zoho Mail</a>
          {confirmDisconnect ? (
            <>
              <button type="button" onClick={() => void disconnect()} className="inline-flex h-9 items-center rounded-full bg-[#e05252] px-4 text-sm font-semibold text-white hover:bg-[#c93f3f]">Disconnect</button>
              <button type="button" onClick={() => setConfirmDisconnect(false)} className="inline-flex h-9 items-center rounded-full border border-[#D5D8DE] bg-white px-4 text-sm font-medium text-[#4b5260] hover:bg-[#F5F6F8]">Keep connected</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDisconnect(true)} className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-[#888] hover:text-[#e05252]">Disconnect</button>
          )}
        </div>
      </div>

      {inbox.messages.length === 0 ? (
        <p className="rounded-2xl border border-[#E2E4EA] bg-white p-10 text-center text-sm text-[#888]">Your inbox is empty.</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-[#E2E4EA] bg-white shadow-sm">
          {inbox.messages.map((m, i) => (
            <li key={m.id} className={`border-b border-[#EEF0F4] last:border-b-0 ${i % 2 === 1 ? 'bg-[#FAFBFD]' : ''}`}>
              <button type="button" onClick={() => void read(m)} className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[#F3F5FB] focus-visible:outline-2 focus-visible:outline-[#4f6df5]">
                <span aria-hidden="true" className={`mt-2 h-2 w-2 shrink-0 rounded-full ${m.unread ? 'bg-[#4f6df5]' : 'bg-transparent'}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${m.unread ? 'font-semibold text-[#1a1a1a]' : 'font-medium text-[#333]'}`}>
                    {m.fromName}{m.unread && <span className="sr-only"> (unread)</span>}
                  </span>
                  <span className={`block truncate text-sm ${m.unread ? 'text-[#1a1a1a]' : 'text-[#555]'}`}>{m.subject}</span>
                  {m.summary && <span className="block truncate text-xs text-[#999]">{m.summary}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2 pt-0.5 text-xs text-[#999]">
                  {m.hasAttachment && <HugeiconsIcon icon={Attachment01Icon} size={14} color="currentColor" strokeWidth={1.75} />}
                  {ago(m.receivedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {inbox.nextStart !== null && (
        <div className="mt-5 text-center">
          <button type="button" disabled={busyMore} onClick={() => void loadMore()} className="inline-flex h-10 items-center rounded-full border border-[#D5D8DE] bg-white px-6 text-sm font-medium text-[#4b5260] transition-colors hover:bg-[#F5F6F8] disabled:opacity-50">
            {busyMore ? 'Loading…' : 'Show older'}
          </button>
        </div>
      )}
    </section>
  );
}
