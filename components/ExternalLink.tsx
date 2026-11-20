'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { LinkSquare02Icon } from '@hugeicons/core-free-icons';
import { linkLabel, normalizeExternalLink } from '@/lib/externalLink';

// Optional "external link" (Dropbox, Google Drive, …) for projects, folders and files.

/** A labelled input for an external link. Shows a message as soon as what is typed can't be a web link. */
export function ExternalLinkField({ id, value, onChange, label = 'External link', hint, disabled }: { id: string; value: string; onChange: (v: string) => void; label?: string; hint?: string; disabled?: boolean }) {
  const check = value.trim() ? normalizeExternalLink(value) : null;
  const error = check && !check.ok ? check.error : '';
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[#555]">{label}</label>
      <input
        id={id}
        type="text"
        inputMode="url"
        autoComplete="off"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://www.dropbox.com/…"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] transition-all focus:outline-none focus:ring-2 focus:ring-purple-200/50 disabled:opacity-50 ${error ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`}
      />
      {error ? <p id={`${id}-error`} role="alert" className="text-xs text-[#e05252]">{error}</p> : hint ? <p id={`${id}-hint`} className="text-xs text-[#888]">{hint}</p> : null}
    </div>
  );
}

/** A link to an external download, named for where it goes ("Dropbox", "Google Drive"). Opens in a new tab. */
export function ExternalLinkChip({ url, prefix = 'Open in', className = '' }: { url: string; prefix?: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#D5D8DE] bg-white px-3 py-1 text-xs font-semibold text-[#4f6df5] transition-colors hover:bg-[#EEF2FF] focus-visible:outline-2 focus-visible:outline-[#4f6df5] ${className}`}
    >
      <HugeiconsIcon icon={LinkSquare02Icon} size={14} color="currentColor" strokeWidth={1.75} className="shrink-0" />
      <span className="truncate">{prefix} {linkLabel(url)}</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
