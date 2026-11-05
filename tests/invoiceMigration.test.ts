import { readdirSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

// The invoice migration, run on a deliberately messy copy of "production": floats, duplicate numbers, invalid values,
// free-text clients, an ambiguous email. It must convert exactly, flag instead of fix, link only the unambiguous, and
// be safe to run twice.

const root = path.resolve(__dirname, '../prisma/migrations');
const MIGRATION = '20261105040000_invoice_integrity';
const U = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const I = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let db: PGlite;
const q = async (sql: string) => (await db.query(sql)).rows as Record<string, any>[];
const audit = async (kind: string) => q(`SELECT invoice_id, detail FROM invoice_migration_audit WHERE kind = '${kind}' ORDER BY detail::text`);
const sql = () => readFileSync(path.join(root, MIGRATION, 'migration.sql'), 'utf8');

async function legacyDatabase() {
  const d = new PGlite();
  for (const e of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.isDirectory() && e.name < MIGRATION && existsSync(path.join(root, e.name, 'migration.sql'))) await d.exec(readFileSync(path.join(root, e.name, 'migration.sql'), 'utf8'));
  }
  await d.exec(`
    INSERT INTO companies (id, name) VALUES ('c0000000-0000-4000-8000-000000000001', 'Acme Inc'), ('c0000000-0000-4000-8000-000000000002', 'Beta LLC');
    INSERT INTO users (id, name, email, company_id, status) VALUES
      ('${U(1)}', 'Jane Smith',   'jane@acme.co',  'c0000000-0000-4000-8000-000000000001', 'ACTIVE'),
      ('${U(2)}', 'Bob Brown',    'bob@beta.co',   'c0000000-0000-4000-8000-000000000002', 'ACTIVE'),
      ('${U(3)}', 'Twin One',     'twin@x.co',     NULL, 'ACTIVE'),
      ('${U(4)}', 'Twin Two',     'TWIN@x.co',     NULL, 'ACTIVE');
    INSERT INTO users (id, name, email, status, admin) VALUES ('${U(9)}', 'Studio Admin', 'admin@studio.co', 'ACTIVE', true);
    INSERT INTO projects (id, company_id, primary_user_id, name, service, description) VALUES
      ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '${U(1)}', 'Brand Identity', 'Branding', 'x'),
      ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', '${U(2)}', 'Beta Website', 'Web', 'x');
    INSERT INTO invoices (id, invoice_number, issue_date, due_date, client_name, client_email, client_company, project_name, tax_rate, status, created_at) VALUES
      ('${I(1)}', 'DS-2026-001', '2026-01-01', '2026-01-31', 'Jane Smith',   'jane@acme.co',    'Acme Inc', 'Brand Identity', 0.0825, 'Not Paid', now() - interval '9 day'),
      ('${I(2)}', 'DS-2026-001', '2026-02-01', '2026-02-28', 'Unknown Co',   'nobody@nowhere.co', NULL,     'Website',        0,      'Paid',     now() - interval '8 day'),
      ('${I(3)}', 'ds-2026-001 ', '2026-03-01', '2026-03-31', 'Jane Smith',  'JANE@acme.co',    NULL,       'Unrelated work', 0.07,   'Unsent',   now() - interval '7 day'),
      ('${I(4)}', 'DS-2026-007', '2026-04-01', '2026-04-30', 'Janet Typo',   'bob@beta.co',     NULL,       'Mystery',        0,      'Not Paid', now() - interval '6 day'),
      ('${I(5)}', 'DS-2026-008', '2026-04-02', '2026-04-30', 'Twin One',     'twin@x.co',       NULL,       'X',              0,      'Not Paid', now() - interval '5 day'),
      ('${I(6)}', 'DS-2026-009', '2026-05-01', '2026-04-01', 'Bob Brown',    'bob@beta.co',     'Beta LLC', 'Beta Website',   0.9,    'Sent',     now() - interval '4 day'),
      ('${I(7)}', 'DS-2026-010', '2026-05-02', '2026-05-30', 'Bob Brown',    'bob@beta.co',     NULL,       'Brand Identity', 0,      'Not Paid', now() - interval '3 day'),
      ('${I(8)}', 'DS-2026-011', 'May 5',      '2026-05-30', 'Roundy',       'nobody@nowhere.co', NULL,     'Pennies',        0,      'Unsent',   now() - interval '2 day');
    INSERT INTO invoice_line_items (invoice_id, description, qty, rate) VALUES
      ('${I(1)}', 'Design', 1.5, 33.333), ('${I(1)}', 'Dev', 3, 0.1),
      ('${I(2)}', 'Site', 1, 100.1), ('${I(3)}', 'Misc', 1, 10), ('${I(4)}', 'Odd', 1, 5.00001),
      ('${I(5)}', 'Hours', 2, 50), ('${I(6)}', 'Broken', 0, -5), ('${I(7)}', 'Cross-client project name', 1, 20),
      ('${I(8)}', 'a', 1, 0.005), ('${I(8)}', 'b', 1, 0.005), ('${I(8)}', 'c', 1, 0.005);
  `);
  return d;
}

beforeAll(async () => {
  db = await legacyDatabase();
  await db.exec(sql());
}, 60_000);

describe('nothing is lost or silently changed', () => {
  it('every invoice survives with its id, status, dates and text exactly as before', async () => {
    const rows = await q(`SELECT id, invoice_number, status, issue_date, due_date, client_name FROM invoices ORDER BY created_at`);
    expect(rows).toHaveLength(8);
    expect(rows.map((r) => r.invoice_number)).toEqual(['DS-2026-001', 'DS-2026-001', 'ds-2026-001 ', 'DS-2026-007', 'DS-2026-008', 'DS-2026-009', 'DS-2026-010', 'DS-2026-011']);
    expect(rows.map((r) => r.status)).toEqual(['Not Paid', 'Paid', 'Unsent', 'Not Paid', 'Not Paid', 'Sent', 'Not Paid', 'Unsent']);   // even the invalid 'Sent'
    expect(rows[7].issue_date).toBe('May 5');                                                                                      // even the invalid date
    expect(await q(`SELECT 1 FROM invoice_line_items`)).toHaveLength(11);
  });

  it('amounts become exact decimals with the same values', async () => {
    const cols = await q(`SELECT column_name, data_type, numeric_precision p, numeric_scale s FROM information_schema.columns WHERE table_name IN ('invoice_line_items', 'invoices') AND column_name IN ('qty', 'rate', 'tax_rate') ORDER BY column_name`);
    expect(cols).toEqual([{ column_name: 'qty', data_type: 'numeric', p: 12, s: 4 }, { column_name: 'rate', data_type: 'numeric', p: 14, s: 4 }, { column_name: 'tax_rate', data_type: 'numeric', p: 9, s: 6 }]);
    const v = await q(`SELECT qty::text q, rate::text r FROM invoice_line_items WHERE invoice_id = '${I(1)}' ORDER BY rate`);
    expect(v).toEqual([{ q: '3.0000', r: '0.1000' }, { q: '1.5000', r: '33.3330' }]);           // 0.1 is exactly 0.1000, not 0.1000000000000000055
    expect((await q(`SELECT tax_rate::text t FROM invoices WHERE id = '${I(1)}'`))[0].t).toBe('0.082500');
  });
});

describe('duplicates are flagged, never renumbered', () => {
  it('keeps the oldest as it was and flags the later ones, leaving every number untouched', async () => {
    const rows = await q(`SELECT invoice_number n, number_conflict c FROM invoices WHERE id IN ('${I(1)}', '${I(2)}', '${I(3)}') ORDER BY created_at`);
    expect(rows).toEqual([{ n: 'DS-2026-001', c: false }, { n: 'DS-2026-001', c: true }, { n: 'ds-2026-001 ', c: true }]);
    expect(await audit('DUPLICATE_NUMBER')).toHaveLength(2);
  });
  it('the unique index now stops new duplicates (any case) while allowing the flagged legacy ones', async () => {
    await expect(db.exec(`INSERT INTO invoices (invoice_number, issue_date, due_date, client_name, client_email, project_name) VALUES ('Ds-2026-007', '2026-06-01', '2026-06-30', 'x', 'x@y.co', 'p')`)).rejects.toThrow();
    expect((await q(`SELECT count(*)::int n FROM invoices WHERE number_conflict`))[0].n).toBe(2);
  });
  it('the counter continues after the highest number already in use (hand-typed ones included)', async () => {
    expect(await q(`SELECT year, last_value FROM invoice_counters`)).toEqual([{ year: 2026, last_value: 11 }]);
  });
});

describe('linking invoices to real clients', () => {
  const link = async (n: number) => (await q(`SELECT client_user_id c, company_id co, project_id p FROM invoices WHERE id = '${I(n)}'`))[0];

  it('links when the email matches exactly one client AND the name/company/project agrees — and the project too', async () => {
    expect(await link(1)).toEqual({ c: U(1), co: 'c0000000-0000-4000-8000-000000000001', p: 'd0000000-0000-4000-8000-000000000001' });
    expect(await link(3)).toMatchObject({ c: U(1), p: null });                // email differs only by case and the name matches; "Unrelated work" is not a project, so no project guessed
    expect(await link(5)).toEqual({ c: null, co: null, p: null });            // see ambiguity below
  });

  it('never links on an email match alone — a typo’d name is left for a human', async () => {
    expect((await link(4)).c).toBeNull();                                     // "Janet Typo" at bob@beta.co — nothing corroborates it
    const kinds = Object.fromEntries((await q(`SELECT invoice_id, kind FROM invoice_migration_audit WHERE kind LIKE 'LINK_%'`)).map((r) => [r.invoice_id, r.kind]));
    expect(kinds[I(4)]).toBe('LINK_UNCORROBORATED');
  });

  it('never attaches a project that belongs to someone else', async () => {
    // bob@beta.co (name matches Bob) billed for "Brand Identity" — which is JANE's project. Bob is linked; her project is not.
    expect(await link(7)).toMatchObject({ c: U(2), p: null });
    expect((await q(`SELECT count(*)::int n FROM invoices i JOIN projects p ON p.id = i.project_id WHERE p.primary_user_id <> i.client_user_id`))[0].n).toBe(0);
  });

  it('leaves unmatched and ambiguous invoices unlinked and says why', async () => {
    expect((await link(2)).c).toBeNull();
    expect((await link(8)).c).toBeNull();
    const kinds = Object.fromEntries((await q(`SELECT invoice_id, kind FROM invoice_migration_audit WHERE kind LIKE 'LINK_%'`)).map((r) => [r.invoice_id, r.kind]));
    expect(kinds[I(2)]).toBe('LINK_UNMATCHED');
    expect(kinds[I(5)]).toBe('LINK_AMBIGUOUS');                              // two accounts share the address twin@x.co (different case)
  });

  it('never links an invoice to an admin account', async () => {
    expect((await q(`SELECT count(*)::int n FROM invoices WHERE client_user_id = '${U(9)}'`))[0].n).toBe(0);
  });

  it('every link made is recorded', async () => {
    const linked = await audit('LINKED_TO_CLIENT');
    expect(linked).toHaveLength(4);                                          // invoices 1, 3, 6 and 7
    expect((await audit('LINKED_TO_PROJECT'))).toHaveLength(2);              // invoices 1 and 6 — each to its own client's project
  });
});

describe('the audit report', () => {
  it('shows invoices whose total would change under exact per-line rounding — and changes nothing itself', async () => {
    const rows = await audit('TOTAL_WOULD_CHANGE');
    expect(rows).toHaveLength(1);
    expect(rows[0].invoice_id).toBe(I(8));
    expect(rows[0].detail).toMatchObject({ old_total: 0.02, new_total: 0.03 });
  });
  it('reports amounts that could not be stored exactly, and invalid legacy values', async () => {
    expect((await audit('LOSSY_AMOUNT')).map((r) => r.invoice_id)).toEqual([I(4)]);        // 5.00001 → 5.0000
    expect((await audit('INVALID_AMOUNT')).map((r) => r.invoice_id)).toEqual([I(6)]);
    expect((await audit('INVALID_TAX')).map((r) => r.invoice_id)).toEqual([I(6)]);
    expect((await audit('INVALID_DATE_OR_STATUS')).map((r) => r.invoice_id).sort()).toEqual([I(6), I(8)].sort());
  });
});

describe('guards on new data, without breaking old data', () => {
  const bad = (cols: string, vals: string) => db.exec(`INSERT INTO invoices (invoice_number, issue_date, due_date, client_name, client_email, project_name${cols}) VALUES ('NEW-${Math.random()}', '2026-06-01', '2026-06-30', 'x', 'x@y.co', 'p'${vals})`);
  it('rejects an out-of-range tax rate or an unknown status on new rows', async () => {
    await expect(bad(', tax_rate', ', 0.9')).rejects.toThrow();
    await expect(bad(', tax_rate', ', -0.1')).rejects.toThrow();
    await expect(bad(', status', ", 'Refunded'")).rejects.toThrow();
    await bad(', tax_rate, status', ", 0.0825, 'Paid'");                    // a valid one is fine
  });
  it('rejects non-positive quantities and negative rates on new lines', async () => {
    await expect(db.exec(`INSERT INTO invoice_line_items (invoice_id, description, qty, rate) VALUES ('${I(1)}', 'x', 0, 1)`)).rejects.toThrow();
    await expect(db.exec(`INSERT INTO invoice_line_items (invoice_id, description, qty, rate) VALUES ('${I(1)}', 'x', 1, -1)`)).rejects.toThrow();
  });
  it('the existing invalid rows are still there, untouched', async () => {
    expect((await q(`SELECT qty::text, rate::text FROM invoice_line_items WHERE description = 'Broken'`))[0]).toEqual({ qty: '0.0000', rate: '-5.0000' });
    expect((await q(`SELECT tax_rate::text t FROM invoices WHERE id = '${I(6)}'`))[0].t).toBe('0.900000');
  });
});

describe('running it again', () => {
  it('changes nothing and adds no audit rows', async () => {
    const fresh = await legacyDatabase();
    await fresh.exec(sql());
    const snapshot = async () => JSON.stringify([
      (await fresh.query(`SELECT id, invoice_number, number_conflict, client_user_id, project_id, tax_rate::text FROM invoices ORDER BY id`)).rows,
      (await fresh.query(`SELECT kind, count(*)::int FROM invoice_migration_audit GROUP BY kind ORDER BY kind`)).rows,
      (await fresh.query(`SELECT * FROM invoice_counters`)).rows,
      (await fresh.query(`SELECT invoice_id, qty::text, rate::text FROM invoice_line_items ORDER BY invoice_id, rate`)).rows,
    ]);
    const before = await snapshot();
    await fresh.exec(sql());
    await fresh.exec(sql());
    expect(await snapshot()).toBe(before);
  }, 30_000);
});
