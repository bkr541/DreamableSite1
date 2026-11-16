'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

interface Share { isPublic: boolean; shareToken: string }

export default function DeliverablesSharing({ projectId }: { projectId: string }) {
  const toast = useToast();
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
  return (
    <section aria-label="Deliverables sharing" className="mb-5 rounded-2xl border border-[#E2E4EA] bg-[#FAFBFD] p-5">
      <h3 className="text-sm font-semibold text-[#1a2030]">Share deliverables</h3>
      <p className="mt-1 text-xs leading-relaxed text-[#777]">One client link to browse every folder and its files. It includes folders added later, even when their individual folder links are off.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {share?.isPublic ? <>
          <input aria-label="Deliverables share link" readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-lg border border-[#D5D9E4] bg-white px-3 text-xs text-[#555]" />
          <button type="button" disabled={busy} className={buttonClass} onClick={() => navigator.clipboard.writeText(url).then(() => toast.success('Link copied', 'The deliverables link is on your clipboard.')).catch(() => setError('Could not copy the link. Select it and copy it manually.'))}>Copy link</button>
          <button type="button" disabled={busy} className={buttonClass} onClick={() => change('rotate')}>Replace link</button>
          <button type="button" disabled={busy} className={buttonClass} onClick={() => change('revoke')}>Turn sharing off</button>
        </> : <button type="button" disabled={loading || busy} className={buttonClass} onClick={() => change('enable')}>{loading ? 'Loading sharing…' : busy ? 'Creating link…' : 'Create deliverables link'}</button>}
      </div>
      {share?.isPublic && <p className="mt-2 text-xs text-[#888]">Anyone with this link can view these deliverables. Replacing or turning off the link retires the current URL.</p>}
      {error && <p role="alert" className="mt-2 text-sm text-[#e05252]">{error}</p>}
    </section>
  );
}
