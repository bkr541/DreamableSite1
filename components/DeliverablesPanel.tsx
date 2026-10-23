'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CustomSelect from '@/components/CustomSelect';
import FileTile from '@/components/FileTile';
import { PreviewFile } from '@/components/FilePreviewModal';
import { getDeliverableCategories } from '@/lib/deliverables';

export interface DeliverableRecord {
  id: string;
  inquiryId: string | null;
  projectId: string | null;
  category: string;
  description: string | null;
  fileName: string;
  size: number;
  createdAt: string;
}

interface Props {
  targetType: 'inquiry' | 'project';
  targetId: string;
  service: string;
  deliverables: DeliverableRecord[];
  onPreview: (file: PreviewFile) => void;
}

/** Admin-side: upload deliverables into a project-type-specific category and manage what's been delivered. */
export default function DeliverablesPanel({ targetType, targetId, service, deliverables, onPreview }: Props) {
  const router = useRouter();
  const categories = getDeliverableCategories(service);
  const [category, setCategory] = useState(categories[0]);
  const [files, setFiles] = useState<File[]>([]);
  const [descriptions, setDescriptions] = useState<string[]>([]);
  const [inputKey, setInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [wordmark, setWordmark] = useState(false);

  const items = deliverables.filter((d) => (targetType === 'inquiry' ? d.inquiryId === targetId : d.projectId === targetId));
  const shown = [...categories, ...Array.from(new Set(items.map((d) => d.category))).filter((c) => !categories.includes(c))];
  const grouped = shown
    .map((c) => ({ category: c, items: items.filter((d) => d.category === c) }))
    .filter((g) => g.items.length > 0);

  async function upload() {
    if (files.length === 0) { setError('Choose at least one file.'); return; }
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const body = new FormData();
      body.append('targetType', targetType);
      body.append('targetId', targetId);
      body.append('category', category);
      files.forEach((f) => body.append('files', f));
      body.append('descriptions', JSON.stringify(descriptions));
      body.append('watermark', wordmark ? '1' : '0');
      const res = await fetch('/api/admin/deliverables', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed.');
      if (data.skipped?.length) setNotice(`Wordmark applies to images and PDFs only, so it was not added to: ${data.skipped.join(', ')}.`);
      setFiles([]);
      setDescriptions([]);
      setInputKey((k) => k + 1);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/deliverables/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-[240px]">
            <CustomSelect id={`deliverable-category-${targetId}`} value={category} options={categories} onChange={setCategory} />
          </div>
          <label className="inline-flex items-center h-[50px] px-6 rounded-full border border-[#1a2030] text-[#1a2030] text-sm font-medium cursor-pointer hover:bg-[#1a2030] hover:text-white transition-all">
            Choose files
            <input
              key={inputKey}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                setFiles(picked);
                setDescriptions(picked.map(() => ''));
                setError('');
              }}
            />
          </label>
          <span className="text-sm text-[#888] truncate max-w-[260px]">
            {files.length === 0 ? 'No files selected' : files.length === 1 ? files[0].name : `${files.length} files selected`}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={wordmark}
            onClick={() => setWordmark((v) => !v)}
            className="ml-auto inline-flex items-center gap-2.5 text-sm font-medium text-[#555] hover:text-[#1a2030] transition-colors"
          >
            <span className={`relative inline-block h-6 w-11 rounded-full transition-colors ${wordmark ? 'bg-[#1a2030]' : 'bg-[#D0D0D0]'}`}>
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${wordmark ? 'translate-x-5' : ''}`} />
            </span>
            Wordmark
          </button>
          <button
            type="button"
            onClick={upload}
            disabled={uploading || files.length === 0}
            className="inline-flex items-center h-[50px] px-8 rounded-full bg-[#1a2030] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {files.length > 0 && (
          <ul className="mt-4 space-y-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-3">
                <span className="w-[200px] shrink-0 text-sm text-[#555] truncate" title={f.name}>{f.name}</span>
                <input
                  type="text"
                  value={descriptions[i] ?? ''}
                  maxLength={500}
                  onChange={(e) => setDescriptions((prev) => prev.map((d, idx) => (idx === i ? e.target.value : d)))}
                  placeholder="Description"
                  aria-label={`Description for ${f.name}`}
                  className="flex-1 bg-white/60 rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 border border-[#D0D0D0] transition-all"
                />
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-[#e05252] mt-3">{error}</p>}
        {notice && <p className="text-sm text-[#888] mt-3">{notice}</p>}
      </div>

      {/* Delivered files by category */}
      {grouped.length === 0 ? (
        <p className="text-sm text-[#AAA]">No deliverables uploaded yet.</p>
      ) : (
        grouped.map((g) => (
          <div key={g.category}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#AAA] mb-3">{g.category}</p>
            <div className="flex flex-wrap gap-3">
              {g.items.map((d) => (
                <FileTile
                  key={d.id}
                  url={`/api/deliverables/${d.id}`}
                  fileName={d.fileName}
                  size={d.size}
                  description={d.description}
                  onOpen={() => onPreview({ url: `/api/deliverables/${d.id}`, fileName: d.fileName, size: d.size, description: d.description })}
                  onDelete={() => remove(d.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
