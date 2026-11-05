import { beforeEach, describe, expect, it } from 'vitest';
import { allocateInvoiceNumber, formatInvoiceNumber, peekInvoiceNumber } from '@/lib/invoiceNumbers';
import { makeSchema } from './pg';

// These run the real allocation SQL and the real unique index on an in-process Postgres built from the migrations.

let db: Awaited<ReturnType<typeof makeSchema>>['db'];
const Y = 2031;                         // a year with no data, so tests don't depend on today's date
const asTx = (conn: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> } = db) => ({
  $queryRawUnsafe: async (sql: string, ...params: unknown[]) => (await conn.query(sql, params)).rows,
});
const insert = (number: string, extra = '') =>
  db.exec(`INSERT INTO invoices (invoice_number, issue_date, due_date, client_name, client_email, project_name${extra ? ', ' + extra.split('=')[0] : ''})
           VALUES ('${number}', '2026-01-01', '2026-01-31', 'C', 'c@x.co', 'P'${extra ? ', ' + extra.split('=')[1] : ''})`);
const fails = async (sql: string) => { try { await db.exec(sql); return null; } catch (e) { return String((e as Error).message); } };

beforeEach(async () => { ({ db } = await makeSchema()); });

describe('allocating numbers', () => {
  it('hands out DS-YYYY-NNN in order', async () => {
    const tx = asTx();
    expect(await allocateInvoiceNumber(tx, Y)).toBe(formatInvoiceNumber(Y, 1));
    expect(await allocateInvoiceNumber(tx, Y)).toBe('DS-2031-002');
    expect(await allocateInvoiceNumber(tx, Y + 1)).toBe('DS-2032-001');    // each year has its own sequence
  });

  it('50 simultaneous allocations all get different numbers', async () => {
    const numbers = await Promise.all(Array.from({ length: 50 }, () => allocateInvoiceNumber(asTx(), Y)));
    expect(new Set(numbers).size).toBe(50);
    expect([...numbers].sort()).toEqual(Array.from({ length: 50 }, (_, i) => formatInvoiceNumber(Y, i + 1)));
  });

  it('skips numbers that were typed by hand, in any letter case', async () => {
    await insert('ds-2031-002');
    const tx = asTx();
    expect(await allocateInvoiceNumber(tx, Y)).toBe('DS-2031-001');
    expect(await allocateInvoiceNumber(tx, Y)).toBe('DS-2031-003');
  });

  it('a rolled-back creation hands its number back — no gap from a failed save', async () => {
    await expect(db.transaction(async (t) => { await allocateInvoiceNumber(asTx(t), Y); throw new Error('save failed'); })).rejects.toThrow('save failed');
    expect(await allocateInvoiceNumber(asTx(), Y)).toBe('DS-2031-001');
  });

  it('the suggestion shown in the form reserves nothing', async () => {
    expect(await peekInvoiceNumber(asTx(), Y)).toBe('DS-2031-001');
    expect(await peekInvoiceNumber(asTx(), Y)).toBe('DS-2031-001');
    await allocateInvoiceNumber(asTx(), Y);
    expect(await peekInvoiceNumber(asTx(), Y)).toBe('DS-2031-002');
    await insert('DS-2031-002');
    expect(await peekInvoiceNumber(asTx(), Y)).toBe('DS-2031-003');           // and it looks past numbers already used
  });
});

describe('the database refuses duplicate numbers', () => {
  it('exact, differently-cased and whitespace-padded duplicates are all rejected', async () => {
    await insert('DS-2031-010');
    for (const dup of ['DS-2031-010', 'ds-2031-010', '  DS-2031-010 ']) {
      expect(await fails(`INSERT INTO invoices (invoice_number, issue_date, due_date, client_name, client_email, project_name) VALUES ('${dup}', '2026-01-01', '2026-01-31', 'C', 'c@x.co', 'P')`), dup).toMatch(/unique|duplicate/i);
    }
  });

  it('flagged legacy duplicates are exempt, so existing records are never blocked or renumbered', async () => {
    await insert('DS-2031-011');
    await insert('DS-2031-011', 'number_conflict=true');           // a legacy duplicate, flagged by the migration
    const rows = (await db.query(`SELECT invoice_number, number_conflict FROM invoices ORDER BY created_at`)).rows;
    expect(rows).toEqual([{ invoice_number: 'DS-2031-011', number_conflict: false }, { invoice_number: 'DS-2031-011', number_conflict: true }]);
  });

  it('renumbering a flagged duplicate to a free number, and clearing the flag, works; a taken number does not', async () => {
    await insert('DS-2031-012');
    await insert('DS-2031-012', 'number_conflict=true');
    expect(await fails(`UPDATE invoices SET invoice_number = 'DS-2031-012', number_conflict = false WHERE number_conflict`)).toMatch(/unique|duplicate/i);
    await db.exec(`UPDATE invoices SET invoice_number = 'DS-2031-012-B', number_conflict = false WHERE number_conflict`);
    expect((await db.query(`SELECT count(*)::int n FROM invoices WHERE number_conflict`)).rows[0]).toEqual({ n: 0 });
  });
});
