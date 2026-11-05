import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ID, cookieFor, setSecrets } from './helpers';
import { CLIENT_A, CLIENT_B, CO_A, PROJECT_A, PROJECT_A2, PROJECT_B, makeInvoiceDb } from './invoiceDb';

const h = vi.hoisted(() => ({ db: {} as any }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { POST as create } from '@/app/api/admin/invoices/route';
import { PUT as update } from '@/app/api/admin/invoices/[id]/route';
import { GET as nextNumber } from '@/app/api/admin/invoices/next-number/route';

const YEAR = new Date().getUTCFullYear();
const n = (seq: number) => `DS-${YEAR}-${String(seq).padStart(3, '0')}`;
const admin = () => cookieFor({ userId: ADMIN_ID, admin: true });
const customer = () => cookieFor({ userId: CLIENT_A, admin: false });

const body = (over: Record<string, unknown> = {}) => ({
  invoiceNumber: '', autoNumber: true, issueDate: '2026-03-01', dueDate: '2026-03-31', clientUserId: CLIENT_A, projectId: PROJECT_A,
  clientName: 'Alice A', clientEmail: 'alice@a.co', clientCompany: 'Company A', projectName: 'Alpha', taxRate: '0.0825', status: 'Unsent',
  lineItems: [{ description: 'Design', qty: '1.5', rate: '100.00' }], ...over,
});
const call = (fn: any, method: string, b?: unknown, cookie: string | null = admin(), params: Record<string, string> = {}, headers: Record<string, string> = {}) =>
  fn(new NextRequest('http://localhost/x', { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: b === undefined ? undefined : JSON.stringify(b) }) as never, { params: Promise.resolve(params) });
const post = (b?: unknown, cookie: string | null = admin(), headers = {}) => call(create, 'POST', b, cookie, {}, headers);
const put = (id: string, b: unknown, cookie: string | null = admin()) => call(update, 'PUT', b, cookie, { id });
const rows = () => h.db.invoice.rows as any[];
const created = async (over: Record<string, unknown> = {}) => (await (await post(body(over))).json()) as { id: string; invoiceNumber: string };

beforeEach(() => { setSecrets(); h.db = makeInvoiceDb(); vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('numbering', () => {
  it('assigns DS-YYYY-NNN in sequence', async () => {
    expect((await created()).invoiceNumber).toBe(n(1));
    expect((await created()).invoiceNumber).toBe(n(2));
  });

  it('rapid, simultaneous creation produces unique numbers', async () => {
    const results = await Promise.all(Array.from({ length: 25 }, () => created()));
    const numbers = results.map((r) => r.invoiceNumber);
    expect(new Set(numbers).size).toBe(25);
    expect(numbers.sort()).toEqual(Array.from({ length: 25 }, (_, i) => n(i + 1)));
    expect(rows()).toHaveLength(25);
  });

  it('a stale suggestion from the browser is not trusted: with autoNumber the server assigns the next free number', async () => {
    await created();
    const res = await post(body({ autoNumber: true, invoiceNumber: n(1) }));        // the form still shows the old suggestion
    expect(res.status).toBe(200);
    expect((await res.json()).invoiceNumber).toBe(n(2));
  });

  it('a number typed by hand that is already used is a clear conflict, not a 500', async () => {
    await created();
    const res = await post(body({ autoNumber: false, invoiceNumber: n(1) }));
    expect(res.status).toBe(409);
    const out = await res.json();
    expect(out.errors.invoiceNumber).toMatch(/already in use/);
    expect(rows()).toHaveLength(1);
  });

  it('duplicates are detected case- and whitespace-insensitively', async () => {
    await created({ autoNumber: false, invoiceNumber: 'ds-custom-1' });
    expect((await post(body({ autoNumber: false, invoiceNumber: '  DS-CUSTOM-1 ' }))).status).toBe(409);
  });

  it('numbers the admin typed are skipped by the counter, and nothing is ever reused', async () => {
    await created({ autoNumber: false, invoiceNumber: n(2) });
    expect((await created()).invoiceNumber).toBe(n(1));
    expect((await created()).invoiceNumber).toBe(n(3));                              // skipped the hand-typed 002
  });

  it('if an automatic number collides in the instant it is saved, it is simply allocated again', async () => {
    const original = h.db.invoice.create;
    const tx = h.db.$transaction;
    let first = true;
    // Someone else committed DS-YYYY-001 between our check and our insert: the database refuses ours, our transaction
    // rolls back (counter included), and their row is now visible when we try again.
    h.db.invoice.create = async (args: any) => {
      if (first) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      return original(args);
    };
    h.db.$transaction = async (fn: any) => {
      try { return await tx(fn); } catch (err) {
        if (first) { first = false; rows().push({ id: 'rival', invoiceNumber: n(1), numberConflict: false, lineItems: [] }); }
        throw err;
      }
    };
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(rows().map((r) => r.invoiceNumber).sort()).toEqual([n(1), n(2)]);                // theirs kept, ours moved on
    expect((await res.json()).invoiceNumber).toBe(n(2));
  });

  it('a failed creation hands its number back (no gap, nothing half-saved)', async () => {
    h.db.auditLog.create = async () => { throw new Error('boom'); };
    expect((await post(body())).status).toBe(500);
    expect(rows()).toHaveLength(0);
    h.db.auditLog.create = (await import('./fakes')).table().create;
    expect((await created()).invoiceNumber).toBe(n(1));
  });

  it('the form suggestion reserves nothing and is admin-only', async () => {
    const ask = async (cookie: string | null = admin()) => call(nextNumber, 'GET', undefined, cookie);
    expect((await (await ask()).json()).invoiceNumber).toBe(n(1));
    expect((await (await ask()).json()).invoiceNumber).toBe(n(1));                   // asking twice reserves nothing
    await created();
    expect((await (await ask()).json()).invoiceNumber).toBe(n(2));
    expect((await ask(null)).status).toBe(401);
    expect((await ask(customer())).status).toBe(403);
  });
});

describe('creating: what is stored', () => {
  it('saves exact amounts, the links and the billing snapshot', async () => {
    const out = await created();
    const r = rows()[0];
    expect(r).toMatchObject({
      id: out.id, status: 'Unsent', taxRate: '0.082500', clientUserId: CLIENT_A, companyId: CO_A, projectId: PROJECT_A,
      clientName: 'Alice A', clientEmail: 'alice@a.co', clientCompany: 'Company A', projectName: 'Alpha',
    });
    expect(r.lineItems).toEqual([expect.objectContaining({ description: 'Design', qty: '1.5000', rate: '100.0000' })]);
    expect(h.db.auditLog.rows.map((a: any) => a.action)).toEqual(['invoice.create']);
  });

  it('keeps the printed billing details as typed even when they differ from the account', async () => {
    await created({ clientName: 'Accounts Payable, Company A', clientEmail: 'billing@a.co' });
    expect(rows()[0]).toMatchObject({ clientName: 'Accounts Payable, Company A', clientEmail: 'billing@a.co', clientUserId: CLIENT_A });
  });
});

describe('server-side validation (the browser can’t be trusted)', () => {
  it.each([
    [{ lineItems: [{ description: 'x', qty: -1, rate: 10 }] }, 'lineItems.0.qty'],
    [{ lineItems: [{ description: 'x', qty: 1, rate: -10 }] }, 'lineItems.0.rate'],
    [{ lineItems: [{ description: 'x', qty: 1, rate: 'Infinity' }] }, 'lineItems.0.rate'],
    [{ taxRate: '8.25' }, 'taxRate'],
    [{ taxRate: -0.1 }, 'taxRate'],
    [{ issueDate: '2026-02-30' }, 'issueDate'],
    [{ issueDate: '2026-04-01', dueDate: '2026-03-01' }, 'dueDate'],
    [{ status: 'Refunded' }, 'status'],
    [{ clientEmail: 'nope' }, 'clientEmail'],
    [{ clientUserId: '' }, 'clientUserId'],
  ])('rejects %j with a message for %s and writes nothing', async (over, field) => {
    const res = await post(body(over));
    expect(res.status).toBe(422);
    expect((await res.json()).errors[field]).toBeTruthy();
    expect(rows()).toHaveLength(0);
    expect(h.db.invoiceCounter.rows).toHaveLength(0);          // not even a number was used up
  });
  it('rejects an unreadable or oversized request', async () => {
    const res = await call(create, 'POST', undefined, admin());
    expect(res.status).toBe(400);
    expect((await post(body(), admin(), { 'content-length': '999999' })).status).toBe(413);
  });
});

describe('invoices belong to the right client and project', () => {
  it('a project of another customer is refused', async () => {
    const res = await post(body({ clientUserId: CLIENT_A, projectId: PROJECT_B }));
    expect(res.status).toBe(422);
    expect((await res.json()).errors.projectId).toMatch(/doesn’t belong/);
    expect(rows()).toHaveLength(0);
  });
  it('a project that belongs to the client’s company is accepted', async () => {
    expect((await post(body({ projectId: PROJECT_A2 }))).status).toBe(200);
    expect(rows()[0].projectId).toBe(PROJECT_A2);
  });
  it('the project is optional', async () => {
    expect((await post(body({ projectId: null }))).status).toBe(200);
    expect(rows()[0]).toMatchObject({ projectId: null, clientUserId: CLIENT_A });
  });
  it('only real, non-admin client accounts can be billed', async () => {
    expect((await post(body({ clientUserId: ADMIN_ID }))).status).toBe(422);
    expect((await post(body({ clientUserId: '99999999-9999-4999-8999-999999999999' }))).status).toBe(422);
    expect(rows()).toHaveLength(0);
  });
  it('moving an invoice to another client’s project is refused on edit too', async () => {
    const { id, invoiceNumber } = await created();
    const res = await put(id, body({ invoiceNumber, autoNumber: false, projectId: PROJECT_B }));
    expect(res.status).toBe(422);
    expect(rows()[0].projectId).toBe(PROJECT_A);
  });
});

describe('editing', () => {
  it('replaces the lines and fields, keeping exact amounts', async () => {
    const { id, invoiceNumber } = await created();
    const res = await put(id, body({ invoiceNumber, autoNumber: false, taxRate: '0.07', lineItems: [{ description: 'Build', qty: '3', rate: '0.1' }, { description: 'QA', qty: '1', rate: '0.2' }] }));
    expect(res.status).toBe(200);
    expect(rows()[0].taxRate).toBe('0.070000');
    expect(rows()[0].lineItems.map((l: any) => [l.qty, l.rate])).toEqual([['3.0000', '0.1000'], ['1.0000', '0.2000']]);
  });

  it('a draft may be renumbered to an unused number; a taken one is a conflict', async () => {
    const a = await created();
    const b = await created();
    expect((await put(a.id, body({ invoiceNumber: 'DS-NEW-1', autoNumber: false }))).status).toBe(200);
    const clash = await put(b.id, body({ invoiceNumber: 'ds-new-1', autoNumber: false }));
    expect(clash.status).toBe(409);
    expect(rows().find((r) => r.id === b.id).invoiceNumber).toBe(b.invoiceNumber);
  });

  it('an issued invoice keeps its number', async () => {
    const { id, invoiceNumber } = await created({ status: 'Not Paid' });
    const res = await put(id, body({ invoiceNumber: 'DS-OTHER', autoNumber: false, status: 'Not Paid' }));
    expect(res.status).toBe(409);
    expect((await res.json()).errors.invoiceNumber).toMatch(/keeps its number/);
    expect((await put(id, body({ invoiceNumber, autoNumber: false, status: 'Not Paid', projectName: 'Renamed' }))).status).toBe(200);
  });

  it.each([
    ['Unsent', 'Not Paid', 200], ['Unsent', 'Paid', 200], ['Not Paid', 'Paid', 200], ['Paid', 'Not Paid', 200],
    ['Not Paid', 'Unsent', 409], ['Paid', 'Unsent', 409],
  ])('status %s → %s gives %i', async (from, to, expected) => {
    const { id, invoiceNumber } = await created({ status: from });
    expect((await put(id, body({ invoiceNumber, autoNumber: false, status: to }))).status).toBe(expected);
    expect(rows()[0].status).toBe(expected === 200 ? to : from);
  });

  it('a paid invoice is closed: amounts, dates and details can’t change', async () => {
    const { id, invoiceNumber } = await created({ status: 'Paid' });
    const attempt = (over: Record<string, unknown>) => put(id, body({ invoiceNumber, autoNumber: false, status: 'Paid', ...over }));
    for (const over of [
      { lineItems: [{ description: 'Design', qty: '1.5', rate: '999.00' }] }, { taxRate: '0.1' }, { dueDate: '2026-06-01' },
      { clientName: 'Someone Else' }, { projectName: 'Other' }, { clientUserId: CLIENT_B, projectId: PROJECT_B },
    ]) {
      const res = await attempt(over);
      expect(res.status, JSON.stringify(over)).toBe(409);
    }
    expect(rows()[0].lineItems[0].rate).toBe('100.0000');
    expect((await attempt({})).status).toBe(200);                                // saving it unchanged is harmless
  });

  it('a paid invoice goes back to Not Paid on its own, and only then can be edited', async () => {
    const { id, invoiceNumber } = await created({ status: 'Paid' });
    const mixed = await put(id, body({ invoiceNumber, autoNumber: false, status: 'Not Paid', lineItems: [{ description: 'Design', qty: '2', rate: '100' }] }));
    expect(mixed.status).toBe(409);                                              // can't revert and edit in one step
    expect(rows()[0].status).toBe('Paid');
    expect((await put(id, body({ invoiceNumber, autoNumber: false, status: 'Not Paid' }))).status).toBe(200);
    expect((await put(id, body({ invoiceNumber, autoNumber: false, status: 'Not Paid', lineItems: [{ description: 'Design', qty: '2', rate: '100' }] }))).status).toBe(200);
    expect(h.db.auditLog.rows.map((a: any) => a.action)).toContain('invoice.status');
  });

  it('is validated exactly like creation', async () => {
    const { id, invoiceNumber } = await created();
    const res = await put(id, body({ invoiceNumber, autoNumber: false, lineItems: [{ description: 'x', qty: '-3', rate: '1' }] }));
    expect(res.status).toBe(422);
    expect((await put(id, body({ invoiceNumber, autoNumber: false, dueDate: '2025-01-01' }))).status).toBe(422);
    expect(rows()[0].lineItems[0].qty).toBe('1.5000');                           // untouched
  });

  it('unknown or malformed ids', async () => {
    expect((await put('99999999-9999-4999-8999-999999999999', body({ invoiceNumber: 'X', autoNumber: false }))).status).toBe(404);
    expect((await put('nope', body({ invoiceNumber: 'X', autoNumber: false }))).status).toBe(404);
  });
});

describe('older invoices from before the migration', () => {
  const legacy = (over: Record<string, unknown> = {}) => {
    const r = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', invoiceNumber: 'DS-2025-001', numberConflict: false, issueDate: '2025-01-01', dueDate: '2025-01-31', clientUserId: null, companyId: null, projectId: null,
      clientName: 'Alice A', clientEmail: 'alice@a.co', clientCompany: null, projectName: 'Old Project', taxRate: '0.000000', status: 'Not Paid', createdAt: new Date(),
      lineItems: [{ id: 'l1', description: 'Old work', qty: '1.0000', rate: '50.0000' }], ...over };
    h.db.invoice.rows.push(r);
    return r;
  };
  const resave = (r: any, over: Record<string, unknown> = {}) => put(r.id, body({ invoiceNumber: r.invoiceNumber, autoNumber: false, status: r.status, clientUserId: '', projectId: '', clientName: r.clientName, clientEmail: r.clientEmail, clientCompany: r.clientCompany ?? '', projectName: r.projectName, issueDate: r.issueDate, dueDate: r.dueDate, taxRate: '0', lineItems: [{ description: 'Old work', qty: '1', rate: '50' }], ...over }));

  it('can still be edited while unlinked, and stays unlinked (never guessed into an account)', async () => {
    const r = legacy();
    expect((await resave(r, { projectName: 'Corrected name' })).status).toBe(200);
    expect(r).toMatchObject({ clientUserId: null, projectName: 'Corrected name' });
  });
  it('is linked only when an admin chooses the client', async () => {
    const r = legacy();
    expect((await resave(r, { clientUserId: CLIENT_A, projectId: PROJECT_A })).status).toBe(200);
    expect(r).toMatchObject({ clientUserId: CLIENT_A, companyId: CO_A, projectId: PROJECT_A });
  });
  it('a flagged duplicate number must be renumbered — to an unused number — and is then cleared', async () => {
    legacy({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', invoiceNumber: 'DS-2025-001' });
    const dup = legacy({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', invoiceNumber: 'DS-2025-001', numberConflict: true, status: 'Not Paid' });
    const same = await resave(dup);
    expect(same.status).toBe(422);
    expect((await same.json()).errors.invoiceNumber).toMatch(/used by another invoice/);
    expect((await resave(dup, { invoiceNumber: 'DS-2025-001 ' })).status).toBe(422);
    expect((await resave(dup, { invoiceNumber: 'DS-2025-001-B' })).status).toBe(200);          // allowed although the invoice is issued
    expect(dup).toMatchObject({ invoiceNumber: 'DS-2025-001-B', numberConflict: false });
    expect(rows().find((r) => r.id === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')!.invoiceNumber).toBe('DS-2025-001');   // the original is untouched
  });
  it('a flagged duplicate that is Paid can be renumbered (and nothing else)', async () => {
    const dup = legacy({ invoiceNumber: 'DS-2025-002', numberConflict: true, status: 'Paid' });
    legacy({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', invoiceNumber: 'DS-2025-002', status: 'Paid' });
    expect((await resave(dup, { invoiceNumber: 'DS-2025-002-B', projectName: 'Tampered' })).status).toBe(409);
    const ok = await resave(dup, { invoiceNumber: 'DS-2025-002-B' });
    expect(ok.status, JSON.stringify(await ok.clone().json())).toBe(200);
  });
});

describe('authorization', () => {
  it('anonymous 401, customer 403 — and nothing is written', async () => {
    const { id, invoiceNumber } = await created();
    const before = JSON.stringify(rows());
    for (const cookie of [null, customer()]) {
      const expected = cookie ? 403 : 401;
      expect((await post(body(), cookie)).status).toBe(expected);
      expect((await put(id, body({ invoiceNumber, autoNumber: false }), cookie)).status).toBe(expected);
    }
    expect(JSON.stringify(rows())).toBe(before);
  });
});
