import { describe, expect, it } from 'vitest';
import {
  computeTotals, formatCents, formatMoney, formatRate, formatScaled, lineTotalCents, parseScaled, percentToFraction, taxCents, taxPercentLabel, trimDecimal,
} from '@/lib/money';

const total = (lines: [string, string][], tax = '0') => {
  const t = computeTotals(lines.map(([qty, rate]) => ({ qty, rate })), tax)!;
  return { lines: t.lineTotals.map((c) => formatCents(c)), subtotal: formatCents(t.subtotal), tax: formatCents(t.tax), total: formatCents(t.total) };
};

describe('parsing amounts exactly', () => {
  it.each([
    ['0', 4, 0n], ['1', 4, 10000n], ['1.5', 4, 15000n], ['33.333', 4, 333330n], ['0.0001', 4, 1n], ['100.10', 4, 1001000n],
    ['  12.50 ', 2, 1250n], ['1.50000', 4, 15000n],           // trailing zeros past the scale are harmless
    [0.1, 4, 1000n], [12, 4, 120000n],                        // plain finite numbers are read from their shortest decimal form
  ])('%j (scale %i) → %s', (input, scale, expected) => {
    expect(parseScaled(input, scale)).toBe(expected);
  });

  it.each([
    '-1', '-0.01', '1e3', '1E-7', '0x10', '1,000', '$5', '', '  ', '.5', '5.', '1.00001', 'NaN', 'Infinity', '12345678901234567', '1 2', '１２',
    NaN, Infinity, -Infinity, -5, 1e21, 1e-7, null, undefined, {}, [], true,
  ])('refuses %j (never rounds or guesses)', (input) => {
    expect(parseScaled(input as never, 4)).toBeNull();
  });

  it('a float that is not exactly representable in 4 decimals is refused, not silently rounded', () => {
    expect(parseScaled(0.1 + 0.2, 4)).toBeNull();            // 0.30000000000000004
    expect(parseScaled(String(0.1 + 0.2), 4)).toBeNull();
    expect(parseScaled('0.1', 4)! + parseScaled('0.2', 4)!).toBe(parseScaled('0.3', 4));   // but the decimals add up exactly
  });

  it('reads Prisma-style Decimal objects without going through a float', () => {
    expect(parseScaled({ toFixed: () => '33.3330' }, 4)).toBe(333330n);
  });
});

describe('the classic floating-point traps', () => {
  it('0.1 + 0.2 is exactly 0.30', () => {
    expect(total([['1', '0.1'], ['1', '0.2']])).toMatchObject({ subtotal: '0.30', total: '0.30' });
  });
  it('3 × 0.1 is exactly 0.30 (floats give 0.30000000000000004)', () => {
    expect(total([['3', '0.1']]).subtotal).toBe('0.30');
  });
  it('1.005 rounds half-up to 1.01 (floats give 1.00)', () => {
    expect(formatCents(lineTotalCents(parseScaled('1', 4)!, parseScaled('1.005', 4)!))).toBe('1.01');
  });
  it('fractional quantities: 1.5 h × $33.333 = $50.00 (49.9995 rounds up)', () => {
    expect(total([['1.5', '33.333']]).lines).toEqual(['50.00']);
  });
  it('0.25 h × $100.10', () => {
    expect(total([['0.25', '100.10']]).lines).toEqual(['25.03']);   // 25.025 → half-up
  });
  it('line totals are rounded one by one, then added (documented policy)', () => {
    // Three lines of 0.005 each: each rounds to 0.01 → 0.03. Summing first and rounding once would give 0.02.
    expect(total([['1', '0.005'], ['1', '0.005'], ['1', '0.005']])).toMatchObject({ lines: ['0.01', '0.01', '0.01'], subtotal: '0.03' });
  });
  it('tax is rounded once, on the subtotal, half-up', () => {
    expect(total([['1', '10.00']], '0.0825')).toMatchObject({ subtotal: '10.00', tax: '0.83', total: '10.83' });     // 0.825 → 0.83
    expect(total([['1', '19.99']], '0.0825')).toMatchObject({ tax: '1.65', total: '21.64' });                        // 1.649175
    expect(total([['2', '9.99']], '0.07')).toMatchObject({ subtotal: '19.98', tax: '1.40', total: '21.38' });        // 1.3986
  });
  it('the displayed lines always add up to the displayed total', () => {
    const t = computeTotals([{ qty: '7', rate: '14.285' }, { qty: '3.333', rate: '3.3333' }, { qty: '0.5', rate: '99.99' }], '0.0875')!;
    expect(t.lineTotals.reduce((a, b) => a + b, 0n)).toBe(t.subtotal);
    expect(t.subtotal + t.tax).toBe(t.total);
  });
  it('a long invoice of $0.10 lines has no drift', () => {
    const lines: [string, string][] = Array.from({ length: 100 }, () => ['1', '0.10']);
    expect(total(lines).subtotal).toBe('10.00');                  // floats: 9.99999999999998
  });
});

describe('large and small values', () => {
  it('handles very large valid totals exactly', () => {
    expect(total([['1000000', '10000000']])).toMatchObject({ subtotal: '10,000,000,000,000.00' });
    expect(total([['999999.9999', '9999999.9999']]).subtotal).toBe('9,999,999,998,900.00');   // (1e6 − 1e-4)(1e7 − 1e-4) = 1e13 − 1,100 + 1e-8, to the cent
    expect(computeTotals([{ qty: '999999.9999', rate: '9999999.9999' }], '0.5')!.total).toBeGreaterThan(0n);
  });
  it('tiny amounts round to zero or one cent predictably', () => {
    expect(total([['0.0001', '0.01']]).lines).toEqual(['0.00']);
    expect(total([['1', '0.0050']]).lines).toEqual(['0.01']);
    expect(total([['1', '0.0049']]).lines).toEqual(['0.00']);
  });
  it('a zero tax rate adds nothing; a 50% rate halves exactly', () => {
    expect(taxCents(12345n, 0n)).toBe(0n);
    expect(taxCents(12345n, 500000n)).toBe(6173n);               // 6172.5 → half-up
  });
});

describe('invalid input to the calculator', () => {
  it('returns null instead of guessing', () => {
    expect(computeTotals([{ qty: 'abc', rate: '1' }], '0')).toBeNull();
    expect(computeTotals([{ qty: '1', rate: '-1' }], '0')).toBeNull();
    expect(computeTotals([{ qty: '1', rate: '1' }], '1e1')).toBeNull();
  });
});

describe('formatting', () => {
  it('money with thousands separators, no floats', () => {
    expect(formatMoney(0n)).toBe('$0.00');
    expect(formatMoney(5n)).toBe('$0.05');
    expect(formatMoney(123456789n)).toBe('$1,234,567.89');
    expect(formatCents(100000000000n)).toBe('1,000,000,000.00');
  });
  it('rates show at least 2 and up to 4 decimals', () => {
    expect(formatRate('100')).toBe('$100.00');
    expect(formatRate('33.3330')).toBe('$33.333');
    expect(formatRate('1234.5')).toBe('$1,234.50');
    expect(formatRate('0.0125')).toBe('$0.0125');
  });
  it('tax: a percent typed by a person ⇄ the stored fraction', () => {
    expect(percentToFraction('8.25')).toBe('0.082500');
    expect(percentToFraction('')).toBe('0.000000');
    expect(percentToFraction('8.12345')).toBeNull();              // more than 4 decimals of a percent
    expect(percentToFraction('-1')).toBeNull();
    expect(taxPercentLabel('0.082500')).toBe('8.25');
    expect(taxPercentLabel('0.070000')).toBe('7');
    expect(taxPercentLabel('0.000000')).toBe('0');
  });
  it('scaled text round-trips', () => {
    expect(formatScaled(5n, 4)).toBe('0.0005');
    expect(formatScaled(123456n, 2)).toBe('1234.56');
    expect(trimDecimal('1.5000')).toBe('1.5');
    expect(trimDecimal('100.0000')).toBe('100');
    expect(trimDecimal('100')).toBe('100');
  });
});
