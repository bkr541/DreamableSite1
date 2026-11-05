'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Invoice03Icon } from '@hugeicons/core-free-icons';

export interface CustomerInvoice {
  id: string;
  invoiceNumber: string;
  projectName: string;
  issueDate: string;
  dueDate: string;
  /** Set by staff. Customers only ever see issued invoices ("Not Paid" or "Paid"). */
  status: string;
  /** Formatted by the server from the exact calculation, e.g. "1,234.50". */
  total: string | null;
  pastDue: boolean;
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return y ? new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : iso;
};

/**
 * The customer's own invoices: look and download, nothing else. There is deliberately no way to pay here — no button,
 * no payment provider, no checkout; the status is whatever the studio has recorded.
 */
export default function InvoicesPanel({ invoices }: { invoices: CustomerInvoice[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  async function open(inv: CustomerInvoice, mode: 'download' | 'view') {
    if (busy) return;
    setBusy(inv.id + mode);
    setError(null);
    try {
      // The data comes from an endpoint that only answers for this signed-in customer's own invoices.
      const res = await fetch(`/api/invoices/${inv.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(res.status === 404 ? 'This invoice is no longer available.' : 'We couldn’t load this invoice.');
      const { generateInvoicePDF, previewInvoicePDF, formatInvoiceDate } = await import('@/lib/generateInvoice');
      const i = data.invoice;
      const pdf = {
        invoiceNumber: i.invoiceNumber, issueDate: formatInvoiceDate(i.issueDate), dueDate: formatInvoiceDate(i.dueDate),
        clientName: i.clientName, clientEmail: i.clientEmail, clientCompany: i.clientCompany ?? '', projectName: i.projectName,
        taxRate: i.taxRate, lineItems: i.lineItems,
      };
      if (mode === 'download') await generateInvoicePDF(pdf);
      else window.open(await previewInvoicePDF(pdf), '_blank', 'noopener');
    } catch (err) {
      setError({ id: inv.id, message: err instanceof Error ? err.message : 'We couldn’t create the PDF. Please try again.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-10 bg-white rounded-2xl border border-[#EBEBEB]" aria-labelledby="invoices-heading">
      <div className="flex items-center gap-3 p-6 pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4f6df5]">
          <HugeiconsIcon icon={Invoice03Icon} size={20} color="currentColor" strokeWidth={1.5} />
        </span>
        <div>
          <h2 id="invoices-heading" className="text-sm font-semibold text-[#1a1a1a]">Invoices</h2>
          <p className="text-sm text-[#888]">Your billing history. Download a PDF of any invoice.</p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <p className="px-6 pb-8 pt-2 text-sm text-[#888]">No invoices yet. When one is issued for your work, it will appear here.</p>
      ) : (
        <ul className="divide-y divide-[#F0F0F0] border-t border-[#F0F0F0]">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="min-w-0 sm:flex-1">
                <p className="text-sm font-semibold text-[#1a1a1a]">{inv.invoiceNumber}</p>
                <p className="truncate text-xs text-[#888]">{inv.projectName}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:flex sm:gap-8">
                <div><dt className="text-[#BBB]">Issued</dt><dd className="text-[#555]">{fmtDate(inv.issueDate)}</dd></div>
                <div><dt className="text-[#BBB]">Due</dt><dd className="text-[#555]">{fmtDate(inv.dueDate)}</dd></div>
                <div><dt className="text-[#BBB]">Amount</dt><dd className="text-sm font-semibold text-[#1a1a1a]">{inv.total ? `$${inv.total}` : '—'}</dd></div>
                <div>
                  <dt className="text-[#BBB]">Status</dt>
                  <dd className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${inv.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{inv.status}</span>
                    {inv.pastDue && <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">Past due</span>}
                  </dd>
                </div>
              </dl>
              <div className="flex gap-2 sm:shrink-0">
                <button
                  type="button" onClick={() => open(inv, 'view')} disabled={!!busy}
                  className="inline-flex h-9 items-center rounded-full border border-[#D0D0D0] px-4 text-xs font-semibold text-[#555] transition-colors hover:bg-[#F5F5F5] disabled:opacity-50"
                  aria-label={`View invoice ${inv.invoiceNumber}`}
                >
                  {busy === inv.id + 'view' ? 'Opening…' : 'View'}
                </button>
                <button
                  type="button" onClick={() => open(inv, 'download')} disabled={!!busy}
                  className="inline-flex h-9 items-center rounded-full bg-[#1a2030] px-4 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
                  aria-label={`Download invoice ${inv.invoiceNumber} as PDF`}
                >
                  {busy === inv.id + 'download' ? 'Preparing…' : 'Download PDF'}
                </button>
              </div>
              {error?.id === inv.id && <p role="alert" className="text-xs text-[#e05252] sm:basis-full">{error.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
