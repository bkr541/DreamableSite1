import { randomUUID } from 'crypto';
import { ADMIN_ID, CLIENT_ID } from './helpers';
import { table, withTransactions } from './fakes';

export const CLIENT_A = CLIENT_ID;                                  // a customer with their own company and project
export const CLIENT_B = '44444444-4444-4444-8444-444444444444';    // a different customer
export const CO_A = 'c1111111-1111-4111-8111-111111111111';
export const CO_B = 'c2222222-2222-4222-8222-222222222222';
export const PROJECT_A = 'a0000000-0000-4000-8000-0000000000a1';   // owned by client A
export const PROJECT_A2 = 'a0000000-0000-4000-8000-0000000000a2';  // belongs to company A, no named owner
export const PROJECT_B = 'b0000000-0000-4000-8000-0000000000b1';   // owned by client B

type Row = Record<string, any>;

/** A stand-in for the invoice tables: unique-number enforcement, nested line items, the number counter, real rollback. */
export function makeInvoiceDb() {
  const user = table([
    { id: ADMIN_ID, name: 'Admin', email: 'admin@x.co', admin: true, role: 'ADMIN', status: 'ACTIVE', sessionVersion: 0, inquiryId: null, companyId: null },
    { id: CLIENT_A, name: 'Alice A', email: 'alice@a.co', admin: false, role: 'CLIENT', status: 'ACTIVE', sessionVersion: 0, inquiryId: null, companyId: CO_A },
    { id: CLIENT_B, name: 'Bob B', email: 'bob@b.co', admin: false, role: 'CLIENT', status: 'ACTIVE', sessionVersion: 0, inquiryId: null, companyId: CO_B },
  ]);
  const project = table([
    { id: PROJECT_A, name: 'Alpha', companyId: CO_A, primaryUserId: CLIENT_A },
    { id: PROJECT_A2, name: 'Alpha Two', companyId: CO_A, primaryUserId: null },
    { id: PROJECT_B, name: 'Beta', companyId: CO_B, primaryUserId: CLIENT_B },
  ]);
  const inquiryCounters = table();                                    // invoice_counters rows: { year, last_value }
  const invoiceBase = table([], { defaults: () => ({ numberConflict: false, clientUserId: null, companyId: null, projectId: null, clientCompany: null, createdAt: new Date(), lineItems: [] }) });
  const rows: Row[] = invoiceBase.rows;
  const lower = (n: string) => n.trim().toLowerCase();
  const clash = (number: string, exceptId?: string) => rows.some((r) => !r.numberConflict && r.id !== exceptId && lower(r.invoiceNumber) === lower(number));

  const invoice = {
    ...invoiceBase,
    create: async ({ data }: Row) => {
      if (clash(data.invoiceNumber)) throw Object.assign(new Error('Unique constraint failed on invoices_invoice_number_unique'), { code: 'P2002' });
      const { lineItems, ...rest } = data;
      const r = { id: randomUUID(), numberConflict: false, clientUserId: null, companyId: null, projectId: null, clientCompany: null, createdAt: new Date(), ...rest, lineItems: (lineItems?.create ?? []).map((l: Row) => ({ id: randomUUID(), ...l })) };
      rows.push(r);
      return { ...r };
    },
    update: async ({ where, data }: Row) => {
      const r = rows.find((x) => x.id === where.id);
      if (!r) throw Object.assign(new Error('not found'), { code: 'P2025' });
      const { lineItems, ...rest } = data;
      if (rest.invoiceNumber && !rest.numberConflict && clash(rest.invoiceNumber, r.id)) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      Object.assign(r, rest);
      if (lineItems?.create) r.lineItems = lineItems.create.map((l: Row) => ({ id: randomUUID(), ...l }));
      return { ...r };
    },
    findUnique: async ({ where }: Row) => { const r = rows.find((x) => x.id === where.id); return r ? { ...r, lineItems: r.lineItems.map((l: Row) => ({ ...l })) } : null; },
    findFirst: async ({ where }: Row) => {
      const r = rows.find((x) => x.id === where.id && (where.clientUserId === undefined || x.clientUserId === where.clientUserId) && (!where.status || where.status.in.includes(x.status)));
      return r ? { ...r, lineItems: r.lineItems.map((l: Row) => ({ ...l })) } : null;
    },
  };

  const db: Record<string, any> = {
    user, project, invoice, invoiceCounter: inquiryCounters, auditLog: table(),
    invoiceLineItem: { deleteMany: async ({ where }: Row) => { const r = rows.find((x) => x.id === where.invoiceId); if (r) r.lineItems = []; return { count: 1 }; } },
    // The three raw statements the app issues (see lib/invoiceNumbers.ts and the invoice routes).
    $queryRawUnsafe: async (sql: string, ...p: unknown[]) => {
      if (sql.includes('INSERT INTO invoice_counters')) {
        const year = Number(p[0]);
        const c = inquiryCounters.rows.find((x: Row) => x.year === year);
        if (c) c.last_value += 1; else inquiryCounters.rows.push({ id: randomUUID(), year, last_value: 1 });
        return [{ last_value: inquiryCounters.rows.find((x: Row) => x.year === year)!.last_value }];
      }
      if (sql.includes('SELECT last_value FROM invoice_counters')) {
        const c = inquiryCounters.rows.find((x: Row) => x.year === Number(p[0]));
        return c ? [{ last_value: c.last_value }] : [];
      }
      if (sql.includes('FROM invoices WHERE lower(btrim(invoice_number))')) {
        return rows.some((r) => lower(r.invoiceNumber) === lower(String(p[0])) && r.id !== p[1]) ? [{ taken: 1 }] : [];
      }
      throw new Error(`unexpected SQL in test: ${sql}`);
    },
  };
  return withTransactions(db);
}
