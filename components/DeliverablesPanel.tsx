'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FileTile from '@/components/FileTile';
import { PreviewFile } from '@/components/FilePreviewModal';
import { getDeliverableCategories } from '@/lib/deliverables';

export interface DeliverableRecord {
  id: string;
  inquiryId: string | null;
  projectId: string | null;
  category: string;
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
  const [inputKey, setInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const items = deliverables.filter((d) => (targetType === 'inquiry' ? d.inquiryId === targetId : d.projectId === targetId));
  const shown = [...categories, ...Array.from(new Set(items.map((d) => d.category))).filter((c) => !categories.includes(c))];
  const grouped = shown
    .map((c) => ({ category: c, items: items.filter((d) => d.category === c) }))
    .filter((g) => g.items.length > 0);

  async function upload() {
    if (files.length === 0) { setError('Choose at least one file.'); return; }
    setUploading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('targetType', targetType);
      body.append('targetId', targetId);
      body.append('category', category);
      files.forEach((f) => body.append('files', f));
      const res = await fetch('/api/admin/deliverables', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed.');
      setFiles([]);
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
    <div className="space-y-6">
      {/* Upload */}
      <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Deliverable category"
            className="bg-white border border-[#EBEBEB] rounded-xl px-3 py-2 text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all"
          >
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="inline-flex items-center h-9 px-4 rounded-full border border-[#1a2030] text-[#1a2030] text-sm font-medium cursor-pointer hover:bg-[#1a2030] hover:text-white transition-all">
            Choose files
            <input
              key={inputKey}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setError(''); }}
            />
          </label>
          <span className="text-sm text-[#888] truncate max-w-[260px]">
            {files.length === 0 ? 'No files selected' : files.length === 1 ? files[0].name : `${files.length} files selected`}
          </span>
          <button
            type="button"
            onClick={upload}
            disabled={uploading || files.length === 0}
            className="ml-auto inline-flex items-center h-9 px-5 rounded-full bg-[#1a2030] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {error && <p className="text-sm text-[#e05252] mt-3">{error}</p>}
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
                  onOpen={() => onPreview({ url: `/api/deliverables/${d.id}`, fileName: d.fileName, size: d.size })}
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
