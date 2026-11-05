'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
  FolderAddIcon,
  Folder01Icon,
  Globe02Icon,
  LockIcon,
  Message01Icon,
} from '@hugeicons/core-free-icons';
import { useToast } from '@/components/Toast';
import Toggle from '@/components/Toggle';
import ArtifactThumb from '@/components/ArtifactThumb';
import { Avatar } from '@/components/RecordList';
import { canWatermarkName } from '@/lib/watermarkTypes';
import { PreviewFile, formatBytes } from '@/components/FilePreviewModal';
import { getDeliverableCategories, OTHER_CATEGORY } from '@/lib/deliverables';
import { pool, putFile } from '@/lib/clientUpload';
import DialogFocus from '@/components/DialogFocus';
import { MODAL_CANCEL_CLASS } from '@/components/ModalParts';

export interface FolderRecord {
  id: string;
  inquiryId: string | null;
  projectId: string | null;
  name: string;
  description: string | null;
  isPublic: boolean;
  shareToken: string;
  commentsEnabled: boolean;
  commentsModerated: boolean;
  /** When the link was last replaced (rotated, or sharing turned off/on). */
  shareRotatedAt: string | null;
  createdAt: string;
}

export interface DeliverableRecord {
  id: string;
  inquiryId: string | null;
  projectId: string | null;
  folderId: string | null;
  title: string | null;
  description: string | null;
  fileName: string;
  size: number;
  watermark: boolean;
  createdAt: string;
}

export interface CommentRecord {
  id: string;
  deliverableId: string;
  authorName: string;
  body: string;
  /** APPROVED = public, PENDING = waiting for review, HIDDEN = removed from the public link. */
  status: string;
  createdAt: string;
}

interface Props {
  targetType: 'inquiry' | 'project';
  targetId: string;
  service: string;
  folders: FolderRecord[];
  deliverables: DeliverableRecord[];
  comments: CommentRecord[];
  /** The folder currently open (kept by the parent so it survives data refreshes). */
  openFolderId: string | null;
  onOpenFolder: (id: string | null) => void;
  onPreview: (file: PreviewFile) => void;
}

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -48 }),
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const shareUrl = (token: string) => `${window.location.origin}/share/${token}`;

const inputCls =
  'w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all';

/** Overlay shell rendered at <body> level so it isn't affected by transformed parents. */
function Dialog({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: React.ReactNode; busy?: boolean }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-[520px] rounded-3xl bg-white shadow-xl border border-[#F0F0F0] p-7 max-h-[90vh] overflow-y-auto"
      >
        <DialogFocus onClose={() => !busy && onClose()} />
        {children}
      </motion.div>
    </div>,
    document.body,
  );
}

export interface FolderValues { name: string; description: string; isPublic: boolean; commentsEnabled: boolean; commentsModerated: boolean }

/** Create / edit folder form. */
function FolderDialog({
  folder,
  suggestions,
  onClose,
  onSave,
}: {
  folder: FolderRecord | null;
  suggestions: string[];
  onClose: () => void;
  onSave: (v: FolderValues) => Promise<string | null>;
}) {
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(folder?.name ?? '');
  const [description, setDescription] = useState(folder?.description ?? '');
  const [isPublic, setIsPublic] = useState(folder?.isPublic ?? false);
  const [commentsEnabled, setCommentsEnabled] = useState(folder?.commentsEnabled ?? true);
  const [commentsModerated, setCommentsModerated] = useState(folder?.commentsModerated ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [armed, setArmed] = useState(false);
  const [rotating, setRotating] = useState(false);

  // Rotating breaks every copy of the old link, so it takes two deliberate clicks.
  async function rotateLink() {
    if (!folder) return;
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 5000); return; }
    setRotating(true);
    setArmed(false);
    try {
      const res = await fetch(`/api/admin/deliverable-folders/${folder.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rotate' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not replace the link.');
      toast.success('Link replaced', 'The old link no longer works. Copy the new one to share it.');
      router.refresh();
    } catch (err) {
      toast.error('Could not replace the link', err instanceof Error ? err.message : undefined);
    } finally {
      setRotating(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Folder name is required.'); return; }
    setSaving(true);
    setError('');
    const err = await onSave({ name, description, isPublic, commentsEnabled, commentsModerated });
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <Dialog title={folder ? 'Edit folder' : 'New folder'} onClose={onClose} busy={saving}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={FolderAddIcon} size={26} color="#1a2030" strokeWidth={1.75} />
          <p className="text-xl font-semibold text-[#1a1a1a]">{folder ? 'Edit folder' : 'New folder'}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="folder-name" className="text-sm font-medium text-[#555]">Folder Name <span className="text-red-400">*</span></label>
          <input
            id="folder-name"
            value={name}
            maxLength={120}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="Wordmark"
            autoFocus
            className={`${inputCls} ${error && !name.trim() ? '!border-[#e05252]' : ''}`}
          />
          {/* Fixed-height row so the dialog is the same size when creating or editing. */}
          <div className="flex h-7 items-center gap-2 overflow-x-auto pt-1" aria-hidden={!!folder}>
            {!folder && suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setName(s); setError(''); }}
                className="shrink-0 rounded-full bg-[#F1F3F9] px-3 py-1 text-xs font-medium text-[#555] hover:bg-[#E6EAF5] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="folder-description" className="text-sm font-medium text-[#555]">Description</label>
          <textarea
            id="folder-description"
            rows={3}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's in this folder?"
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="rounded-xl border border-[#E4E8F3] bg-[#F6F7FB] p-4 space-y-2">
          <Toggle checked={isPublic} onChange={setIsPublic} label="Publicly accessible" id="folder-public" />
          <p className="text-xs leading-relaxed text-[#777]">
            When on, anyone with this folder&apos;s shared link can view the files inside it. Turning it off stops the link working straight away, and turning it on again creates a brand-new link — the old one never comes back.
          </p>
          {/* Always the same height, whatever the toggle shows, so the dialog never resizes. */}
          <div className="h-9 flex items-center">
            {folder && isPublic && folder.isPublic ? (
              <div className="flex w-full items-center gap-2">
                <input readOnly value={shareUrl(folder.shareToken)} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 rounded-lg border border-[#D0D0D0] bg-white px-3 py-2 text-xs text-[#555]" aria-label="Shared link" />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(shareUrl(folder.shareToken)).then(() => toast.success('Link copied', 'The shared link is on your clipboard.'))}
                  className="shrink-0 rounded-full border border-[#1a2030] px-3.5 py-1.5 text-xs font-semibold text-[#1a2030] hover:bg-[#1a2030] hover:text-white transition-all"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={rotateLink}
                  disabled={rotating}
                  title="Replace the link. Anyone using the old one loses access immediately."
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${armed ? 'border-[#e05252] bg-[#e05252] text-white' : 'border-[#D0D0D0] text-[#555] hover:bg-[#F5F5F5]'}`}
                >
                  {rotating ? 'Replacing…' : armed ? 'Break old link?' : 'New link'}
                </button>
              </div>
            ) : isPublic ? (
              <p className="text-xs text-[#777]">The shared link is created when you save.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-[#E4E8F3] bg-[#F6F7FB] p-4 space-y-3">
          <Toggle checked={commentsEnabled} onChange={setCommentsEnabled} label="Allow comments" id="folder-comments" />
          <Toggle checked={commentsEnabled && commentsModerated} onChange={setCommentsModerated} label="Review comments before they appear" id="folder-moderated" disabled={!commentsEnabled} />
          <p className="text-xs leading-relaxed text-[#777]">
            Visitors type their own name, so comments are always shown as unverified. Reviewing lets you approve each one first.
          </p>
        </div>

        <p className="h-5 text-sm text-[#e05252]">{error}</p>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className={MODAL_CANCEL_CLASS}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center h-10 px-6 rounded-full bg-[#1a2030] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-50 disabled:hover:translate-y-0">
            {saving ? 'Saving…' : folder ? 'Save changes' : 'Create folder'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Edit an uploaded artifact's title and description. */
function EditFileDialog({ file, onClose }: { file: DeliverableRecord; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState(file.title || file.fileName);
  const [description, setDescription] = useState(file.description ?? '');
  const [watermark, setWatermark] = useState(file.watermark);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const watermarkable = canWatermarkName(file.fileName);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/deliverables/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, watermark: watermarkable ? watermark : false }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not save.');
      toast.success('File updated', `“${title.trim()}” was saved.`);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title="Edit file" onClose={onClose} busy={saving}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <p className="text-xl font-semibold text-[#1a1a1a]">Edit file</p>
          <p className="mt-1 text-xs text-[#888] truncate">{file.fileName}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-file-title" className="text-sm font-medium text-[#555]">Title <span className="text-red-400">*</span></label>
          <input id="edit-file-title" value={title} maxLength={200} autoFocus onChange={(e) => { setTitle(e.target.value); setError(''); }} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-file-description" className="text-sm font-medium text-[#555]">Description</label>
          <textarea id="edit-file-description" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} resize-none`} />
        </div>
        <div className="rounded-xl border border-[#E4E8F3] bg-[#F6F7FB] p-4 space-y-1.5">
          <Toggle checked={watermarkable && watermark} onChange={setWatermark} label="Watermark" disabled={!watermarkable} />
          <p className="text-xs leading-relaxed text-[#777]">
            {watermarkable ? 'When on, a Dreamable.studio watermark is laid over this file for everyone who views it. Turn it off to remove the overlay.' : 'Watermarks can only be added to images (PNG, JPG) and PDFs.'}
          </p>
        </div>
        {error && <p className="text-sm text-[#e05252]">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className={MODAL_CANCEL_CLASS}>Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center h-10 px-6 rounded-full bg-[#1a2030] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-50 disabled:hover:translate-y-0">{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </Dialog>
  );
}

interface PendingFile {
  file: File;
  previewUrl: string;
  title: string;
  description: string;
  watermark: boolean;
  /** Direct-upload state: uploading shows a progress bar, verifying is the server's check, failed keeps the file for a retry. */
  state?: 'uploading' | 'verifying' | 'failed';
  progress?: number;
  failure?: string;
}

/** Choose files, review thumbnails, set each artifact's title / description / watermark, then upload. */
function UploadSection({ folder }: { folder: FolderRecord }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<PendingFile[]>([]);
  const [inputKey, setInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const urlsRef = useRef<string[]>([]);

  // Preview URLs are created when files are picked and released when they're removed or this section goes away.
  useEffect(() => () => { urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  function addFiles(list: File[]) {
    const added = list.map<PendingFile>((file) => {
      const previewUrl = URL.createObjectURL(file);
      urlsRef.current.push(previewUrl);
      return { file, previewUrl, title: file.name.replace(/\.[^.]+$/, ''), description: '', watermark: false };
    });
    setItems((prev) => [...prev, ...added]);
    setError('');
  }

  function removeItem(index: number) {
    setItems((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      urlsRef.current = urlsRef.current.filter((u) => u !== prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  const patch = (index: number, change: Partial<PendingFile>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...change } : it)));

  async function uploadLegacy() {
    const body = new FormData();
    body.append('folderId', folder.id);
    items.forEach((it) => body.append('files', it.file));
    body.append('titles', JSON.stringify(items.map((it) => it.title)));
    body.append('descriptions', JSON.stringify(items.map((it) => it.description)));
    body.append('watermarks', JSON.stringify(items.map((it) => it.watermark)));
    const res = await fetch('/api/admin/deliverables', { method: 'POST', body });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed.');
    return data.count as number;
  }

  /** Each file goes straight to storage with its own progress, then the server verifies it before it appears. */
  async function uploadDirect(grants: { id: string; uploadUrl: string; contentType: string }[]) {
    const done = new Set<number>();
    await pool(items.length, 3, async (i) => {
      const it = items[i];
      const grant = grants[i];
      patch(i, { state: 'uploading', progress: 0, failure: undefined });
      try {
        await putFile(grant.uploadUrl, it.file, grant.contentType, (p) => patch(i, { progress: p }));
        patch(i, { state: 'verifying', progress: 1 });
        const res = await fetch(`/api/admin/deliverables/${grant.id}/complete`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'The file could not be verified.');
        done.add(i);
      } catch (err) {
        patch(i, { state: 'failed', failure: err instanceof Error ? err.message : 'Upload failed.' });
        // Nothing half-finished stays behind: this removes the pending record and any stored bytes.
        fetch(`/api/admin/deliverables/${grant.id}`, { method: 'DELETE' }).catch(() => {});
      }
    });
    return done;
  }

  async function upload() {
    if (items.length === 0) { setError('Choose at least one file.'); return; }
    const missing = items.findIndex((it) => !it.title.trim());
    if (missing !== -1) { setError(`Add a title for ${items[missing].file.name}.`); return; }

    setUploading(true);
    setError('');
    try {
      const init = await fetch('/api/admin/deliverables/uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: folder.id,
          files: items.map((it) => ({ name: it.file.name, size: it.file.size, contentType: it.file.type, title: it.title, description: it.description, watermark: it.watermark })),
        }),
      });
      const plan = await init.json();
      if (!init.ok || !plan.ok) throw new Error(plan.error || 'Upload failed.');

      let count: number;
      let failed = 0;
      if (plan.mode === 'legacy') {
        count = await uploadLegacy();
      } else {
        const done = await uploadDirect(plan.files);
        count = done.size;
        failed = items.length - done.size;
        // Successful files leave the list; failed ones stay (with the reason) so they can be retried.
        setItems((prev) => {
          prev.forEach((it, i) => { if (done.has(i)) URL.revokeObjectURL(it.previewUrl); });
          return prev.filter((_, i) => !done.has(i)).map((it) => ({ ...it, state: it.state === 'failed' ? 'failed' : undefined, progress: undefined }));
        });
      }

      if (count > 0) {
        toast.success(count === 1 ? 'File uploaded' : 'Files uploaded', `${count} ${count === 1 ? 'file was' : 'files were'} added to “${folder.name}”.`);
        router.refresh();
      }
      if (failed > 0) {
        setError(`${failed} ${failed === 1 ? 'file' : 'files'} didn’t upload. See the message on each file, then try again.`);
        toast.error('Some files didn’t upload', `${failed} failed — they are still in the list so you can retry.`);
      } else {
        urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        urlsRef.current = [];
        setItems([]);
        setInputKey((k) => k + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      toast.error('Upload failed', err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#E2E4EA] bg-[#FAFBFD] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#1a1a1a]">Upload files</h3>
          <p className="text-xs text-[#888]">Add artifacts to “{folder.name}”. Up to 10 files at a time, 25 MB each.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center h-10 px-5 rounded-full border border-[#1a2030] text-[#1a2030] text-sm font-medium cursor-pointer hover:bg-[#1a2030] hover:text-white transition-all">
            Choose files
            <input
              key={inputKey}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
            />
          </label>
          <button
            type="button"
            onClick={upload}
            disabled={uploading || items.length === 0}
            className="inline-flex items-center h-10 px-6 rounded-full bg-[#1a2030] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {uploading ? 'Uploading…' : items.length > 1 ? `Upload ${items.length} files` : 'Upload'}
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="mt-4 space-y-3">
          {items.map((it, i) => {
            const watermarkable = canWatermarkName(it.file.name);
            return (
              <li key={it.previewUrl} className="flex gap-4 rounded-xl border border-[#E4E8F3] bg-white p-3">
                <ArtifactThumb src={it.previewUrl} fileName={it.file.name} size={88} />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-xs text-[#888]" title={it.file.name}>{it.file.name} · {formatBytes(it.file.size)}</p>
                    <button type="button" onClick={() => removeItem(i)} disabled={uploading} className="shrink-0 text-xs font-medium text-[#999] disabled:opacity-40 hover:text-[#e05252] transition-colors">Remove</button>
                  </div>
                  {it.state && (
                    <div aria-live="polite">
                      {it.state === 'failed' ? (
                        <p className="text-xs font-medium text-[#e05252]">{it.failure}</p>
                      ) : (
                        <>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E4E8F3]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((it.progress ?? 0) * 100)}>
                            <div className="h-full rounded-full bg-gradient-to-r from-[#3DD9C8] via-[#7BB5F5] to-[#B87AF5] transition-[width] duration-150" style={{ width: `${Math.round((it.progress ?? 0) * 100)}%` }} />
                          </div>
                          <p className="mt-1 text-[11px] text-[#888]">{it.state === 'verifying' ? 'Checking the file…' : `Uploading… ${Math.round((it.progress ?? 0) * 100)}%`}</p>
                        </>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-3">
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`file-title-${i}`} className="text-xs font-medium text-[#555]">Title <span className="text-red-400">*</span></label>
                      <input
                        id={`file-title-${i}`}
                        type="text"
                        value={it.title}
                        maxLength={200}
                        onChange={(e) => { patch(i, { title: e.target.value }); setError(''); }}
                        placeholder="Primary wordmark"
                        className="w-full bg-white rounded-xl px-3.5 py-2 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`file-description-${i}`} className="text-xs font-medium text-[#555]">Description</label>
                      <input
                        id={`file-description-${i}`}
                        type="text"
                        value={it.description}
                        maxLength={500}
                        onChange={(e) => patch(i, { description: e.target.value })}
                        placeholder="Where and how this should be used"
                        className="w-full bg-white rounded-xl px-3.5 py-2 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle checked={watermarkable && it.watermark} onChange={(v) => patch(i, { watermark: v })} label="Watermark" disabled={!watermarkable} />
                    {!watermarkable && <span className="text-xs text-[#999]">Images and PDFs only</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 h-5 text-sm text-[#e05252]">{error}</p>
    </section>
  );
}

/** One artifact in the folder, with its details and the comments left on it. */
function ArtifactCard({
  file,
  comments,
  folderName,
  onPreview,
}: {
  file: DeliverableRecord;
  comments: CommentRecord[];
  folderName: string;
  onPreview: (file: PreviewFile) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const url = `/api/deliverables/${file.id}`;
  const label = file.title || file.fileName;
  const watermarkable = canWatermarkName(file.fileName);

  async function toggleWatermark(next: boolean) {
    try {
      const res = await fetch(`/api/admin/deliverables/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watermark: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error);
      toast.success(next ? 'Watermark added' : 'Watermark removed', `“${label}” ${next ? 'now has' : 'no longer has'} a watermark overlay.`);
      router.refresh();
    } catch (err) {
      toast.error('Could not update watermark', err instanceof Error && err.message ? err.message : undefined);
    }
  }

  async function remove() {
    try {
      const res = await fetch(`/api/admin/deliverables/${file.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('File deleted', `${label} was removed from “${folderName}”.`);
      router.refresh();
    } catch {
      toast.error('Could not delete file', `${label} was not deleted. Please try again.`);
    }
  }

  async function removeComment(c: CommentRecord) {
    try {
      const res = await fetch(`/api/admin/deliverable-comments/${c.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Comment deleted', `The comment from ${c.authorName} was removed.`);
      router.refresh();
    } catch {
      toast.error('Could not delete comment', 'Please try again.');
    }
  }

  async function moderate(c: CommentRecord, status: 'APPROVED' | 'HIDDEN') {
    try {
      const res = await fetch(`/api/admin/deliverable-comments/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(status === 'APPROVED' ? 'Comment approved' : 'Comment hidden', status === 'APPROVED' ? `The comment from ${c.authorName} is now visible on the shared link.` : `The comment from ${c.authorName} is no longer shown on the shared link.`);
      router.refresh();
    } catch {
      toast.error('Could not update comment', 'Please try again.');
    }
  }

  return (
    <li className="flex flex-col rounded-2xl border border-[#E2E4EA] bg-white shadow-sm">
      <div className="flex gap-4 p-4">
        <button
          type="button"
          onClick={() => onPreview({ url, fileName: file.fileName, size: file.size, title: file.title, description: file.description })}
          className="shrink-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
          aria-label={`Open ${label}`}
        >
          <ArtifactThumb src={`${url}?inline=1`} fileName={file.fileName} size={96} className="hover:shadow-md transition-shadow" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#1a1a1a] truncate" title={label}>{label}</p>
          <p className="text-xs text-[#888] truncate">{file.fileName} · {formatBytes(file.size)}</p>
          {file.description && <p className="mt-1.5 text-sm leading-snug text-[#555] line-clamp-3">{file.description}</p>}
          <div className="mt-2.5">
            <Toggle checked={file.watermark} onChange={toggleWatermark} label="Watermark" disabled={!watermarkable} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button type="button" onClick={() => setEditing(true)} className="flex h-8 w-8 items-center justify-center rounded-full text-[#666] hover:bg-[#F1F2F7] transition-colors" title="Edit title and description" aria-label={`Edit ${label}`}>
            <HugeiconsIcon icon={Edit02Icon} size={16} color="currentColor" strokeWidth={1.5} />
          </button>
          <button type="button" onClick={remove} className="flex h-8 w-8 items-center justify-center rounded-full text-[#e05252] hover:bg-red-50 transition-colors" title="Delete file" aria-label={`Delete ${label}`}>
            <HugeiconsIcon icon={Delete02Icon} size={16} color="currentColor" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Comments left on this artifact from the shared link */}
      <div className="mx-4 mb-4 rounded-xl border border-[#E4E8F3] bg-[#F6F7FB] p-3">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#4a5368]">
          <HugeiconsIcon icon={Message01Icon} size={14} color="currentColor" strokeWidth={1.75} />
          Comments
          <span className="rounded-full bg-white px-2 py-px text-[11px] font-semibold text-[#4f6df5]">{comments.length}</span>
        </p>
        {comments.length === 0 ? (
          <p className="mt-2 text-xs text-[#888]">No comments yet. Comments from the shared link appear here.</p>
        ) : (
          <ul className="mt-2.5 space-y-2.5">
            {comments.map((c) => (
              <li key={c.id} className="group flex gap-2.5 rounded-lg border-l-2 border-[#7BB5F5] bg-white px-3 py-2.5">
                <Avatar name={c.authorName} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-semibold text-[#1a1a1a]">{c.authorName}</span>
                    <span className="rounded-full bg-[#F1F2F5] px-1.5 py-px text-[10px] font-semibold text-[#888]" title="Guests type their own name; it hasn't been verified.">Guest · unverified</span>
                    {c.status === 'PENDING' && <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-700">Awaiting review</span>}
                    {c.status === 'HIDDEN' && <span className="rounded-full bg-red-100 px-1.5 py-px text-[10px] font-semibold text-red-600">Hidden</span>}
                    <span className="text-[#999]">{formatWhen(c.createdAt)}</span>
                  </p>
                  <p className="mt-0.5 text-sm leading-snug text-[#444] whitespace-pre-wrap break-words">{c.body}</p>
                  {c.status !== 'APPROVED' && (
                    <button type="button" onClick={() => moderate(c, 'APPROVED')} className="mt-1.5 text-xs font-semibold text-[#4f6df5] hover:underline">Approve</button>
                  )}
                  {c.status !== 'HIDDEN' && (
                    <button type="button" onClick={() => moderate(c, 'HIDDEN')} className={`mt-1.5 text-xs font-semibold text-[#888] hover:underline ${c.status !== 'APPROVED' ? 'ml-3' : ''}`}>Hide</button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeComment(c)}
                  className="shrink-0 self-start text-[#ccc] hover:text-[#e05252] opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                  title="Delete comment"
                  aria-label={`Delete comment from ${c.authorName}`}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={15} color="currentColor" strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && <EditFileDialog file={file} onClose={() => setEditing(false)} />}
    </li>
  );
}

function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  return isPublic ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
      <HugeiconsIcon icon={Globe02Icon} size={12} color="currentColor" strokeWidth={2} /> Public
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F1F2F5] px-2 py-0.5 text-[11px] font-semibold text-[#888]">
      <HugeiconsIcon icon={LockIcon} size={12} color="currentColor" strokeWidth={2} /> Private
    </span>
  );
}

/** Admin-side deliverables: folder cards, and a dedicated group for each folder with uploads, artifacts and comments. */
export default function DeliverablesPanel({ targetType, targetId, service, folders, deliverables, comments, openFolderId, onOpenFolder, onPreview }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [direction, setDirection] = useState(1);
  const [dialog, setDialog] = useState<{ mode: 'create' } | { mode: 'edit'; folder: FolderRecord } | null>(null);
  const [toDelete, setToDelete] = useState<FolderRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const mine = folders.filter((f) => (targetType === 'inquiry' ? f.inquiryId === targetId : f.projectId === targetId));
  const allFiles = deliverables.filter((d) => (targetType === 'inquiry' ? d.inquiryId === targetId : d.projectId === targetId));
  const unfiled = allFiles.filter((d) => !d.folderId);
  const suggestions = getDeliverableCategories(service).filter((c) => c !== OTHER_CATEGORY);
  const openFolder = mine.find((f) => f.id === openFolderId) ?? null;

  const open = (id: string) => { setDirection(1); onOpenFolder(id); };
  const back = () => { setDirection(-1); onOpenFolder(null); };

  const copyLink = (folder: FolderRecord) =>
    navigator.clipboard.writeText(shareUrl(folder.shareToken)).then(() => toast.success('Link copied', `The shared link for “${folder.name}” is on your clipboard.`));

  async function saveFolder(values: FolderValues): Promise<string | null> {
    const editing = dialog?.mode === 'edit' ? dialog.folder : null;
    try {
      const res = editing
        ? await fetch(`/api/admin/deliverable-folders/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          })
        : await fetch('/api/admin/deliverable-folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetType, targetId, ...values }),
          });
      const data = await res.json();
      if (!res.ok || !data.ok) return data.error || 'Could not save the folder.';
      if (editing) {
        toast.success('Folder updated', `“${values.name.trim()}” was saved${values.isPublic !== editing.isPublic ? (values.isPublic ? ' and is now publicly accessible.' : ' and is no longer publicly accessible.') : '.'}`);
      } else {
        toast.success('Folder created', `“${values.name.trim()}” was created${values.isPublic ? ' and is publicly accessible.' : '.'}`);
        if (data.id) open(data.id);
      }
      setDialog(null);
      router.refresh();
      return null;
    } catch {
      return 'Unable to connect. Please try again.';
    }
  }

  async function deleteFolder() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/deliverable-folders/${toDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Folder deleted', `“${toDelete.name}” and its files were permanently deleted.`);
      if (openFolderId === toDelete.id) back();
      setToDelete(null);
      router.refresh();
    } catch {
      toast.error('Could not delete folder', `“${toDelete.name}” was not deleted. Please try again.`);
    } finally {
      setDeleting(false);
    }
  }

  async function removeUnfiled(file: DeliverableRecord) {
    try {
      const res = await fetch(`/api/admin/deliverables/${file.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('File deleted', `${file.title || file.fileName} was removed.`);
      router.refresh();
    } catch {
      toast.error('Could not delete file', `${file.title || file.fileName} was not deleted. Please try again.`);
    }
  }

  const folderFiles = openFolder ? allFiles.filter((d) => d.folderId === openFolder.id) : [];

  return (
    <div>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {!openFolder ? (
          <motion.div
            key="folders"
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[#666]">{mine.length} {mine.length === 1 ? 'folder' : 'folders'}</p>
              <button
                type="button"
                onClick={() => setDialog({ mode: 'create' })}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-[#1a2030] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                <HugeiconsIcon icon={FolderAddIcon} size={16} color="#ffffff" strokeWidth={1.5} />
                New folder
              </button>
            </div>

            {mine.length === 0 && unfiled.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#D0D4E0] px-6 py-10 text-center">
                <p className="text-sm font-medium text-[#1a1a1a]">No folders yet</p>
                <p className="mt-1 text-sm text-[#777]">Create a folder first — for example “Wordmark”, “Logo” or “Brand Kit” — then upload the files that belong in it.</p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {mine.map((folder) => {
                  const files = allFiles.filter((d) => d.folderId === folder.id);
                  const commentCount = comments.filter((c) => files.some((f) => f.id === c.deliverableId)).length;
                  return (
                    <li key={folder.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => open(folder.id)}
                        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(folder.id); } }}
                        aria-label={`Open folder ${folder.name}`}
                        className="flex h-full min-h-[168px] cursor-pointer flex-col rounded-2xl border border-[#E2E4EA] bg-white p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:border-[#7BB5F5] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF2FF]">
                            <HugeiconsIcon icon={Folder01Icon} size={22} color="#4f6df5" strokeWidth={1.5} />
                          </span>
                          <VisibilityBadge isPublic={folder.isPublic} />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-[#1a1a1a] truncate" title={folder.name}>{folder.name}</p>
                        <p className="mt-0.5 text-xs leading-snug text-[#777] line-clamp-2 min-h-[2rem]">{folder.description || 'No description'}</p>
                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <span className="text-xs font-medium text-[#666]">
                            {files.length} {files.length === 1 ? 'file' : 'files'}
                            {commentCount > 0 && <span className="text-[#4f6df5]"> · {commentCount} {commentCount === 1 ? 'comment' : 'comments'}</span>}
                          </span>
                          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                            {folder.isPublic && (
                              <button type="button" onClick={() => copyLink(folder)} className="flex h-8 w-8 items-center justify-center rounded-full text-[#4f6df5] hover:bg-[#EEF2FF] transition-colors" title="Copy shared link" aria-label={`Copy shared link for ${folder.name}`}>
                                <HugeiconsIcon icon={Copy01Icon} size={15} color="currentColor" strokeWidth={1.75} />
                              </button>
                            )}
                            <button type="button" onClick={() => setDialog({ mode: 'edit', folder })} className="flex h-8 w-8 items-center justify-center rounded-full text-[#666] hover:bg-[#F1F2F7] transition-colors" title="Edit folder" aria-label={`Edit ${folder.name}`}>
                              <HugeiconsIcon icon={Edit02Icon} size={15} color="currentColor" strokeWidth={1.5} />
                            </button>
                            <button type="button" onClick={() => setToDelete(folder)} className="flex h-8 w-8 items-center justify-center rounded-full text-[#e05252] hover:bg-red-50 transition-colors" title="Delete folder" aria-label={`Delete ${folder.name}`}>
                              <HugeiconsIcon icon={Delete02Icon} size={15} color="currentColor" strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {unfiled.length > 0 && (
              <div className="rounded-xl border border-[#E2E4EA] bg-white p-4">
                <p className="text-sm font-semibold text-[#1a1a1a]">Unfiled files</p>
                <p className="mb-3 text-xs text-[#777]">Uploaded before folders existed. Delete them and re-upload into a folder to organize them.</p>
                <ul className="flex flex-wrap gap-3">
                  {unfiled.map((d) => (
                    <li key={d.id} className="flex w-[220px] items-center gap-3 rounded-xl border border-[#EBEBEB] p-2">
                      <button type="button" onClick={() => onPreview({ url: `/api/deliverables/${d.id}`, fileName: d.fileName, size: d.size, title: d.title, description: d.description })} aria-label={`Open ${d.title || d.fileName}`}>
                        <ArtifactThumb src={`/api/deliverables/${d.id}?inline=1`} fileName={d.fileName} size={48} />
                      </button>
                      <span className="min-w-0 flex-1 truncate text-xs text-[#444]" title={d.title || d.fileName}>{d.title || d.fileName}</span>
                      <button type="button" onClick={() => removeUnfiled(d)} className="shrink-0 text-[#e05252] hover:text-[#c03a3a]" aria-label={`Delete ${d.title || d.fileName}`}>
                        <HugeiconsIcon icon={Delete02Icon} size={16} color="currentColor" strokeWidth={1.5} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={`folder-${openFolder.id}`}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="space-y-5"
          >
            <button type="button" onClick={back} className="inline-flex items-center gap-1 text-sm font-medium text-[#888] hover:text-[#1a2030] transition-colors">
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} color="currentColor" strokeWidth={1.75} />
              All folders
            </button>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF]">
                  <HugeiconsIcon icon={Folder01Icon} size={24} color="#4f6df5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold tracking-tight text-[#1a1a1a] break-words">{openFolder.name}</h3>
                    <VisibilityBadge isPublic={openFolder.isPublic} />
                  </div>
                  {openFolder.description && <p className="mt-0.5 text-sm text-[#666] whitespace-pre-wrap">{openFolder.description}</p>}
                  <p className="mt-1 text-xs text-[#999]">{folderFiles.length} {folderFiles.length === 1 ? 'file' : 'files'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {openFolder.isPublic && (
                  <button type="button" onClick={() => copyLink(openFolder)} className="inline-flex items-center gap-1.5 h-9 rounded-full border border-[#D5D9E4] px-4 text-xs font-semibold text-[#4f6df5] hover:bg-[#EEF2FF] transition-colors">
                    <HugeiconsIcon icon={Copy01Icon} size={14} color="currentColor" strokeWidth={1.75} />
                    Copy link
                  </button>
                )}
                <button type="button" onClick={() => setDialog({ mode: 'edit', folder: openFolder })} className="inline-flex items-center gap-1.5 h-9 rounded-full border border-[#D5D9E4] px-4 text-xs font-semibold text-[#444] hover:bg-[#F5F6FA] transition-colors">
                  <HugeiconsIcon icon={Edit02Icon} size={14} color="currentColor" strokeWidth={1.5} />
                  Edit
                </button>
                <button type="button" onClick={() => setToDelete(openFolder)} className="inline-flex items-center gap-1.5 h-9 rounded-full border border-red-200 px-4 text-xs font-semibold text-[#e05252] hover:bg-red-50 transition-colors">
                  <HugeiconsIcon icon={Delete02Icon} size={14} color="currentColor" strokeWidth={1.5} />
                  Delete
                </button>
              </div>
            </div>

            <UploadSection folder={openFolder} />

            <section>
              <h3 className="mb-3 text-sm font-semibold text-[#1a1a1a]">Files in this folder</h3>
              {folderFiles.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#D0D4E0] px-6 py-8 text-center text-sm text-[#888]">No files in this folder yet. Upload your first one above.</p>
              ) : (
                <ul className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {folderFiles.map((file) => (
                    <ArtifactCard
                      key={file.id}
                      file={file}
                      folderName={openFolder.name}
                      comments={comments.filter((c) => c.deliverableId === file.id)}
                      onPreview={onPreview}
                    />
                  ))}
                </ul>
              )}
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {dialog && (
        <FolderDialog
          folder={dialog.mode === 'edit' ? dialog.folder : null}
          suggestions={suggestions}
          onClose={() => setDialog(null)}
          onSave={saveFolder}
        />
      )}

      {toDelete && (
        <Dialog title="Delete folder" onClose={() => setToDelete(null)} busy={deleting}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-[#e05252]">
                <HugeiconsIcon icon={Delete02Icon} size={20} color="currentColor" strokeWidth={1.5} />
              </span>
              <h3 className="text-base font-semibold text-[#1a1a1a]">Delete this folder?</h3>
            </div>
            <p className="text-sm leading-relaxed text-[#555]">
              This permanently deletes <span className="font-medium text-[#1a1a1a]">{toDelete.name}</span>, the{' '}
              {allFiles.filter((d) => d.folderId === toDelete.id).length} file(s) inside it, and their comments.{toDelete.isPublic ? ' Its shared link will stop working.' : ''} This can&apos;t be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button type="button" onClick={() => setToDelete(null)} disabled={deleting} className={MODAL_CANCEL_CLASS}>
                Cancel
              </button>
              <button type="button" onClick={deleteFolder} disabled={deleting} className="inline-flex items-center h-10 px-5 rounded-full bg-[#e05252] text-white text-sm font-semibold hover:bg-[#c93f3f] transition-colors disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
