// Exact money arithmetic for invoices. Nothing here uses floating point: amounts are parsed from decimal text into
// scaled BigInts, multiplied as integers, and rounded once, at defined steps. The same functions run on the server
// (validation, API), in the admin form and in the PDF, so every total agrees to the cent.
//
// Currency: US dollars. Rounding: half-up to whole cents.
//   line total = round(quantity × rate)            quantity: up to 4 decimals, rate: up to 4 decimals
//   subtotal   = sum of the rounded line totals
//   tax        = round(subtotal × tax rate)        tax rate: a fraction (0.0825 = 8.25%), up to 6 decimals
//   total      = subtotal + tax

export const QTY_SCALE = 4;
export const RATE_SCALE = 4;
export const TAX_SCALE = 6;
const TEN = BigInt(10);
const pow10 = (n: number) => TEN ** BigInt(n);

/**
 * Parses a non-negative decimal into a BigInt scaled by 10^scale. Accepts decimal text or a plain finite number; refuses
 * negatives, NaN/Infinity, exponent notation, more decimals than `scale` (it never rounds user input) and absurd size.
 */
export function parseScaled(input: unknown, scale: number): bigint | null {
  let text: string;
  if (typeof input === 'string') text = input.trim();
  else if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    text = String(input);                                   // shortest round-trip form: 0.1 → "0.1"
  } else if (input && typeof input === 'object' && 'toFixed' in input && typeof (input as { toFixed: unknown }).toFixed === 'function') {
    text = String((input as { toFixed: () => string }).toFixed()); // Prisma.Decimal
  } else return null;

  const m = /^(\d{1,15})(?:\.(\d{1,20}))?$/.exec(text);
  if (!m) return null;
  const frac = m[2] ?? '';
  if (frac.length > scale) {
    // Trailing zeros beyond the scale are harmless ("1.50000" with scale 4).
    if (/[^0]/.test(frac.slice(scale))) return null;
  }
  return BigInt(m[1] + (frac + '0'.repeat(scale)).slice(0, scale));
}

/** Fixed-scale text for a scaled BigInt: formatScaled(1500n, 2) → "15.00". */
export function formatScaled(n: bigint, scale: number): string {
  const s = n.toString().padStart(scale + 1, '0');
  return scale === 0 ? s : `${s.slice(0, -scale)}.${s.slice(-scale)}`;
}

/** Like formatScaled but without trailing zeros (and no trailing dot): 1.5000 → "1.5". */
export const trimDecimal = (text: string) => (text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text);

/** Half-up integer division for non-negative values. */
const roundDiv = (n: bigint, d: bigint) => (n + d / BigInt(2)) / d;

export const lineTotalCents = (qty4: bigint, rate4: bigint) => roundDiv(qty4 * rate4, pow10(QTY_SCALE + RATE_SCALE - 2));
export const taxCents = (subtotalCents: bigint, tax6: bigint) => roundDiv(subtotalCents * tax6, pow10(TAX_SCALE));

export interface Totals { lineTotals: bigint[]; subtotal: bigint; tax: bigint; total: bigint }

/** Totals for stored or submitted values. Returns null if any value isn't a valid exact decimal. */
export function computeTotals(lines: { qty: unknown; rate: unknown }[], taxRate: unknown): Totals | null {
  const tax6 = parseScaled(taxRate ?? 0, TAX_SCALE);
  if (tax6 === null) return null;
  const lineTotals: bigint[] = [];
  for (const l of lines) {
    const q = parseScaled(l.qty, QTY_SCALE);
    const r = parseScaled(l.rate, RATE_SCALE);
    if (q === null || r === null) return null;
    lineTotals.push(lineTotalCents(q, r));
  }
  const subtotal = lineTotals.reduce((a, b) => a + b, BigInt(0));
  const tax = taxCents(subtotal, tax6);
  return { lineTotals, subtotal, tax, total: subtotal + tax };
}

/** "1234567" → "1,234,567" (digits only). */
function groupThousands(whole: string): string {
  let out = '';
  for (let i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 === 0) out += ',';
    out += whole[i];
  }
  return out;
}

/** 1234567 cents → "12,345.67" (digits only; no float). */
export function formatCents(cents: bigint): string {
  const [whole, frac] = formatScaled(cents, 2).split('.');
  return `${groupThousands(whole)}.${frac}`;
}
export const formatMoney = (cents: bigint) => `$${formatCents(cents)}`;

/** Tax rate as the percent people read: "0.082500" → "8.25". */
export const taxPercentLabel = (taxRate: unknown) => {
  const t = parseScaled(taxRate ?? 0, TAX_SCALE);
  return t === null ? '0' : trimDecimal(formatScaled(t, 4));     // fraction×1e6 == percent×1e4, so this is exact
};

/** Percent typed by a person ("8.25") → the stored fraction text ("0.082500"). null if invalid. */
export function percentToFraction(percent: unknown): string | null {
  const p = parseScaled(percent === '' ? '0' : percent, 4);
  return p === null ? null : formatScaled(p, TAX_SCALE);
}

/** A unit rate for display: at least 2 decimals, up to 4 when it has them ("$33.333", "$100.00"). */
export function formatRate(rate: unknown): string {
  const r = parseScaled(rate, RATE_SCALE);
  if (r === null) return '$0.00';
  const [whole, frac = ''] = trimDecimal(formatScaled(r, RATE_SCALE)).split('.');
  return `$${groupThousands(whole)}.${frac.padEnd(2, '0')}`;
}
