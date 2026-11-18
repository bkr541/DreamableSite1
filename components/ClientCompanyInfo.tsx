'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Building03Icon } from '@hugeicons/core-free-icons';
import { ModalSectionHeader } from '@/components/ModalParts';
import { useToast } from '@/components/Toast';
import { normalizeWebsite } from '@/lib/companyWebsite';

/**
 * The "Company Information" group on a client (shown when their row is expanded in the Clients list): the company's name
 * and its website, which an admin can set or change here. The website is no longer asked for when adding a client.
 */
export default function ClientCompanyInfo({ company, onSaved }: { company: { id: string; name: string; website: string | null } | null; onSaved: () => void }) {
  const toast = useToast();
  const saved = company?.website ?? '';
  const [value, setValue] = useState(saved);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!company) {
    return (
      <div className="mx-6 mb-4 rounded-xl border border-[#E4E8F3] bg-white p-5">
        <ModalSectionHeader icon={Building03Icon}>Company Information</ModalSectionHeader>
        <p className="mt-3 text-sm text-[#888]">No company on file for this client.</p>
      </div>
    );
  }

  const dirty = value.trim() !== saved;
  const inputId = `company-website-${company.id}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const check = normalizeWebsite(value);
    if (!check.ok) { setError(check.error); return; }
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/companies/${company!.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ website: check.value }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setError(data.error || 'Could not save the website.'); return; }
      toast.success(check.value ? 'Website saved' : 'Website removed', company!.name);
      onSaved();
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="mx-6 mb-4 rounded-xl border border-[#E4E8F3] bg-white p-5">
      <ModalSectionHeader icon={Building03Icon}>Company Information</ModalSectionHeader>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[#555]">Company</span>
          <p className="rounded-xl bg-[#F6F7FB] px-4 py-2.5 text-sm text-[#555]">{company.name}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-sm font-medium text-[#555]">Website</label>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <input
                id={inputId}
                type="text"
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(''); }}
                placeholder="https://acme.com"
                aria-invalid={!!error}
                aria-describedby={error ? `${inputId}-error` : undefined}
                className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] transition-all focus:outline-none focus:ring-2 focus:ring-purple-200/50 ${error ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`}
              />
              {error && <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs text-[#e05252]">{error}</p>}
            </div>
            <button
              type="submit"
              disabled={!dirty || saving}
              className="inline-flex h-[42px] shrink-0 items-center rounded-full bg-[#1a2030] px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
