'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { HugeiconsIcon } from '@hugeicons/react';
import { File02Icon, Folder01Icon, Message01Icon } from '@hugeicons/core-free-icons';
import ArtifactThumb from '@/components/ArtifactThumb';
import { Avatar } from '@/components/RecordList';
import FilePreviewModal, { PreviewFile, formatBytes, previewKind } from '@/components/FilePreviewModal';
import DialogFocus from '@/components/DialogFocus';
import { ModalCloseButton } from '@/components/ModalParts';

interface SharedFile {
  id: string;
  fileName: string;
  size: number;
  title: string | null;
  description: string | null;
}

interface SharedComment {
  id: string;
  deliverableId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

const NAME_KEY = 'ds-share-commenter';

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Dialog where anyone with the link can read and add comments about one file. */
function CommentsDialog({
  token,
  file,
  comments,
  enabled,
  onPosted,
  onClose,
}: {
  token: string;
  file: SharedFile;
  comments: SharedComment[];
  /** false when the folder owner has turned comments off: existing comments stay readable, posting is closed. */
  enabled: boolean;
  onPosted: (c: SharedComment) => void;
  onClose: () => void;
}) {
  // The dialog only mounts after a click, so reading localStorage here can't cause a hydration mismatch.
  const [name, setName] = useState(() => {
    try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
  });
  const [text, setText] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // After a "too many comments" answer the button counts down instead of letting people hammer it.
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const waitSec = Math.max(0, Math.ceil((until - now) / 1000));

  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [until]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!text.trim()) { setError('Please write a comment.'); return; }
    setPosting(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/share/${token}/files/${file.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, body: text, website }),
      });
      const data = await res.json();
      if (res.status === 429 && typeof data.retryAfterSeconds === 'number') {
        const t = Date.now();
        setNow(t);
        setUntil(t + Math.min(data.retryAfterSeconds, 3600) * 1000);
      }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not post your comment.');
      try { localStorage.setItem(NAME_KEY, name.trim()); } catch {}
      if (data.comment) onPosted(data.comment);
      if (data.pending) setNotice(data.message || 'Thanks! Your comment will appear once it has been reviewed.');
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your comment.');
    } finally {
      setPosting(false);
    }
  }

  const label = file.title || file.fileName;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={`Comments on ${label}`} className="relative flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <DialogFocus />
        <div className="flex items-center gap-4 border-b border-[#F0F0F0] px-6 py-5">
          <ArtifactThumb src={`/api/share/${token}/files/${file.id}?inline=1`} fileName={file.fileName} size={56} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#999]">Comments</p>
            <p className="truncate text-base font-semibold text-[#1a1a1a]" title={label}>{label}</p>
          </div>
          <ModalCloseButton inline onClick={onClose} label="Close comments" />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#888]">No comments yet. Be the first to leave one.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-3 rounded-xl border-l-2 border-[#7BB5F5] bg-[#F6F7FB] px-3.5 py-3">
                  <Avatar name={c.authorName} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                      <span className="font-semibold text-[#1a1a1a]">{c.authorName}</span>
                      <span className="rounded-full bg-white px-1.5 py-px text-[10px] font-semibold text-[#888]" title="Anyone with the link can type any name; it hasn't been verified.">Guest · unverified</span>
                      <span className="text-[#999]">{formatWhen(c.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 text-sm leading-snug text-[#444] whitespace-pre-wrap break-words">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {enabled ? (
        <form onSubmit={submit} noValidate className="space-y-3 border-t border-[#F0F0F0] bg-[#FAFBFD] px-6 py-5">
          <input
            type="text"
            value={name}
            maxLength={80}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="Your name"
            aria-label="Your name"
            className="w-full rounded-xl border border-[#D0D0D0] bg-white px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-purple-200/50"
          />
          <textarea
            value={text}
            maxLength={2000}
            rows={3}
            onChange={(e) => { setText(e.target.value); setError(''); }}
            placeholder="Write a comment about this file…"
            aria-label="Comment"
            className="w-full resize-none rounded-xl border border-[#D0D0D0] bg-white px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-purple-200/50"
          />
          {/* Honeypot: hidden from people, filled in by bots */}
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700" role="status">{notice}</p>}
          <p className="text-xs text-[#999]">Names aren&apos;t verified — anyone with this link can type any name.</p>
          <div className="flex items-center justify-between gap-3">
            <p className="min-h-5 text-sm text-[#e05252]" role="alert">{error}</p>
            <button type="submit" disabled={posting || waitSec > 0} className="shrink-0 inline-flex h-10 items-center rounded-full bg-[#1a2030] px-6 text-sm font-semibold text-white hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-50 disabled:hover:translate-y-0">
              {posting ? 'Posting…' : waitSec > 0 ? `Try again in ${waitSec >= 60 ? `${Math.ceil(waitSec / 60)} min` : `${waitSec}s`}` : 'Post comment'}
            </button>
          </div>
        </form>
        ) : (
        <div className="border-t border-[#F0F0F0] bg-[#FAFBFD] px-6 py-5">
          <p className="text-sm text-[#888]">Comments are turned off for this folder.</p>
        </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  token: string;
  name: string;
  description: string | null;
  projectName: string | null;
  files: SharedFile[];
  comments: SharedComment[];
  commentsEnabled: boolean;
}

export default function SharedFolderView({ token, name, description, projectName, files, comments: initialComments, commentsEnabled }: Props) {
  const [preview, setPreview] = useState<PreviewFile | null>(null);
  const [comments, setComments] = useState<SharedComment[]>(initialComments);
  const [commentFileId, setCommentFileId] = useState<string | null>(null);
  const commentFile = files.find((f) => f.id === commentFileId) ?? null;
  const urlFor = (id: string) => `/api/share/${token}/files/${id}`;

  return (
    <main
      className="min-h-screen px-4 py-10 sm:py-16"
      style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 40%, #f0f4ff 100%)' }}
    >
      <div className="mx-auto w-full max-w-[1000px]">
        {/* Brand */}
        <div className="mb-8 flex items-center gap-2.5">
          <Image src="/images/logo.png" alt="" width={32} height={32} className="rounded-md" priority />
          <span className="text-base font-semibold tracking-tight text-[#1a1a1a]">
            Dreamable<span className="text-[#999]">.</span>studio
          </span>
        </div>

        {/* Folder header */}
        <section className="rounded-3xl bg-white p-7 sm:p-10 shadow-lg border border-[#F0F0F0]">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF2FF]">
              <HugeiconsIcon icon={Folder01Icon} size={26} color="#4f6df5" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              {projectName && <p className="text-xs font-semibold uppercase tracking-widest text-[#999]">{projectName}</p>}
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1a1a1a] break-words">{name}</h1>
              {description && <p className="mt-3 max-w-[640px] text-base leading-relaxed text-[#707070] whitespace-pre-wrap">{description}</p>}
              <p className="mt-4 text-sm font-medium text-[#888]">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </p>
            </div>
          </div>

          {/* Files */}
          {files.length === 0 ? (
            <p className="mt-10 rounded-2xl border border-dashed border-[#D0D4E0] px-6 py-12 text-center text-sm text-[#777]">
              Nothing has been added to this folder yet. Check back soon.
            </p>
          ) : (
            <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {files.map((f) => {
                const kind = previewKind(f.fileName);
                const ext = f.fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
                const url = urlFor(f.id);
                const label = f.title || f.fileName;
                const asPreview: PreviewFile = { url, fileName: f.fileName, size: f.size, title: f.title, description: f.description };
                return (
                  <li key={f.id} className="flex flex-col overflow-hidden rounded-2xl border border-[#E8E8EC] bg-white shadow-sm hover:shadow-md transition-shadow">
                    <button
                      type="button"
                      onClick={() => setPreview(asPreview)}
                      className="relative block h-44 w-full bg-[#F6F7FB] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                      aria-label={`Open ${label}`}
                    >
                      {kind === 'image' && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${url}?inline=1`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                      )}
                      {kind === 'video' && (
                        <video src={`${url}?inline=1#t=0.1`} preload="metadata" muted playsInline className="absolute inset-0 h-full w-full object-cover pointer-events-none" />
                      )}
                      {kind !== 'image' && kind !== 'video' && (
                        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <HugeiconsIcon icon={File02Icon} size={40} color="#AAAAAA" strokeWidth={1.25} />
                          <span className="text-xs font-semibold tracking-widest text-[#AAA]">{ext}</span>
                        </span>
                      )}
                    </button>
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <p className="text-sm font-semibold text-[#1a1a1a] truncate" title={label}>{label}</p>
                      <p className="text-xs text-[#888] truncate">{f.title && f.title !== f.fileName ? `${f.fileName} · ` : ''}{formatBytes(f.size)}</p>
                      {f.description && <p className="mt-1 text-sm leading-snug text-[#666]">{f.description}</p>}
                      <div className="mt-auto flex items-center gap-4 pt-3">
                        <button
                          type="button"
                          onClick={() => setPreview(asPreview)}
                          className="text-sm font-medium text-[#4f6df5] hover:text-[#3b54d6] transition-colors"
                        >
                          View
                        </button>
                        <a href={url} className="text-sm font-medium text-[#555] hover:text-[#1a2030] transition-colors">Download</a>
                        <button
                          type="button"
                          onClick={() => setCommentFileId(f.id)}
                          className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-[#555] hover:text-[#1a2030] transition-colors"
                        >
                          <HugeiconsIcon icon={Message01Icon} size={16} color="currentColor" strokeWidth={1.75} />
                          {comments.filter((c) => c.deliverableId === f.id).length || 'Comment'}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-[#999]">Shared by Dreamable.studio</p>
      </div>

      <FilePreviewModal file={preview} onClose={() => setPreview(null)} />

      {commentFile && (
        <CommentsDialog
          token={token}
          file={commentFile}
          comments={comments.filter((c) => c.deliverableId === commentFile.id)}
          enabled={commentsEnabled}
          onPosted={(c) => setComments((prev) => [...prev, c])}
          onClose={() => setCommentFileId(null)}
        />
      )}
    </main>
  );
}
