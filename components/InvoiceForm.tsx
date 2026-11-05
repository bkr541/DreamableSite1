'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { CancelCircleIcon, Invoice03Icon } from '@hugeicons/core-free-icons';
import Dropdown from '@/components/dropdowns/Dropdown';
import { statusOptions } from '@/components/dropdowns/options';
import DatePicker from '@/components/DatePicker';
import { INVOICE_STATUSES, canTransition, contentIsLocked, numberIsLocked } from '@/lib/invoiceRules';
import { computeTotals, formatMoney, percentToFraction, taxPercentLabel, trimDecimal } from '@/lib/money';

// The create and edit dialogs share this form. It suggests and shows; the SERVER decides what is valid (see
// lib/invoiceValidation.ts) and its messages are displayed next to the field they belong to.

export interface InvoiceFormState {
  invoiceNumber: string;
  /** true while the number is the untouched suggestion: the server then assigns the next free number itself. */
  autoNumber: boolean;
  issueDate: string;
  dueDate: string;
  clientUserId: string;
  projectId: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  projectName: string;
  /** Typed as a percent ("8.25"); sent as a fraction. */
  taxPercent: string;
  status: string;
  lineItems: { description: string; qty: string; rate: string }[];
}

export interface ClientOption { id: string; name: string; email: string; companyId: string | null; companyName: string | null }
export interface ProjectOption { id: string; name: string; companyId: string | null; primaryUserId: string | null }

export function emptyInvoiceForm(): InvoiceFormState {
  const now = new Date();
  const due = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString().split('T')[0];
  return {
    invoiceNumber: '', autoNumber: true, issueDate: iso(now), dueDate: iso(due),
    clientUserId: '', projectId: '', clientName: '', clientEmail: '', clientCompany: '', projectName: '',
    taxPercent: '0', status: 'Unsent', lineItems: [{ description: '', qty: '1', rate: '' }],
  };
}

export interface StoredInvoice {
  invoiceNumber: string; issueDate: string; dueDate: string; clientName: string; clientEmail: string; clientCompany: string | null;
  projectName: string; taxRate: string; status: string; clientUserId: string | null; projectId: string | null;
  lineItems: { description: string; qty: string; rate: string }[];
}

export function formFromInvoice(inv: StoredInvoice): InvoiceFormState {
  return {
    invoiceNumber: inv.invoiceNumber, autoNumber: false, issueDate: inv.issueDate, dueDate: inv.dueDate,
    clientUserId: inv.clientUserId ?? '', projectId: inv.projectId ?? '',
    clientName: inv.clientName, clientEmail: inv.clientEmail, clientCompany: inv.clientCompany ?? '', projectName: inv.projectName,
    taxPercent: taxPercentLabel(inv.taxRate), status: inv.status,
    lineItems: inv.lineItems.map((l) => ({ description: l.description, qty: trimDecimal(l.qty), rate: trimDecimal(l.rate) })),
  };
}

/** What is sent to the API. Amounts stay text, so nothing passes through floating point. */
export function invoicePayload(f: InvoiceFormState) {
  return {
    invoiceNumber: f.autoNumber ? '' : f.invoiceNumber.trim(), autoNumber: f.autoNumber,
    issueDate: f.issueDate, dueDate: f.dueDate, clientUserId: f.clientUserId || null, projectId: f.projectId || null,
    clientName: f.clientName.trim(), clientEmail: f.clientEmail.trim(), clientCompany: f.clientCompany.trim(), projectName: f.projectName.trim(),
    taxRate: percentToFraction(f.taxPercent.trim()) ?? f.taxPercent, status: f.status,
    lineItems: f.lineItems.map((l) => ({ description: l.description.trim(), qty: l.qty.trim(), rate: l.rate.trim() })),
  };
}

const input = 'w-full bg-white rounded-xl px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#bbb] border focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all disabled:bg-[#F6F7FB] disabled:text-[#777]';
const border = (bad: boolean) => (bad ? 'border-[#e05252]' : 'border-[#D0D0D0]');
const label = 'text-sm font-medium text-[#555]';
const section = 'text-[10px] font-semibold uppercase tracking-widest text-[#AAA]';

interface Props {
  title: string;
  mode: 'create' | 'edit';
  form: InvoiceFormState;
  setForm: React.Dispatch<React.SetStateAction<InvoiceFormState>>;
  clients: ClientOption[];
  projects: ProjectOption[];
  errors: Record<string, string>;
  clearError: () => void;
  formError: string;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  /** Edit mode only: what the stored invoice looks like now, which decides what may still be changed. */
  original?: { status: string; numberConflict: boolean; linked: boolean };
}

export default function InvoiceForm({ title, mode, form, setForm, clients, projects, errors, clearError, formError, submitting, submitLabel, onSubmit, onCancel, original }: Props) {
  const edit = mode === 'edit' && !!original;
  const closed = edit && contentIsLocked(original!.status);                                        // Paid: only the status may change
  const numberLocked = edit && numberIsLocked(original!.status) && !original!.numberConflict;
  const client = clients.find((c) => c.id === form.clientUserId) ?? null;
  const clientProjects = projects.filter((p) => client && (p.primaryUserId === client.id || (client.companyId && p.companyId === client.companyId)));

  const set = <K extends keyof InvoiceFormState>(key: K, value: InvoiceFormState[K]) => { setForm((f) => ({ ...f, [key]: value })); clearError(); };
  const setLine = (i: number, patch: Partial<InvoiceFormState['lineItems'][number]>) => {
    setForm((f) => ({ ...f, lineItems: f.lineItems.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
    clearError();
  };

  function chooseClient(id: string) {
    const c = clients.find((x) => x.id === id);
    setForm((f) => ({
      ...f, clientUserId: id, projectId: '',
      ...(c ? { clientName: c.name, clientEmail: c.email, clientCompany: c.companyName ?? '' } : {}),
    }));
    clearError();
  }
  function chooseProject(id: string) {
    const p = projects.find((x) => x.id === id);
    setForm((f) => ({ ...f, projectId: id, ...(p ? { projectName: p.name } : {}) }));
    clearError();
  }

  // The preview uses the same exact arithmetic as the server and the PDF.
  const tax = percentToFraction(form.taxPercent.trim());
  const totals = tax === null ? null : computeTotals(form.lineItems.map((l) => ({ qty: l.qty.trim(), rate: l.rate.trim() || '0' })), tax);

  const statusChoices = INVOICE_STATUSES.filter((s) => !edit || canTransition(original!.status, s));
  const err = (k: string) => errors[k];
  const fieldMsg = (k: string) => (err(k) ? <p className="text-xs text-[#e05252]">{err(k)}</p> : null);

  return (
    <form onSubmit={onSubmit} className="p-8 space-y-5" noValidate>
      <div className="flex items-center gap-3">
        <HugeiconsIcon icon={Invoice03Icon} size={28} color="#1a2030" strokeWidth={2} />
        <p className="text-xl font-semibold text-[#1a1a1a]">{title}</p>
      </div>

      {edit && original!.numberConflict && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#7a5200]" role="alert">
          This invoice number is shared with another invoice (found when numbers were made unique). Enter a new, unused number below — nothing was renumbered automatically.
        </p>
      )}
      {edit && !original!.linked && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#7a5200]" role="status">
          This older invoice isn’t linked to a client account, so the client can’t see it. Choose the client below to link it.
        </p>
      )}
      {closed && (
        <p className="rounded-xl bg-[#F6F7FB] px-4 py-3 text-sm text-[#555]" role="status">
          This invoice is Paid, so it is closed. To change anything, set the status back to Not Paid first and save, then edit it.
        </p>
      )}

      <div className="space-y-3">
        <p className={section}>Invoice Details</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="inv-number" className={label}>Invoice #</label>
            <input
              id="inv-number" value={form.invoiceNumber} disabled={(closed && !original!.numberConflict) || numberLocked}
              onChange={(e) => { setForm((f) => ({ ...f, invoiceNumber: e.target.value, autoNumber: false })); clearError(); }}
              placeholder={mode === 'create' ? 'Assigned when saved' : 'DS-2026-001'}
              className={`${input} ${border(!!err('invoiceNumber'))}`}
            />
            {fieldMsg('invoiceNumber')}
            {mode === 'create' && form.autoNumber && !err('invoiceNumber') && <p className="text-xs text-[#999]">Suggested — the final number is assigned when you save.</p>}
            {numberLocked && <p className="text-xs text-[#999]">An issued invoice keeps its number.</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={label}>Issue Date <span className="text-red-400">*</span></label>
            <DatePicker value={form.issueDate} onChange={(v) => set('issueDate', v)} invalid={!!err('issueDate')} />
            {fieldMsg('issueDate')}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={label}>Due Date <span className="text-red-400">*</span></label>
            <DatePicker value={form.dueDate} onChange={(v) => set('dueDate', v)} invalid={!!err('dueDate')} />
            {fieldMsg('dueDate')}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className={section}>Client</p>
        <div className="flex flex-col gap-1.5">
          <label className={label}>Client account <span className="text-red-400">*</span></label>
          <Dropdown
            label="Client" value={form.clientUserId} onChange={chooseClient} width="w-full" disabled={closed} invalid={!!err('clientUserId')}
            options={[{ value: '', label: 'Select a client…' }, ...clients.map((c) => ({ value: c.id, label: `${c.name} — ${c.email}` }))]}
          />
          {fieldMsg('clientUserId')}
          <p className="text-xs text-[#999]">The client sees this invoice in their portal once it is issued (Not Paid or Paid). The details below are what is printed on it.</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="inv-client-name" className={label}>Billed to <span className="text-red-400">*</span></label>
            <input id="inv-client-name" value={form.clientName} disabled={closed} onChange={(e) => set('clientName', e.target.value)} placeholder="Jane Smith" className={`${input} ${border(!!err('clientName'))}`} />
            {fieldMsg('clientName')}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="inv-client-email" className={label}>Email <span className="text-red-400">*</span></label>
            <input id="inv-client-email" value={form.clientEmail} disabled={closed} onChange={(e) => set('clientEmail', e.target.value)} placeholder="jane@example.com" className={`${input} ${border(!!err('clientEmail'))}`} />
            {fieldMsg('clientEmail')}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="inv-client-company" className={label}>Company</label>
            <input id="inv-client-company" value={form.clientCompany} disabled={closed} onChange={(e) => set('clientCompany', e.target.value)} placeholder="Acme Inc." className={`${input} ${border(false)}`} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className={section}>Project</p>
        <div className="grid grid-cols-[1fr_1fr_110px_130px] gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={label}>Linked project</label>
            <Dropdown
              label="Project" value={form.projectId} onChange={chooseProject} width="w-full" disabled={closed || !client} invalid={!!err('projectId')}
              options={[{ value: '', label: client ? 'No linked project' : 'Choose a client first' }, ...clientProjects.map((p) => ({ value: p.id, label: p.name }))]}
            />
            {fieldMsg('projectId')}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="inv-project-name" className={label}>Project name <span className="text-red-400">*</span></label>
            <input id="inv-project-name" value={form.projectName} disabled={closed} onChange={(e) => set('projectName', e.target.value)} placeholder="Brand Identity & Website" className={`${input} ${border(!!err('projectName'))}`} />
            {fieldMsg('projectName')}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="inv-tax" className={label}>Tax (%)</label>
            <input id="inv-tax" inputMode="decimal" value={form.taxPercent} disabled={closed} onChange={(e) => set('taxPercent', e.target.value)} placeholder="0" className={`${input} ${border(!!err('taxRate'))}`} />
            {fieldMsg('taxRate')}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={label}>Status</label>
            <Dropdown
              label="Status" value={form.status} onChange={(v) => set('status', v)} width="w-full" invalid={!!err('status')}
              options={statusOptions(statusChoices.map((s) => ({ value: s, label: s })))}
            />
            {fieldMsg('status')}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className={section}>Line Items</p>
        <div className="grid grid-cols-[1fr_84px_110px_96px_36px] gap-3 px-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#CCC]">Description</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#CCC] text-center">Qty</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#CCC] text-right">Rate ($)</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#CCC] text-right">Amount</p>
          <div />
        </div>
        <div className="space-y-2">
          {form.lineItems.map((item, i) => (
            <div key={i}>
              <div className="grid grid-cols-[1fr_84px_110px_96px_36px] gap-3 items-center">
                <input value={item.description} disabled={closed} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Service description" aria-label={`Line ${i + 1} description`} className={`${input} !px-3 !py-2 ${border(!!err(`lineItems.${i}.description`))}`} />
                <input value={item.qty} disabled={closed} inputMode="decimal" onChange={(e) => setLine(i, { qty: e.target.value })} aria-label={`Line ${i + 1} quantity`} className={`${input} !px-3 !py-2 text-center ${border(!!err(`lineItems.${i}.qty`))}`} />
                <input value={item.rate} disabled={closed} inputMode="decimal" onChange={(e) => setLine(i, { rate: e.target.value })} placeholder="0.00" aria-label={`Line ${i + 1} rate`} className={`${input} !px-3 !py-2 text-right ${border(!!err(`lineItems.${i}.rate`))}`} />
                <p className="text-right text-sm text-[#555]">{totals ? formatMoney(totals.lineTotals[i]) : '—'}</p>
                <button
                  type="button" disabled={closed || form.lineItems.length === 1} aria-label={`Remove line ${i + 1}`}
                  onClick={() => { setForm((f) => ({ ...f, lineItems: f.lineItems.filter((_, idx) => idx !== i) })); clearError(); }}
                  className="flex items-center justify-center text-[#CCCCCC] hover:text-[#e05252] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <HugeiconsIcon icon={CancelCircleIcon} size={18} color="currentColor" strokeWidth={1.5} />
                </button>
              </div>
              {(err(`lineItems.${i}.description`) || err(`lineItems.${i}.qty`) || err(`lineItems.${i}.rate`)) && (
                <p className="mt-1 text-xs text-[#e05252]">{err(`lineItems.${i}.description`) || err(`lineItems.${i}.qty`) || err(`lineItems.${i}.rate`)}</p>
              )}
            </div>
          ))}
        </div>
        {fieldMsg('lineItems')}
        {form.lineItems.length < 100 && (
          <button type="button" disabled={closed} onClick={() => { setForm((f) => ({ ...f, lineItems: [...f.lineItems, { description: '', qty: '1', rate: '' }] })); clearError(); }} className="text-sm text-[#AAAAAA] hover:text-[#1a2030] transition-colors disabled:opacity-40">
            + Add Line Item
          </button>
        )}

        <dl className="ml-auto w-full max-w-[260px] space-y-1 pt-2 text-sm">
          <div className="flex justify-between text-[#777]"><dt>Subtotal</dt><dd>{totals ? formatMoney(totals.subtotal) : '—'}</dd></div>
          <div className="flex justify-between text-[#777]"><dt>Tax ({tax === null ? '—' : taxPercentLabel(tax)}%)</dt><dd>{totals ? formatMoney(totals.tax) : '—'}</dd></div>
          <div className="flex justify-between border-t border-[#EEE] pt-1.5 font-semibold text-[#1a1a1a]"><dt>Total</dt><dd>{totals ? formatMoney(totals.total) : '—'}</dd></div>
        </dl>
      </div>

      {formError && <p className="text-sm text-[#e05252]" role="alert">{formError}</p>}

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onCancel} className="text-sm text-[#AAAAAA] hover:text-[#000] transition-colors">Cancel</button>
        <button type="submit" disabled={submitting} className="px-8 py-3 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
