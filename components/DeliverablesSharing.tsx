'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Share08Icon } from '@hugeicons/core-free-icons';
import DialogFocus from '@/components/DialogFocus';
import { ModalCloseButton } from '@/components/ModalParts';
import { useToast } from '@/components/Toast';

interface Share { isPublic: boolean; shareToken: string }

export default function DeliverablesSharing({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const [share, setShare] = useState<Share | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/deliverables/share?projectId=${encodeURIComponent(projectId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load sharing.');
        setShare(data.share);
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load sharing.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId]);

  async function change(action: 'enable' | 'rotate' | 'revoke') {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/deliverables/share', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not update sharing.');
      setShare(data.share);
      toast.success(action === 'revoke' ? 'Deliverables sharing turned off' : action === 'rotate' ? 'Deliverables link replaced' : 'Deliverables link created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update sharing.');
    } finally { setBusy(false); }
  }

  const url = share?.isPublic && typeof window !== 'undefined' ? `${window.location.origin}/share/deliverables/${share.shareToken}` : '';
  const buttonClass = 'inline-flex h-9 items-center justify-center rounded-full border border-[#D5D9E4] px-4 text-xs font-semibold text-[#4f6df5] transition-colors hover:bg-[#EEF2FF] disabled:opacity-50';
  const close = () => { if (!busy) setOpen(false); };
  return (
    <>
      <button
        type="button"
        aria-label="Share deliverables"
        title="Share deliverables"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen(true)}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors hover:border-[#7BB5F5] hover:bg-[#EEF2FF] focus-visible:outline-2 focus-visible:outline-[#4f6df5] ${share?.isPublic ? 'border-[#B8C4FF] bg-[#EEF2FF] text-[#4f6df5]' : 'border-[#D5D9E4] bg-white text-[#4b5260]'}`}
      >
        <HugeiconsIcon icon={Share08Icon} size={20} color="currentColor" strokeWidth={1.5} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={close} />
          <section id={dialogId} role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-title`} className="relative max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-3xl border border-[#F0F0F0] bg-white p-7 shadow-xl">
            <DialogFocus onClose={close} />
            <ModalCloseButton onClick={close} disabled={busy} label="Close deliverables sharing" />
            <h2 id={`${dialogId}-title`} className="pr-10 text-lg font-semibold text-[#1a2030]">Share deliverables</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#777]">One client link to browse every folder and its files. It includes folders added later, even when their individual folder links are off.</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {share?.isPublic ? <>
                <input aria-label="Deliverables share link" readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="h-9 w-full min-w-0 rounded-lg border border-[#D5D9E4] bg-white px-3 text-xs text-[#555]" />
                <button type="button" disabled={busy} className={buttonClass} onClick={() => navigator.clipboard.writeText(url).then(() => toast.success('Link copied', 'The deliverables link is on your clipboard.')).catch(() => setError('Could not copy the link. Select it and copy it manually.'))}>Copy link</button>
                <button type="button" disabled={busy} className={buttonClass} onClick={() => change('rotate')}>Replace link</button>
                <button type="button" disabled={busy} className={buttonClass} onClick={() => change('revoke')}>Turn sharing off</button>
              </> : <button type="button" disabled={loading || busy} className={buttonClass} onClick={() => change('enable')}>{loading ? 'Loading sharing…' : busy ? 'Creating link…' : 'Create deliverables link'}</button>}
            </div>
            {share?.isPublic && <p className="mt-3 text-xs text-[#888]">Anyone with this link can view these deliverables. Replacing or turning off the link retires the current URL.</p>}
            {error && <p role="alert" className="mt-3 text-sm text-[#e05252]">{error}</p>}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
