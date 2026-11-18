import { describe, expect, it } from 'vitest';
import { normalizeWebsite } from '@/lib/companyWebsite';

describe('company website', () => {
  it('accepts a domain or a full web address, trimmed, as typed', () => {
    for (const v of ['acme.com', 'https://acme.com', 'http://www.acme.co.uk/about', 'sub.acme.io:8080/x?y=1#z', '  acme.com  ']) {
      expect(normalizeWebsite(v)).toEqual({ ok: true, value: v.trim() });
    }
  });
  it('treats blank and missing as "no website"', () => {
    expect(normalizeWebsite('')).toEqual({ ok: true, value: null });
    expect(normalizeWebsite('   ')).toEqual({ ok: true, value: null });
    expect(normalizeWebsite(null)).toEqual({ ok: true, value: null });
    expect(normalizeWebsite(undefined)).toEqual({ ok: true, value: null });
  });
  it('rejects placeholders, other schemes, spaces and non-text', () => {
    for (const v of ['NA', 'n/a', 'tbd', 'javascript:alert(1)', 'ftp://acme.com', 'acme', 'acme .com', 'https://', 'http://a_b.com', '<script>.com']) {
      expect(normalizeWebsite(v).ok, v).toBe(false);
    }
    expect(normalizeWebsite(42).ok).toBe(false);
    expect(normalizeWebsite('a'.repeat(301) + '.com').ok).toBe(false);
  });
});
