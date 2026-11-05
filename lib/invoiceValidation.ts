import { headerText, safeEmailAddress } from './html';
import { LIMITS, NUMBER_PATTERN, isInvoiceStatus, type InvoiceStatus } from './invoiceRules';
import { QTY_SCALE, RATE_SCALE, TAX_SCALE, computeTotals, formatScaled, parseScaled } from './money';

// One server-side definition of a valid invoice, used for create and for update, so the two can't drift.
// Numbers are validated as exact decimals and returned as canonical text — never through floating point.

export interface InvoiceInput {
  /** undefined → the server allocates the next number. */
  invoiceNumber: string | undefined;
  issueDate: string;
  dueDate: string;
  clientUserId: string | null;
  projectId: string | null;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  projectName: string;
  /** Fraction, 6 decimals: "0.082500" = 8.25%. */
  taxRate: string;
  status: InvoiceStatus;
  lineItems: { description: string; qty: string; rate: string }[];
}

export type Parsed = { ok: true; data: InvoiceInput } | { ok: false; errors: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A real calendar date in YYYY-MM-DD form (no 2026-02-30). */
export function parseIsoDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  const y = d.getUTCFullYear();
  return y >= 2000 && y <= 2100 ? d : null;
}

export function parseInvoiceInput(body: unknown, mode: 'create' | 'update'): Parsed {
  const errors: Record<string, string> = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, errors: { _: 'We could not read that invoice.' } };
  const b = body as Record<string, unknown>;

  // Number: blank (or autoNumber) on create means "allocate for me". A typed number is validated and must be unique.
  let invoiceNumber: string | undefined;
  const typed = typeof b.invoiceNumber === 'string' ? b.invoiceNumber.trim() : '';
  if (mode === 'create' && (b.autoNumber === true || !typed)) invoiceNumber = undefined;
  else if (!typed) errors.invoiceNumber = 'Invoice number is required.';
  else if (!NUMBER_PATTERN.test(typed)) errors.invoiceNumber = 'Use letters, numbers and - . _ / only (up to 40 characters).';
  else invoiceNumber = typed;

  const issue = parseIsoDate(b.issueDate);
  const due = parseIsoDate(b.dueDate);
  if (!issue) errors.issueDate = 'Enter a valid issue date.';
  if (!due) errors.dueDate = 'Enter a valid due date.';
  if (issue && due && due < issue) errors.dueDate = 'The due date can’t be before the issue date.';

  const clientName = typeof b.clientName === 'string' ? headerText(b.clientName, 120) : '';
  if (!clientName) errors.clientName = 'Client name is required.';
  const clientEmail = typeof b.clientEmail === 'string' ? safeEmailAddress(b.clientEmail) : null;
  if (!clientEmail) errors.clientEmail = 'Enter a valid email address.';
  const clientCompany = typeof b.clientCompany === 'string' ? headerText(b.clientCompany, 200) || null : null;
  const projectName = typeof b.projectName === 'string' ? headerText(b.projectName, 200) : '';
  if (!projectName) errors.projectName = 'Project name is required.';

  // The account an invoice belongs to is required for new invoices (customers see only invoices linked to them).
  let clientUserId: string | null = null;
  if (typeof b.clientUserId === 'string' && b.clientUserId) {
    if (UUID.test(b.clientUserId)) clientUserId = b.clientUserId; else errors.clientUserId = 'Choose a client from the list.';
  } else if (mode === 'create') errors.clientUserId = 'Choose the client this invoice is for.';
  let projectId: string | null = null;
  if (typeof b.projectId === 'string' && b.projectId) {
    if (UUID.test(b.projectId)) projectId = b.projectId; else errors.projectId = 'Choose a project from the list.';
  }

  const status = b.status === undefined || b.status === '' ? 'Unsent' : b.status;
  if (!isInvoiceStatus(status)) errors.status = 'Status must be Unsent, Not Paid or Paid.';

  const tax6 = parseScaled(b.taxRate === undefined || b.taxRate === '' ? 0 : b.taxRate, TAX_SCALE);
  if (tax6 === null) errors.taxRate = 'Enter a tax rate between 0% and 50% (up to 4 decimals).';
  else if (Number(formatScaled(tax6, TAX_SCALE)) > LIMITS.maxTaxFraction) errors.taxRate = 'The tax rate can’t be more than 50%.';

  const lineItems: InvoiceInput['lineItems'] = [];
  if (!Array.isArray(b.lineItems) || b.lineItems.length === 0) errors.lineItems = 'Add at least one line item.';
  else if (b.lineItems.length > LIMITS.maxLines) errors.lineItems = `An invoice can have at most ${LIMITS.maxLines} line items.`;
  else {
    b.lineItems.forEach((raw, i) => {
      const li = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const description = typeof li.description === 'string' ? headerText(li.description, LIMITS.maxDescription) : '';
      if (!description) errors[`lineItems.${i}.description`] = 'Add a description.';
      const qty = parseScaled(li.qty, QTY_SCALE);
      const rate = parseScaled(li.rate, RATE_SCALE);
      if (qty === null || qty === BigInt(0)) errors[`lineItems.${i}.qty`] = 'Quantity must be more than 0 (up to 4 decimals).';
      else if (Number(formatScaled(qty, QTY_SCALE)) > LIMITS.maxQuantity) errors[`lineItems.${i}.qty`] = 'That quantity is too large.';
      if (rate === null) errors[`lineItems.${i}.rate`] = 'Rate must be a number, 0 or more (up to 4 decimals).';
      else if (Number(formatScaled(rate, RATE_SCALE)) > LIMITS.maxRate) errors[`lineItems.${i}.rate`] = 'That rate is too large.';
      if (qty && rate !== null) lineItems.push({ description, qty: formatScaled(qty, QTY_SCALE), rate: formatScaled(rate, RATE_SCALE) });
    });
  }

  if (Object.keys(errors).length === 0) {
    const totals = computeTotals(lineItems, formatScaled(tax6 as bigint, TAX_SCALE));
    if (!totals) errors.lineItems = 'Those amounts could not be calculated.';
    else if (totals.total === BigInt(0)) errors.lineItems = 'The invoice total must be more than $0.00.';
    else if (totals.total > LIMITS.maxTotalCents) errors.lineItems = 'The invoice total is too large.';
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      invoiceNumber, issueDate: b.issueDate as string, dueDate: b.dueDate as string, clientUserId, projectId, clientName,
      clientEmail: clientEmail as string, clientCompany, projectName, taxRate: formatScaled(tax6 as bigint, TAX_SCALE), status: status as InvoiceStatus, lineItems,
    },
  };
}

/** Everything about an invoice that a paid invoice must not change, in a form that can be compared. */
export function contentKey(i: Pick<InvoiceInput, 'issueDate' | 'dueDate' | 'clientName' | 'clientEmail' | 'clientCompany' | 'projectName' | 'taxRate' | 'lineItems'> & { invoiceNumber?: string | null }, withNumber: boolean) {
  return JSON.stringify([
    withNumber ? (i.invoiceNumber ?? '').trim().toLowerCase() : null, i.issueDate, i.dueDate, i.clientName, i.clientEmail.toLowerCase(), i.clientCompany ?? '', i.projectName,
    i.taxRate, i.lineItems.map((l) => [l.description, l.qty, l.rate]),
  ]);
}
