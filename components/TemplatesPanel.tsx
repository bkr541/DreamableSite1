'use client';

import { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, Edit02Icon, Layout01Icon, MailSend01Icon, PackageDelivered01Icon, Rocket01Icon, Task01Icon, UserCheck01Icon, MessageMultiple01Icon } from '@hugeicons/core-free-icons';
import RecordList from '@/components/RecordList';
import SearchSelect from '@/components/dropdowns/SearchSelect';
import { ModalSectionHeader } from '@/components/ModalParts';
import { useToast } from '@/components/Toast';
import { TEMPLATES, initialValues, type EmailTemplate } from '@/lib/emailTemplates';

// Message Hub → Templates: pick an email template, fill it in with a live preview, and send it.

export interface HubClient { id: string; name: string; email: string }

/** Opens the Blank Message composer straight away, optionally addressed and titled (used by "New email" and "Reply"). */
export interface ComposeStart { to?: string; subject?: string; firstName?: string }

const ICONS: Record<string, typeof Layout01Icon> = {
  welcome: UserCheck01Icon,
  'project-kickoff': Rocket01Icon,
  'order-delivery': PackageDelivered01Icon,
  'project-update': Task01Icon,
  'check-in': MessageMultiple01Icon,
  blank: Layout01Icon,
};

const input = 'w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] transition-all focus:outline-none focus:ring-2 focus:ring-purple-200/50';
const secondaryBtn = 'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#D5D8DE] bg-white px-5 text-sm font-medium text-[#4b5260] transition-colors hover:bg-[#F5F6F8] hover:text-[#1a1a1a]';

export default function TemplatesPanel({ clients, baseUrl, start }: { clients: HubClient[]; baseUrl: string; start?: ComposeStart | null }) {
  const [openId, setOpenId] = useState<string | null>(start ? 'blank' : null);
  const [search, setSearch] = useState('');
  const open = TEMPLATES.find((t) => t.id === openId) ?? null;

  if (open) return <Composer key={open.id} template={open} clients={clients} baseUrl={baseUrl} prefill={open.id === 'blank' ? start ?? null : null} onBack={() => setOpenId(null)} />;

  const q = search.trim().toLowerCase();
  const rows = TEMPLATES.filter((t) => !q || `${t.name} ${t.description} ${t.category} ${t.subject}`.toLowerCase().includes(q));

  return (
    <RecordList<EmailTemplate>
      rows={rows}
      rowKey={(t) => t.id}
      onRowClick={(t) => setOpenId(t.id)}
      search={{ value: search, onChange: setSearch, placeholder: 'Search templates…' }}
      emptyMessage="No templates match your search."
      columns={[
        {
          key: 'template', label: 'Template', width: 'minmax(0,2.4fr)',
          render: (t) => (
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4f6df5]">
                <HugeiconsIcon icon={ICONS[t.id] ?? Layout01Icon} size={18} color="currentColor" strokeWidth={1.6} />
              </span>
              <div className="min-w-0">
                <p className="record-title truncate text-sm font-semibold text-[#1a1a1a]">{t.name}</p>
                <p className="truncate text-xs text-[#666]">{t.description}</p>
              </div>
            </div>
          ),
        },
        { key: 'category', label: 'Category', width: '130px', render: (t) => <span className="rounded-full bg-[#F1F2F5] px-2.5 py-0.5 text-xs font-semibold text-[#5a6275]">{t.category}</span> },
        { key: 'subject', label: 'Default subject', width: 'minmax(0,1.6fr)', render: (t) => <p className="truncate text-[13px] text-[#555]">{t.subject || '—'}</p> },
      ]}
    />
  );
}

function Composer({ template, clients, baseUrl, prefill, onBack }: { template: EmailTemplate; clients: HubClient[]; baseUrl: string; prefill: ComposeStart | null; onBack: () => void }) {
  const toast = useToast();
  const [clientId, setClientId] = useState('');
  const [to, setTo] = useState(prefill?.to ?? '');
  const [subject, setSubject] = useState(prefill?.subject ?? template.subject);
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...initialValues(template, baseUrl), ...(prefill?.firstName ? { firstName: prefill.firstName } : {}) }));
  const [rawHtml, setRawHtml] = useState<string | null>(null); // set while the admin is editing the HTML itself
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);

  const rendered = useMemo(() => template.render(values, baseUrl), [template, values, baseUrl]);
  const html = rawHtml ?? rendered;
  const hasFirst = template.fields.some((f) => f.key === 'firstName');

  function pickClient(id: string) {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setTo(c.email);
    setErrors((e) => ({ ...e, to: '' }));
    if (hasFirst && rawHtml === null) setValues((v) => ({ ...v, firstName: c.name.trim().split(/\s+/)[0] || v.firstName }));
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) next.to = 'Enter a valid email address.';
    if (!subject.trim()) next.subject = 'Enter a subject.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: to.trim(), subject, html, template: template.id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.field) setErrors({ [data.field]: data.error });
        else setFormError(data.error || 'Could not send the email.');
        return;
      }
      toast.success('Email on its way', `${template.name} is being sent to ${to.trim()}.`);
      onBack();
    } catch {
      setFormError('Unable to connect. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="composer-title" className="w-full space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full border border-[#D5D8DE] bg-white py-1.5 pl-2.5 pr-4 text-sm font-medium text-[#4b5260] transition-colors hover:bg-[#F5F6F8] hover:text-[#1a1a1a]">
        <HugeiconsIcon icon={ArrowLeft01Icon} size={16} color="currentColor" strokeWidth={2} />
        Back to templates
      </button>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#E2E4EA] bg-white p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4f6df5]">
          <HugeiconsIcon icon={ICONS[template.id] ?? Layout01Icon} size={24} color="currentColor" strokeWidth={1.6} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="composer-title" className="text-xl font-semibold tracking-tight text-[#1a1a1a]">{template.name}</h2>
          <p className="text-sm text-[#666]">{template.description}</p>
        </div>
      </div>

      <form onSubmit={send} noValidate className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-6 rounded-2xl border border-[#E2E4EA] bg-white p-5">
          <div className="space-y-4">
            <ModalSectionHeader icon={MailSend01Icon}>Recipient</ModalSectionHeader>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#555]">Client</label>
              <SearchSelect label="Client" placeholder="Search clients…" value={clientId} onChange={pickClient} options={clients.map((c) => ({ value: c.id, label: c.name, description: c.email }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="msg-to" className="text-sm font-medium text-[#555]">To <span className="text-red-400">*</span></label>
              <input id="msg-to" type="text" inputMode="email" autoComplete="off" value={to} onChange={(e) => { setTo(e.target.value); setErrors((x) => ({ ...x, to: '' })); }} placeholder="name@example.com" aria-invalid={!!errors.to} className={`${input} ${errors.to ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`} />
              {errors.to && <p role="alert" className="text-xs text-[#e05252]">{errors.to}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="msg-subject" className="text-sm font-medium text-[#555]">Subject <span className="text-red-400">*</span></label>
              <input id="msg-subject" type="text" value={subject} onChange={(e) => { setSubject(e.target.value); setErrors((x) => ({ ...x, subject: '' })); }} aria-invalid={!!errors.subject} className={`${input} ${errors.subject ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`} />
              {errors.subject && <p role="alert" className="text-xs text-[#e05252]">{errors.subject}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <ModalSectionHeader icon={Edit02Icon}>Message</ModalSectionHeader>
            {rawHtml === null ? (
              template.fields.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <label htmlFor={`msg-${f.key}`} className="text-sm font-medium text-[#555]">{f.label}</label>
                  {f.kind === 'textarea' ? (
                    <textarea id={`msg-${f.key}`} rows={6} value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} className={`${input} resize-y border-[#D0D0D0]`} />
                  ) : (
                    <input id={`msg-${f.key}`} type="text" value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} className={`${input} border-[#D0D0D0]`} />
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="msg-html" className="text-sm font-medium text-[#555]">Email HTML</label>
                <textarea id="msg-html" rows={18} spellCheck={false} value={rawHtml} onChange={(e) => { setRawHtml(e.target.value); setErrors((x) => ({ ...x, html: '' })); }} className={`${input} resize-y border-[#D0D0D0] font-mono text-xs leading-relaxed`} />
                {errors.html && <p role="alert" className="text-xs text-[#e05252]">{errors.html}</p>}
              </div>
            )}
            {rawHtml === null ? (
              <button type="button" onClick={() => setRawHtml(rendered)} className="text-sm font-medium text-[#4f6df5] hover:underline">Edit the HTML directly</button>
            ) : (
              <button type="button" onClick={() => setRawHtml(null)} className="text-sm font-medium text-[#4f6df5] hover:underline">Discard HTML edits and go back to the fields</button>
            )}
          </div>

          {formError && <p role="alert" className="text-sm text-[#e05252]">{formError}</p>}

          <div className="flex items-center justify-end gap-3 border-t border-[#EDEEF2] pt-5">
            <button type="button" onClick={onBack} disabled={sending} className={secondaryBtn}>Cancel</button>
            <button type="submit" disabled={sending} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1a2030] px-6 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
              <HugeiconsIcon icon={MailSend01Icon} size={17} color="currentColor" strokeWidth={1.75} />
              {sending ? 'Sending…' : 'Send email'}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#E2E4EA] bg-white xl:sticky xl:top-4 xl:self-start">
          <div className="border-b border-[#EDEEF2] px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#7a869f]">Preview</p>
            <p className="truncate text-sm font-semibold text-[#1a1a1a]">{subject || '(no subject)'}</p>
          </div>
          <iframe title="Email preview" sandbox="" srcDoc={html} className="h-[640px] w-full border-0 bg-[#f4f5f9]" referrerPolicy="no-referrer" />
        </div>
      </form>
    </section>
  );
}
