import type { Prisma, PrismaClient } from '@prisma/client';
import { CUSTOMER_VISIBLE_STATUSES } from './invoiceRules';
import { formatCents, formatScaled, computeTotals, parseScaled, QTY_SCALE, RATE_SCALE, TAX_SCALE, trimDecimal } from './money';
import type { InvoiceInput } from './invoiceValidation';

type Db = PrismaClient | Prisma.TransactionClient;

export interface ResolvedLinks { clientUserId: string; companyId: string | null; projectId: string | null }

/**
 * An invoice may only point at a real, non-admin client, and a project that belongs to THAT client (their own project, or
 * a project of their company). Anything else is a field error — never a quiet re-assignment to someone else's account.
 */
export async function resolveLinks(db: Db, clientUserId: string, projectId: string | null): Promise<{ ok: true; links: ResolvedLinks } | { ok: false; errors: Record<string, string> }> {
  const user = await db.user.findUnique({ where: { id: clientUserId }, select: { id: true, admin: true, companyId: true } });
  if (!user || user.admin) return { ok: false, errors: { clientUserId: 'Choose a client from the list.' } };
  if (projectId) {
    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, companyId: true, primaryUserId: true } });
    const belongs = !!project && (project.primaryUserId === user.id || (!!user.companyId && project.companyId === user.companyId));
    if (!belongs) return { ok: false, errors: { projectId: 'That project doesn’t belong to this client.' } };
  }
  return { ok: true, links: { clientUserId: user.id, companyId: user.companyId, projectId } };
}

/** A stored invoice as plain, canonical text (no Decimal objects, no floats) — safe to send to the browser or compare. */
export interface InvoiceView {
  id: string; invoiceNumber: string; issueDate: string; dueDate: string;
  clientName: string; clientEmail: string; clientCompany: string | null; projectName: string;
  taxRate: string; status: string;
  lineItems: { description: string; qty: string; rate: string }[];
}

type Dec = { toFixed(): string } | string | number;
const canon = (v: Dec, scale: number) => {
  const n = parseScaled(v, scale);
  return n === null ? String(typeof v === 'object' ? v.toFixed() : v) : formatScaled(n, scale);
};

export function toInvoiceView(row: {
  id: string; invoiceNumber: string; issueDate: string; dueDate: string; clientName: string; clientEmail: string; clientCompany: string | null;
  projectName: string; taxRate: Dec; status: string; lineItems: { description: string; qty: Dec; rate: Dec }[];
}): InvoiceView {
  return {
    id: row.id, invoiceNumber: row.invoiceNumber, issueDate: row.issueDate, dueDate: row.dueDate, clientName: row.clientName, clientEmail: row.clientEmail,
    clientCompany: row.clientCompany, projectName: row.projectName, status: row.status, taxRate: canon(row.taxRate, TAX_SCALE),
    lineItems: row.lineItems.map((l) => ({ description: l.description, qty: canon(l.qty, QTY_SCALE), rate: canon(l.rate, RATE_SCALE) })),
  };
}

/** Display strings for totals, from the one shared calculation. */
export function totalsFor(v: Pick<InvoiceView, 'lineItems' | 'taxRate'>) {
  const t = computeTotals(v.lineItems, v.taxRate);
  return t ? { subtotal: formatCents(t.subtotal), tax: formatCents(t.tax), total: formatCents(t.total), totalCents: t.total.toString() } : null;
}

export const displayQty = (q: string) => trimDecimal(q);

export function lineCreateData(items: InvoiceInput['lineItems']) {
  return items.map((l) => ({ description: l.description, qty: l.qty, rate: l.rate }));
}

/**
 * Which invoices a customer may see: only those linked to THEIR account, and only once issued. Used by the dashboard
 * page and by the PDF endpoint so the two can never disagree. (Company membership alone grants nothing.)
 */
export const customerInvoiceWhere = (userId: string) => ({ clientUserId: userId, status: { in: [...CUSTOMER_VISIBLE_STATUSES] } });
