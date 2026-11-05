// The invoice business rules, in one place, shared by the API and the admin form.

export const INVOICE_STATUSES = ['Unsent', 'Not Paid', 'Paid'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const isInvoiceStatus = (s: unknown): s is InvoiceStatus => typeof s === 'string' && (INVOICE_STATUSES as readonly string[]).includes(s);

// Status changes are recorded by staff only (nothing here collects or detects a payment).
//   Unsent   → Not Paid | Paid     a draft is issued (or recorded as already paid)
//   Not Paid → Paid                payment was received
//   Paid     → Not Paid            a correction; the only way a Paid invoice can be edited again
// An issued invoice never goes back to Unsent.
const NEXT: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  Unsent: ['Unsent', 'Not Paid', 'Paid'],
  'Not Paid': ['Not Paid', 'Paid'],
  Paid: ['Paid', 'Not Paid'],
};
export const canTransition = (from: string, to: string) => isInvoiceStatus(from) && (NEXT[from] as readonly string[]).includes(to);

/** What is allowed to change on an existing invoice. */
export const numberIsLocked = (status: string) => status !== 'Unsent';   // issued invoices keep their number
export const contentIsLocked = (status: string) => status === 'Paid';    // a paid invoice is a closed record

// Billing limits (US dollars).
export const LIMITS = {
  maxLines: 100,
  maxQuantity: 1_000_000,          // units
  maxRate: 10_000_000,             // dollars per unit
  maxTaxFraction: 0.5,             // 50%
  maxTotalCents: BigInt(100_000_000_000), // $1,000,000,000.00
  maxDescription: 300,
  maxPayloadBytes: 64 * 1024,
} as const;

export const NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$/;

/** Customers see issued invoices only: drafts (Unsent) are internal. */
export const CUSTOMER_VISIBLE_STATUSES = ['Not Paid', 'Paid'] as const;
