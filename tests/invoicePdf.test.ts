import { readFileSync } from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The PDF is built in the browser from exact decimal text. This captures what it would print and checks it against the
// same calculation the server (API) and the admin form use, to the cent.

const captured = vi.hoisted(() => ({ tables: [] as { body: string[][] }[], texts: [] as string[] }));

// A recording stand-in for jsPDF: it accepts every drawing call and remembers each string that would be printed.
vi.mock('jspdf', () => {
  class FakePdf {
    lastAutoTable?: unknown;
    text(t: unknown) { captured.texts.push(Array.isArray(t) ? t.join(' ') : String(t)); return this; }
    output() { return new Blob(['%PDF']); }
    save() {}
    addFileToVFS() {} addFont() {} setFont() {} setFontSize() {} setTextColor() {} addImage() {}
    setDrawColor() {} setLineWidth() {} setFillColor() {} line() {} roundedRect() {}
  }
  return { default: FakePdf };
});
vi.mock('jspdf-autotable', () => ({
  default: (doc: { lastAutoTable?: unknown }, opts: { body: string[][] }) => {
    captured.tables.push({ body: opts.body });
    doc.lastAutoTable = { finalY: 120 };
  },
}));

import { previewInvoicePDF, type InvoiceData } from '@/lib/generateInvoice';
import { computeTotals, formatCents, formatMoney, formatRate, taxPercentLabel } from '@/lib/money';
import { toInvoiceView, totalsFor } from '@/lib/invoiceService';

const pub = (p: string) => readFileSync(path.resolve(__dirname, '../public', p.replace(/^\//, '')));
let texts: string[] = [];

beforeEach(() => {
  captured.tables.length = 0;
  captured.texts.length = 0;
  texts = captured.texts;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(pub(url))));
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:test' }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const sample = (over: Partial<InvoiceData> = {}): InvoiceData => ({
  invoiceNumber: 'DS-2026-042', issueDate: 'March 1, 2026', dueDate: 'March 31, 2026', clientName: 'Alice A', clientEmail: 'alice@a.co', clientCompany: 'Company A', projectName: 'Alpha',
  taxRate: '0.082500',
  lineItems: [
    { description: 'Design (hours)', qty: '1.5000', rate: '33.3330' },
    { description: 'Development', qty: '3.0000', rate: '0.1000' },
    { description: 'Awkward line', qty: '7.2500', rate: '14.2850' },
    { description: 'Large', qty: '120.0000', rate: '1234.5600' },
  ],
  ...over,
});

describe('PDF totals equal the API and the form, to the cent', () => {
  it('table rows, subtotal, tax and total all come from the shared calculation', async () => {
    const data = sample();
    await previewInvoicePDF(data);

    const t = computeTotals(data.lineItems, data.taxRate)!;
    const rows = captured.tables[0].body;
    expect(rows.map((r) => r[3])).toEqual(t.lineTotals.map((c) => formatMoney(c)));          // each line total
    expect(rows.map((r) => r[2])).toEqual(data.lineItems.map((l) => formatRate(l.rate)));     // each unit rate, exactly as stored
    expect(rows.map((r) => r[1])).toEqual(['1.5', '3', '7.25', '120']);                       // fractional quantities kept

    expect(texts).toContain(formatMoney(t.subtotal));
    expect(texts).toContain(formatMoney(t.tax));
    expect(texts).toContain(formatMoney(t.total));
    expect(texts).toContain(`Tax (${taxPercentLabel(data.taxRate)}%)`);
    expect(texts).toContain('#DS-2026-042');
  });

  it('matches what the server reports for the same stored invoice', async () => {
    const stored = toInvoiceView({
      id: 'x', invoiceNumber: 'DS-2026-042', issueDate: '2026-03-01', dueDate: '2026-03-31', clientName: 'Alice A', clientEmail: 'alice@a.co', clientCompany: 'Company A',
      projectName: 'Alpha', status: 'Not Paid', taxRate: { toFixed: () => '0.0825' },
      lineItems: [{ description: 'Design (hours)', qty: { toFixed: () => '1.5' }, rate: { toFixed: () => '33.333' } }, { description: 'Dev', qty: { toFixed: () => '3' }, rate: { toFixed: () => '0.1' } }],
    });
    await previewInvoicePDF({ ...sample(), taxRate: stored.taxRate, lineItems: stored.lineItems });
    const server = totalsFor(stored)!;
    expect(texts).toContain(`$${server.subtotal}`);
    expect(texts).toContain(`$${server.tax}`);
    expect(texts).toContain(`$${server.total}`);
    expect(server.total).toBe('54.45');
  });

  it('the displayed lines always add up to the displayed subtotal', async () => {
    const data = sample({ lineItems: Array.from({ length: 40 }, (_, i) => ({ description: `Line ${i}`, qty: '1.0000', rate: '0.0050' })) });
    await previewInvoicePDF(data);
    const lineCents = captured.tables[0].body.map((r) => BigInt(r[3].replace(/[$,.]/g, '')));
    const sum = lineCents.reduce((a, b) => a + b, BigInt(0));
    const t = computeTotals(data.lineItems, data.taxRate)!;
    expect(sum).toBe(t.subtotal);
    expect(texts).toContain(`$${formatCents(sum)}`);
  });

  it('refuses to produce a PDF from invalid amounts rather than printing nonsense', async () => {
    await expect(previewInvoicePDF(sample({ lineItems: [{ description: 'x', qty: 'abc', rate: '1' }] }))).rejects.toThrow(/not valid/);
    await expect(previewInvoicePDF(sample({ taxRate: '-1' }))).rejects.toThrow(/not valid/);
  });

  it('0.1 + 0.2 prints as exactly $0.30', async () => {
    await previewInvoicePDF(sample({ taxRate: '0', lineItems: [{ description: 'a', qty: '1', rate: '0.1' }, { description: 'b', qty: '1', rate: '0.2' }] }));
    expect(texts).toContain('$0.30');
    expect(texts.some((t) => t.includes('0.30000000000000004'))).toBe(false);
  });
});
