import { describe, expect, it } from 'vitest';
import { parseInvoiceInput, parseIsoDate } from '@/lib/invoiceValidation';
import { canTransition, contentIsLocked, numberIsLocked } from '@/lib/invoiceRules';

const CLIENT = '11111111-1111-4111-8111-111111111111';
const valid = () => ({
  invoiceNumber: '', autoNumber: true, issueDate: '2026-03-01', dueDate: '2026-03-31', clientUserId: CLIENT, projectId: null,
  clientName: 'Jane Smith', clientEmail: 'jane@example.com', clientCompany: 'Acme', projectName: 'Brand',
  taxRate: '0.0825', status: 'Unsent', lineItems: [{ description: 'Design', qty: '1.5', rate: '100.00' }],
});
const errorsFor = (over: Record<string, unknown>, mode: 'create' | 'update' = 'create') => {
  const r = parseInvoiceInput({ ...valid(), ...over }, mode);
  return r.ok ? null : r.errors;
};

describe('a valid invoice', () => {
  it('is accepted and returned as canonical exact text', () => {
    const r = parseInvoiceInput(valid(), 'create');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.taxRate).toBe('0.082500');
      expect(r.data.lineItems).toEqual([{ description: 'Design', qty: '1.5000', rate: '100.0000' }]);
      expect(r.data.invoiceNumber).toBeUndefined();         // blank → the server assigns it
    }
  });
  it('accepts amounts as numbers or text, and zero-rate lines alongside paid ones', () => {
    expect(errorsFor({ lineItems: [{ description: 'A', qty: 2, rate: 10 }, { description: 'Goodwill', qty: '1', rate: '0' }] })).toBeNull();
  });
  it('keeps a typed number for update and for a deliberate manual number', () => {
    const r = parseInvoiceInput({ ...valid(), invoiceNumber: 'DS-2026-050', autoNumber: false }, 'create');
    expect(r.ok && r.data.invoiceNumber).toBe('DS-2026-050');
  });
});

describe('amounts', () => {
  it.each([
    ['negative quantity', { lineItems: [{ description: 'A', qty: '-1', rate: '10' }] }, 'lineItems.0.qty'],
    ['zero quantity', { lineItems: [{ description: 'A', qty: '0', rate: '10' }] }, 'lineItems.0.qty'],
    ['non-numeric quantity', { lineItems: [{ description: 'A', qty: 'lots', rate: '10' }] }, 'lineItems.0.qty'],
    ['NaN quantity', { lineItems: [{ description: 'A', qty: NaN, rate: '10' }] }, 'lineItems.0.qty'],
    ['Infinity quantity', { lineItems: [{ description: 'A', qty: Infinity, rate: '10' }] }, 'lineItems.0.qty'],
    ['quantity with too many decimals', { lineItems: [{ description: 'A', qty: '1.00001', rate: '10' }] }, 'lineItems.0.qty'],
    ['absurd quantity', { lineItems: [{ description: 'A', qty: '1000001', rate: '1' }] }, 'lineItems.0.qty'],
    ['exponent notation', { lineItems: [{ description: 'A', qty: '1e3', rate: '10' }] }, 'lineItems.0.qty'],
    ['negative rate', { lineItems: [{ description: 'A', qty: '1', rate: '-0.01' }] }, 'lineItems.0.rate'],
    ['non-numeric rate', { lineItems: [{ description: 'A', qty: '1', rate: '' }] }, 'lineItems.0.rate'],
    ['Infinite rate', { lineItems: [{ description: 'A', qty: '1', rate: Infinity }] }, 'lineItems.0.rate'],
    ['absurd rate', { lineItems: [{ description: 'A', qty: '1', rate: '10000001' }] }, 'lineItems.0.rate'],
    ['float noise', { lineItems: [{ description: 'A', qty: '1', rate: 0.1 + 0.2 }] }, 'lineItems.0.rate'],
    ['missing description', { lineItems: [{ description: '  ', qty: '1', rate: '5' }] }, 'lineItems.0.description'],
    ['no line items', { lineItems: [] }, 'lineItems'],
    ['line items not an array', { lineItems: 'nope' }, 'lineItems'],
    ['too many line items', { lineItems: Array.from({ length: 101 }, () => ({ description: 'A', qty: '1', rate: '1' })) }, 'lineItems'],
    ['a $0.00 invoice', { lineItems: [{ description: 'A', qty: '1', rate: '0' }] }, 'lineItems'],
    ['a total over the limit', { lineItems: Array.from({ length: 11 }, () => ({ description: 'A', qty: '1000000', rate: '10000000' })) }, 'lineItems'],
  ])('rejects %s', (_n, over, field) => {
    expect(errorsFor(over)?.[field], JSON.stringify(errorsFor(over))).toBeTruthy();
  });

  it('reports every line that is wrong, each with its own message', () => {
    const e = errorsFor({ lineItems: [{ description: 'ok', qty: '1', rate: '1' }, { description: '', qty: '-1', rate: 'x' }] })!;
    expect(Object.keys(e).sort()).toEqual(['lineItems.1.description', 'lineItems.1.qty', 'lineItems.1.rate']);
  });
});

describe('tax', () => {
  it.each([['-0.01'], ['0.5000001'], ['0.51'], ['1'], ['8.25'], ['abc'], ['1e-2'], [NaN], [Infinity], ['0.0825001']])('rejects %j', (tax) => {
    expect(errorsFor({ taxRate: tax })?.taxRate).toBeTruthy();
  });
  it.each([['0'], ['0.5'], ['0.0825'], ['0.000001'], [0.07], [''], [undefined]])('accepts %j', (tax) => {
    expect(errorsFor({ taxRate: tax })).toBeNull();
  });
});

describe('dates', () => {
  it.each([['2026-02-30'], ['2026-13-01'], ['26-03-01'], ['2026/03/01'], ['March 1, 2026'], [''], [null], [20260301], ['1999-12-31'], ['2101-01-01'], ['2026-03-01T00:00:00Z']])('rejects %j', (d) => {
    expect(errorsFor({ issueDate: d })?.issueDate).toBeTruthy();
    expect(parseIsoDate(d)).toBeNull();
  });
  it('accepts real dates, including a leap day', () => {
    expect(parseIsoDate('2028-02-29')).not.toBeNull();
    expect(parseIsoDate('2027-02-29')).toBeNull();
  });
  it('the due date can’t be before the issue date, but can be the same day', () => {
    expect(errorsFor({ issueDate: '2026-03-10', dueDate: '2026-03-09' })?.dueDate).toMatch(/before/);
    expect(errorsFor({ issueDate: '2026-03-10', dueDate: '2026-03-10' })).toBeNull();
  });
});

describe('client, status and numbers', () => {
  it('requires a real client account on create; legacy edits may keep the stored link', () => {
    expect(errorsFor({ clientUserId: '' })?.clientUserId).toBeTruthy();
    expect(errorsFor({ clientUserId: 'not-a-uuid' })?.clientUserId).toBeTruthy();
    expect(errorsFor({ clientUserId: '', invoiceNumber: 'DS-2026-001', autoNumber: false }, 'update')).toBeNull();
  });
  it.each([['Sent'], ['Overdue'], ['paid'], ['Refunded'], [5], [{}]])('rejects status %j', (status) => {
    expect(errorsFor({ status })?.status).toBeTruthy();
  });
  it.each([['Unsent'], ['Not Paid'], ['Paid']])('accepts status %s', (status) => {
    expect(errorsFor({ status })).toBeNull();
  });
  it('rejects bad names, emails and numbers', () => {
    expect(errorsFor({ clientName: '   ' })?.clientName).toBeTruthy();
    expect(errorsFor({ clientEmail: 'nope' })?.clientEmail).toBeTruthy();
    expect(errorsFor({ clientEmail: 'a@b.co\r\nBcc: x@y.co' })?.clientEmail).toBeTruthy();
    expect(errorsFor({ projectName: '' })?.projectName).toBeTruthy();
    for (const bad of ['DS 2026 001', 'DS\n2026', '../../x', 'x'.repeat(41), '<b>1</b>']) {
      expect(errorsFor({ invoiceNumber: bad, autoNumber: false })?.invoiceNumber, bad).toBeTruthy();
    }
    expect(errorsFor({ invoiceNumber: '', autoNumber: false }, 'update')?.invoiceNumber).toBeTruthy();   // required when editing
  });
  it('cleans control characters out of text fields', () => {
    const r = parseInvoiceInput({ ...valid(), clientName: 'Jane\r\nBcc: x', lineItems: [{ description: 'Design\u0000work', qty: '1', rate: '5' }] }, 'create');
    expect(r.ok && r.data.clientName).not.toMatch(/[\r\n]/);
    expect(r.ok && r.data.lineItems[0].description).not.toMatch(/\u0000/);
  });
  it('refuses a body that is not an object', () => {
    for (const body of [null, 'x', 5, [], undefined]) expect(parseInvoiceInput(body, 'create').ok).toBe(false);
  });
});

describe('status rules', () => {
  it.each([
    ['Unsent', 'Unsent', true], ['Unsent', 'Not Paid', true], ['Unsent', 'Paid', true],
    ['Not Paid', 'Not Paid', true], ['Not Paid', 'Paid', true], ['Not Paid', 'Unsent', false],
    ['Paid', 'Paid', true], ['Paid', 'Not Paid', true], ['Paid', 'Unsent', false],
    ['Overdue', 'Paid', false], ['Paid', 'Refunded', false],
  ])('%s → %s : %s', (from, to, ok) => {
    expect(canTransition(from, to)).toBe(ok);
  });
  it('issued invoices keep their number, paid ones are closed', () => {
    expect(numberIsLocked('Unsent')).toBe(false);
    expect(numberIsLocked('Not Paid')).toBe(true);
    expect(contentIsLocked('Paid')).toBe(true);
    expect(contentIsLocked('Not Paid')).toBe(false);
  });
});
