'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
  FolderAddIcon,
  Folder01Icon,
  Globe02Icon,
  LockIcon,
} from '@hugeicons/core-free-icons';
import { useToast } from '@/components/Toast';
import Toggle from '@/components/Toggle';
import FileTile from '@/components/FileTile';
import { PreviewFile, formatBytes } from '@/components/FilePreviewModal';
import { getDeliverableCategories, OTHER_CATEGORY } from '@/lib/deliverables';

export interface FolderRecord {
  id: string;
  inquiryId: string | null;
  projectId: string | null;
  name: string;
  description: string | null;
  isPublic: boolean;
  shareToken: string;
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
  createdAt: string;
}

interface Props {
  targetType: 'inquiry' | 'project';
  targetId: string;
  service: string;
  folders: FolderRecord[];
  deliverables: DeliverableRecord[];
  onPreview: (file: PreviewFile) => void;
}

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
        {children}
      </motion.div>
    </div>,
    document.body,
  );
}

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
  onSave: (v: { name: string; description: string; isPublic: boolean }) => Promise<string | null>;
}) {
  const toast = useToast();
  const [name, setName] = useState(folder?.name ?? '');
  const [description, setDescription] = useState(folder?.description ?? '');
  const [isPublic, setIsPublic] = useState(folder?.isPublic ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Folder name is required.'); return; }
    setSaving(true);
    setError('');
    const err = await onSave({ name, description, isPublic });
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
          {!folder && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setName(s); setError(''); }}
                  className="rounded-full bg-[#F1F3F9] px-3 py-1 text-xs font-medium text-[#555] hover:bg-[#E6EAF5] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="folder-description" className="text-sm font-medium text-[#555]">Description <span className="text-[#CCC] font-normal">— optional</span></label>
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
            When on, anyone with this folder&apos;s shared link can view the files inside it. When off, the link stops working.
          </p>
          {folder && isPublic && folder.isPublic && (
            <div className="flex items-center gap-2 pt-1">
              <input readOnly value={shareUrl(folder.shareToken)} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 rounded-lg border border-[#D0D0D0] bg-white px-3 py-2 text-xs text-[#555]" aria-label="Shared link" />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(shareUrl(folder.shareToken)).then(() => toast.success('Link copied', 'The shared link is on your clipboard.'))}
                className="shrink-0 rounded-full border border-[#1a2030] px-3.5 py-1.5 text-xs font-semibold text-[#1a2030] hover:bg-[#1a2030] hover:text-white transition-all"
              >
                Copy
              </button>
            </div>
          )}
          {!folder && isPublic && <p className="text-xs text-[#777]">The link will be available as soon as the folder is created.</p>}
        </div>

        {error && <p className="text-sm text-[#e05252]">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className="inline-flex items-center h-10 px-5 rounded-full border border-[#D0D0D0] text-[#555] text-sm font-medium hover:bg-[#F5F5F5] transition-colors disabled:opacity-50">
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/deliverables/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
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
          <label htmlFor="edit-file-description" className="text-sm font-medium text-[#555]">Description <span className="text-[#CCC] font-normal">— optional</span></label>
          <textarea id="edit-file-description" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} resize-none`} />
        </div>
        {error && <p className="text-sm text-[#e05252]">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="inline-flex items-center h-10 px-5 rounded-full border border-[#D0D0D0] text-[#555] text-sm font-medium hover:bg-[#F5F5F5] transition-colors disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center h-10 px-6 rounded-full bg-[#1a2030] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-50 disabled:hover:translate-y-0">{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </Dialog>
  );
}

/** Upload controls + files for one open folder. */
function FolderBody({
  folder,
  files,
  onPreview,
}: {
  folder: FolderRecord;
  files: DeliverableRecord[];
  onPreview: (file: PreviewFile) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [picked, setPicked] = useState<File[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [descriptions, setDescriptions] = useState<string[]>([]);
  const [editing, setEditing] = useState<DeliverableRecord | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [wordmark, setWordmark] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function upload() {
    if (picked.length === 0) { setError('Choose at least one file.'); return; }
    const missing = titles.findIndex((t) => !t.trim());
    if (missing !== -1) { setError(`Add a title for ${picked[missing].name}.`); return; }
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const body = new FormData();
      body.append('folderId', folder.id);
      picked.forEach((f) => body.append('files', f));
      body.append('titles', JSON.stringify(titles));
      body.append('descriptions', JSON.stringify(descriptions));
      body.append('watermark', wordmark ? '1' : '0');
      const res = await fetch('/api/admin/deliverables', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed.');
      toast.success(
        data.count === 1 ? 'File uploaded' : 'Files uploaded',
        `${data.count} ${data.count === 1 ? 'file was' : 'files were'} added to “${folder.name}”${wordmark ? ' with the wordmark' : ''}.`,
      );
      if (data.skipped?.length) setNotice(`Wordmark applies to images and PDFs only, so it was not added to: ${data.skipped.join(', ')}.`);
      setPicked([]);
      setTitles([]);
      setDescriptions([]);
      setInputKey((k) => k + 1);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      toast.error('Upload failed', err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  }

  async function remove(file: DeliverableRecord) {
    try {
      const res = await fetch(`/api/admin/deliverables/${file.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('File deleted', `${file.title || file.fileName} was removed from “${folder.name}”.`);
      router.refresh();
    } catch {
      toast.error('Could not delete file', `${file.fileName} was not deleted. Please try again.`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center h-10 px-5 rounded-full border border-[#1a2030] text-[#1a2030] text-sm font-medium cursor-pointer hover:bg-[#1a2030] hover:text-white transition-all">
            Choose files
            <input
              key={inputKey}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                setPicked(list);
                // Titles start as the file name (without its extension) so there's always a sensible default to edit.
                setTitles(list.map((f) => f.name.replace(/\.[^.]+$/, '')));
                setDescriptions(list.map(() => ''));
                setError('');
              }}
            />
          </label>
          <span className="text-sm text-[#888] truncate max-w-[260px]">
            {picked.length === 0 ? 'No files selected' : picked.length === 1 ? picked[0].name : `${picked.length} files selected`}
          </span>
          <div className="ml-auto flex items-center gap-4">
            <Toggle checked={wordmark} onChange={setWordmark} label="Wordmark" />
            <button
              type="button"
              onClick={upload}
              disabled={uploading || picked.length === 0}
              className="inline-flex items-center h-10 px-6 rounded-full bg-[#1a2030] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>

        {picked.length > 0 && (
          <ul className="mt-4 space-y-3">
            {picked.map((f, i) => (
              <li key={`${f.name}-${i}`} className="rounded-xl border border-[#E4E8F3] bg-white p-3">
                <p className="mb-2 text-xs text-[#888] truncate" title={f.name}>{f.name} · {formatBytes(f.size)}</p>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`file-title-${folder.id}-${i}`} className="text-xs font-medium text-[#555]">Title <span className="text-red-400">*</span></label>
                    <input
                      id={`file-title-${folder.id}-${i}`}
                      type="text"
                      value={titles[i] ?? ''}
                      maxLength={200}
                      onChange={(e) => { setTitles((prev) => prev.map((t, idx) => (idx === i ? e.target.value : t))); setError(''); }}
                      placeholder="Primary wordmark"
                      className="w-full bg-white rounded-xl px-3.5 py-2 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`file-description-${folder.id}-${i}`} className="text-xs font-medium text-[#555]">Description <span className="text-[#BBB] font-normal">— optional</span></label>
                    <input
                      id={`file-description-${folder.id}-${i}`}
                      type="text"
                      value={descriptions[i] ?? ''}
                      maxLength={500}
                      onChange={(e) => setDescriptions((prev) => prev.map((d, idx) => (idx === i ? e.target.value : d)))}
                      placeholder="Where and how this should be used"
                      className="w-full bg-white rounded-xl px-3.5 py-2 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border border-[#D0D0D0] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 transition-all"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-[#e05252] mt-3">{error}</p>}
        {notice && <p className="text-sm text-[#888] mt-3">{notice}</p>}
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-[#999]">No files in this folder yet.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {files.map((d) => (
            <FileTile
              key={d.id}
              url={`/api/deliverables/${d.id}`}
              fileName={d.fileName}
              size={d.size}
              title={d.title}
              description={d.description}
              onOpen={() => onPreview({ url: `/api/deliverables/${d.id}`, fileName: d.fileName, size: d.size, title: d.title, description: d.description })}
              onEdit={() => setEditing(d)}
              onDelete={() => remove(d)}
            />
          ))}
        </div>
      )}
      {editing && <EditFileDialog file={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Admin-side deliverables: files live inside named folders, and a folder can be shared through a public link. */
export default function DeliverablesPanel({ targetType, targetId, service, folders, deliverables, onPreview }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ mode: 'create' } | { mode: 'edit'; folder: FolderRecord } | null>(null);
  const [toDelete, setToDelete] = useState<FolderRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const mine = folders.filter((f) => (targetType === 'inquiry' ? f.inquiryId === targetId : f.projectId === targetId));
  const allFiles = deliverables.filter((d) => (targetType === 'inquiry' ? d.inquiryId === targetId : d.projectId === targetId));
  const unfiled = allFiles.filter((d) => !d.folderId);
  const suggestions = getDeliverableCategories(service).filter((c) => c !== OTHER_CATEGORY);

  const toggleOpen = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function saveFolder(values: { name: string; description: string; isPublic: boolean }): Promise<string | null> {
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
        if (data.id) setOpenIds((prev) => new Set(prev).add(data.id));
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
      toast.success('File deleted', `${file.fileName} was removed.`);
      router.refresh();
    } catch {
      toast.error('Could not delete file', `${file.fileName} was not deleted. Please try again.`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#666]">
          {mine.length} {mine.length === 1 ? 'folder' : 'folders'}
        </p>
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
        <ul className="space-y-3">
          {mine.map((folder) => {
            const files = allFiles.filter((d) => d.folderId === folder.id);
            const isOpen = openIds.has(folder.id);
            return (
              <li key={folder.id} className="rounded-xl border border-[#E2E4EA] bg-white">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggleOpen(folder.id)}
                    className="flex flex-1 min-w-0 items-center gap-3 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF]">
                      <HugeiconsIcon icon={Folder01Icon} size={20} color="#4f6df5" strokeWidth={1.5} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#1a1a1a] truncate">{folder.name}</span>
                        <span className="shrink-0 rounded-full bg-[#F1F2F5] px-2 py-0.5 text-[11px] font-semibold text-[#666]">{files.length} {files.length === 1 ? 'file' : 'files'}</span>
                        {folder.isPublic ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                            <HugeiconsIcon icon={Globe02Icon} size={12} color="currentColor" strokeWidth={2} /> Public
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F1F2F5] px-2 py-0.5 text-[11px] font-semibold text-[#888]">
                            <HugeiconsIcon icon={LockIcon} size={12} color="currentColor" strokeWidth={2} /> Private
                          </span>
                        )}
                      </span>
                      {folder.description && <span className="block text-xs text-[#777] truncate">{folder.description}</span>}
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    {folder.isPublic && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(shareUrl(folder.shareToken)).then(() => toast.success('Link copied', `The shared link for “${folder.name}” is on your clipboard.`))}
                        className="inline-flex items-center gap-1.5 h-8 rounded-full px-3 text-xs font-semibold text-[#4f6df5] hover:bg-[#EEF2FF] transition-colors"
                        title="Copy shared link"
                      >
                        <HugeiconsIcon icon={Copy01Icon} size={14} color="currentColor" strokeWidth={1.75} />
                        Copy link
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDialog({ mode: 'edit', folder })}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[#666] hover:bg-[#F1F2F7] transition-colors"
                      title="Edit folder"
                      aria-label={`Edit ${folder.name}`}
                    >
                      <HugeiconsIcon icon={Edit02Icon} size={16} color="currentColor" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setToDelete(folder)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[#e05252] hover:bg-red-50 transition-colors"
                      title="Delete folder"
                      aria-label={`Delete ${folder.name}`}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={16} color="currentColor" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleOpen(folder.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[#666] hover:bg-[#F1F2F7] transition-colors"
                      aria-label={isOpen ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
                    >
                      <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex">
                        <HugeiconsIcon icon={ArrowDown01Icon} size={16} color="currentColor" strokeWidth={1.75} />
                      </motion.span>
                    </button>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                      animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                      exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="border-t border-[#EEF0F4] p-4">
                        <FolderBody folder={folder} files={files} onPreview={onPreview} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}

      {unfiled.length > 0 && (
        <div className="rounded-xl border border-[#E2E4EA] bg-white p-4">
          <p className="text-sm font-semibold text-[#1a1a1a]">Unfiled files</p>
          <p className="mb-3 text-xs text-[#777]">Uploaded before folders existed. Delete them and re-upload into a folder to organize them.</p>
          <div className="flex flex-wrap gap-3">
            {unfiled.map((d) => (
              <FileTile
                key={d.id}
                url={`/api/deliverables/${d.id}`}
                fileName={d.fileName}
                size={d.size}
                title={d.title}
                description={d.description}
                onOpen={() => onPreview({ url: `/api/deliverables/${d.id}`, fileName: d.fileName, size: d.size, title: d.title, description: d.description })}
                onDelete={() => removeUnfiled(d)}
              />
            ))}
          </div>
        </div>
      )}

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
              This permanently deletes <span className="font-medium text-[#1a1a1a]">{toDelete.name}</span> and the{' '}
              {allFiles.filter((d) => d.folderId === toDelete.id).length} file(s) inside it.{toDelete.isPublic ? ' Its shared link will stop working.' : ''} This can&apos;t be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button type="button" onClick={() => setToDelete(null)} disabled={deleting} className="inline-flex items-center h-10 px-5 rounded-full border border-[#D0D0D0] text-[#555] text-sm font-medium hover:bg-[#F5F5F5] transition-colors disabled:opacity-50">
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
