import { readFileSync } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, allKeys, cookieFor, setSecrets } from './helpers';
import { CLIENT_A, CLIENT_B, CO_A, makeInvoiceDb } from './invoiceDb';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { GET } from '@/app/api/invoices/[id]/route';
import { customerInvoiceWhere, toInvoiceView, totalsFor } from '@/lib/invoiceService';
import { computeTotals, formatCents } from '@/lib/money';

const ID = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const get = (id: string, cookie: string | null) =>
  GET(new NextRequest('http://localhost/x', { headers: cookie ? { cookie } : {} }) as never, { params: Promise.resolve({ id }) });
const asClient = (id: string) => cookieFor({ userId: id, admin: false });

function invoice(n: number, over: Record<string, unknown> = {}) {
  h.db.invoice.rows.push({
    id: ID(n), invoiceNumber: `DS-2026-00${n}`, numberConflict: false, issueDate: '2026-03-01', dueDate: '2026-03-31', clientUserId: CLIENT_A, companyId: CO_A, projectId: null,
    clientName: 'Alice A', clientEmail: 'alice@a.co', clientCompany: 'Company A', projectName: 'Alpha', taxRate: '0.082500', status: 'Not Paid', createdAt: new Date(),
    lineItems: [{ id: 'l', description: 'Design', qty: '1.5000', rate: '33.3330' }, { id: 'm', description: 'Build', qty: '3.0000', rate: '0.1000' }], ...over,
  });
}

beforeEach(() => {
  setSecrets();
  h.db = makeInvoiceDb();
  invoice(1);                                                    // Alice's issued invoice
  invoice(2, { status: 'Paid' });                                // Alice's paid invoice
  invoice(3, { status: 'Unsent' });                              // Alice's DRAFT
  invoice(4, { clientUserId: CLIENT_B, companyId: 'c2', clientName: 'Bob B' });   // Bob's
  invoice(5, { clientUserId: null, companyId: CO_A });          // unlinked legacy invoice that merely names Alice's company
});

describe('a customer can read only their own issued invoices', () => {
  it.each([1, 2])('their own invoice %i: data and exact totals', async (n) => {
    const res = await get(ID(n), asClient(CLIENT_A));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoice.invoiceNumber).toBe(`DS-2026-00${n}`);
    expect(body.invoice.lineItems).toEqual([{ description: 'Design', qty: '1.5000', rate: '33.3330' }, { description: 'Build', qty: '3.0000', rate: '0.1000' }]);
    // 1.5 × 33.333 = 49.9995 → 50.00 ; 3 × 0.1 = 0.30 ; subtotal 50.30 ; tax 8.25% = 4.15 ; total 54.45
    expect(body.totals).toMatchObject({ subtotal: '50.30', tax: '4.15', total: '54.45' });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it("another customer's invoice is simply not found, with no data in the answer", async () => {
    const res = await get(ID(4), asClient(CLIENT_A));
    expect(res.status).toBe(404);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('Bob');
    expect(text).not.toContain('DS-2026-004');
    expect((await get(ID(1), asClient(CLIENT_B))).status).toBe(404);          // and the other way round
  });

  it('drafts are internal: an Unsent invoice is not found for its own client', async () => {
    expect((await get(ID(3), asClient(CLIENT_A))).status).toBe(404);
  });

  it('an invoice that is not linked to the account is not found, even if it names the customer’s company', async () => {
    expect((await get(ID(5), asClient(CLIENT_A))).status).toBe(404);
  });

  it('guessing: unknown ids, malformed ids', async () => {
    expect((await get('99999999-9999-4999-8999-999999999999', asClient(CLIENT_A))).status).toBe(404);
    expect((await get('1', asClient(CLIENT_A))).status).toBe(404);
    expect((await get("' OR 1=1 --", asClient(CLIENT_A))).status).toBe(404);
  });

  it('requires sign-in', async () => {
    expect((await get(ID(1), null)).status).toBe(401);
  });

  it('a suspended customer, or one whose session was revoked, gets nothing', async () => {
    h.db.user.rows.find((u: any) => u.id === CLIENT_A).status = 'SUSPENDED';
    expect((await get(ID(1), asClient(CLIENT_A))).status).toBe(401);
  });

  it('staff can open any invoice (to preview), including drafts and unlinked ones', async () => {
    const admin = cookieFor({ userId: ADMIN_ID, admin: true });
    for (const n of [1, 3, 4, 5]) expect((await get(ID(n), admin)).status).toBe(200);
  });
});

describe('the rule for what a customer sees is one shared definition', () => {
  it('only the account’s own, issued invoices', () => {
    expect(customerInvoiceWhere('u1')).toEqual({ clientUserId: 'u1', status: { in: ['Not Paid', 'Paid'] } });
  });
  it('the dashboard page and the PDF endpoint both use it', () => {
    const root = path.resolve(__dirname, '..');
    for (const f of ['app/(dashboard)/dashboard/page.tsx', 'app/api/invoices/[id]/route.ts']) {
      expect(readFileSync(path.join(root, f), 'utf8'), f).toMatch(/customerInvoiceWhere\(/);
    }
  });
});

describe('totals agree everywhere', () => {
  it('server view, shared calculator and the API response give the same cents', async () => {
    const row = h.db.invoice.rows[0];
    const view = toInvoiceView(row);
    const t = computeTotals(view.lineItems, view.taxRate)!;
    expect(totalsFor(view)).toMatchObject({ subtotal: formatCents(t.subtotal), tax: formatCents(t.tax), total: formatCents(t.total) });
    expect((await (await get(row.id, asClient(CLIENT_A))).json()).totals.total).toBe(formatCents(t.total));
  });
  it('Decimal-like values from the database never become floating-point numbers in the view', () => {
    const view = toInvoiceView({ ...h.db.invoice.rows[0], taxRate: { toFixed: () => '0.0825' }, lineItems: [{ description: 'x', qty: { toFixed: () => '1.5' }, rate: { toFixed: () => '33.333' } }] });
    expect(view.taxRate).toBe('0.082500');
    expect(view.lineItems[0]).toEqual({ description: 'x', qty: '1.5000', rate: '33.3330' });
  });
});

describe('billing is read-only: nothing here can take a payment', () => {
  const root = path.resolve(__dirname, '..');
  const customerFiles = ['components/InvoicesPanel.tsx', 'app/api/invoices/[id]/route.ts', 'app/(dashboard)/dashboard/page.tsx', 'app/(dashboard)/dashboard/CustomerDashboardClient.tsx'];

  it('the customer billing code has no checkout, payment-provider or pay-now behaviour', () => {
    for (const f of customerFiles) {
      // Comments may *say* there is no checkout; the code must not contain one.
      const src = readFileSync(path.join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').toLowerCase();
      for (const word of ['stripe', 'paypal', 'checkout', 'pay now', 'payment_intent', 'credit card', 'braintree', 'square', 'paymentmethod']) {
        expect(src, `${f} mentions "${word}"`).not.toContain(word);
      }
    }
  });
  it('the invoice API exposes no payment fields, and no write method', async () => {
    const res = await get(ID(1), asClient(CLIENT_A));
    const keys = [...allKeys(await res.json())].join(' ').toLowerCase();
    expect(keys).not.toMatch(/payment|checkout|card|intent|secret/);
    const route = await import('@/app/api/invoices/[id]/route');
    expect(Object.keys(route).sort()).toEqual(['GET']);
  });
  it('the panel offers only View and Download', () => {
    const src = readFileSync(path.join(root, 'components/InvoicesPanel.tsx'), 'utf8');
    const labels = [...src.matchAll(/>\s*\{?(?:busy[^}]*\?[^:]*:\s*)?'?([A-Za-z ]+?)'?\}?\s*<\/button>/g)].map((m) => m[1].trim());
    expect(src).toMatch(/Download PDF/);
    expect(src).toMatch(/View/);
    expect(labels.join(' ').toLowerCase()).not.toMatch(/pay|checkout|card/);
  });
});
