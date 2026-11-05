// Invoice numbers are DS-YYYY-NNN and are allocated by the server from a per-year counter row. Allocation happens in the
// SAME transaction as the invoice insert: concurrent creators queue on the counter row, each gets the next number, and
// a rolled-back creation hands its number back. Gaps can still appear (an invoice later removed, or a number typed by
// hand that the counter skips over); numbers are never reused. A database unique index is the final backstop.

type Exec = (sql: string, ...params: unknown[]) => Promise<Record<string, unknown>[]>;
type Tx = { $queryRawUnsafe: (sql: string, ...p: unknown[]) => Promise<unknown> };

export const formatInvoiceNumber = (year: number, seq: number) => `DS-${year}-${String(seq).padStart(3, '0')}`;
const asExec = (tx: Tx): Exec => (sql, ...p) => tx.$queryRawUnsafe(sql, ...p) as Promise<Record<string, unknown>[]>;

const TAKEN = `SELECT 1 AS taken FROM invoices WHERE lower(btrim(invoice_number)) = lower($1) LIMIT 1`;

/** Reserves the next free number inside the caller's transaction. */
export async function allocateInvoiceNumber(tx: Tx, year = new Date().getUTCFullYear()): Promise<string> {
  const exec = asExec(tx);
  for (let attempt = 0; attempt < 50; attempt++) {
    const [row] = await exec(
      `INSERT INTO invoice_counters (year, last_value) VALUES ($1::int, 1)
       ON CONFLICT (year) DO UPDATE SET last_value = invoice_counters.last_value + 1
       RETURNING last_value`,
      year,
    );
    const candidate = formatInvoiceNumber(year, Number(row.last_value));
    if ((await exec(TAKEN, candidate)).length === 0) return candidate;   // skip numbers someone typed by hand
  }
  throw new Error('could not allocate an invoice number');
}

/** What the next number would be, without reserving it (the form shows this as a suggestion only). */
export async function peekInvoiceNumber(tx: Tx, year = new Date().getUTCFullYear()): Promise<string> {
  const exec = asExec(tx);
  const [row] = await exec(`SELECT last_value FROM invoice_counters WHERE year = $1::int`, year);
  let seq = Number(row?.last_value ?? 0) + 1;
  for (let i = 0; i < 50; i++, seq++) {
    const candidate = formatInvoiceNumber(year, seq);
    if ((await exec(TAKEN, candidate)).length === 0) return candidate;
  }
  return formatInvoiceNumber(year, seq);
}
