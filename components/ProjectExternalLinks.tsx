'use client';

import { useState } from 'react';
import { ExternalLinkChip, ExternalLinkField } from '@/components/ExternalLink';
import { useToast } from '@/components/Toast';
import { normalizeExternalLink } from '@/lib/externalLink';

export interface LinkedItem { id: string; kind: 'Folder' | 'File'; name: string; url: string }

/**
 * The "External links" group on a project's information page: the project's own link (editable here), plus every folder and
 * file in the project that has a link configured. The point is large downloads (Dropbox, Google Drive, …) that don't fit
 * in the portal's own file storage.
 */
export default function ProjectExternalLinks({ projectId, link, items, onSaved }: { projectId: string; link: string | null; items: LinkedItem[]; onSaved: () => void }) {
  const toast = useToast();
  const saved = link ?? '';
  const [value, setValue] = useState(saved);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = value.trim() !== saved;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const check = normalizeExternalLink(value);
    if (!check.ok) { setError(check.error); return; }
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalLink: check.value }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setError(data.error || 'Could not save the link.'); return; }
      setValue(data.externalLink ?? '');
      toast.success(check.value ? 'Project link saved' : 'Project link removed');
      onSaved();
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={save} noValidate className="space-y-2">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <ExternalLinkField id={`project-link-${projectId}`} label="Project link" value={value} onChange={(v) => { setValue(v); setError(''); }} hint="Shown to the client on this project. Use it for downloads that are too large to upload here." />
          </div>
          <button
            type="submit"
            disabled={!dirty || saving}
            className="mb-[22px] inline-flex h-[42px] shrink-0 items-center rounded-full bg-[#1a2030] px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-[#e05252]">{error}</p>}
        {link && !dirty && <ExternalLinkChip url={link} />}
      </form>

      {items.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#AAA]">Folder and file links</p>
          <ul className="divide-y divide-[#F0F0F0] rounded-xl border border-[#EBEBEB]">
            {items.map((it) => (
              <li key={`${it.kind}-${it.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1a1a1a]">{it.name}</p>
                  <p className="text-xs text-[#999]">{it.kind}</p>
                </div>
                <ExternalLinkChip url={it.url} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
