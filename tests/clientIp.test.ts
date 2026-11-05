import { describe, expect, it } from 'vitest';
import { getClientIp, normalizeIp } from '@/lib/clientIp';

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe('client IP and trusted proxies', () => {
  it('ignores every forwarded header when no proxy is trusted (spoofing buys nothing)', () => {
    const a = getClientIp(h({ 'x-forwarded-for': '1.1.1.1' }), {});
    const b = getClientIp(h({ 'x-forwarded-for': '2.2.2.2', 'x-real-ip': '3.3.3.3' }), {});
    expect(a).toBe('unknown');
    expect(b).toBe('unknown');
  });
  it('on Vercel, uses the platform-provided address', () => {
    expect(getClientIp(h({ 'x-vercel-forwarded-for': '198.51.100.9', 'x-forwarded-for': '198.51.100.9' }), { VERCEL: '1' })).toBe('198.51.100.9');
    expect(getClientIp(h({ 'x-real-ip': '198.51.100.10' }), { VERCEL: '1' })).toBe('198.51.100.10');
  });
  it('with hops:1 takes the entry the trusted proxy appended, not what the client sent', () => {
    const header = h({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7, 203.0.113.5' });
    expect(getClientIp(header, { TRUSTED_PROXY: 'hops:1' })).toBe('203.0.113.5');
    expect(getClientIp(header, { TRUSTED_PROXY: 'hops:2' })).toBe('7.7.7.7');
  });
  it('falls back to a shared bucket when the header is shorter than the configured hops or malformed', () => {
    expect(getClientIp(h({ 'x-forwarded-for': '203.0.113.5' }), { TRUSTED_PROXY: 'hops:2' })).toBe('unknown');
    expect(getClientIp(h({ 'x-forwarded-for': 'not-an-ip' }), { TRUSTED_PROXY: 'hops:1' })).toBe('unknown');
    expect(getClientIp(h({}), { VERCEL: '1' })).toBe('unknown');
  });
  it('treats an explicit TRUSTED_PROXY=none as untrusted even on Vercel', () => {
    expect(getClientIp(h({ 'x-real-ip': '198.51.100.10' }), { VERCEL: '1', TRUSTED_PROXY: 'none' })).toBe('unknown');
  });
  it('groups IPv6 by /64 so rotating host bits does not evade limits', () => {
    expect(normalizeIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe(normalizeIp('2001:db8:1:2::1'));
    expect(normalizeIp('2001:db8:1:3::1')).not.toBe(normalizeIp('2001:db8:1:2::1'));
  });
  it('unwraps IPv4-mapped IPv6, brackets and ports', () => {
    expect(normalizeIp('::ffff:203.0.113.5')).toBe('203.0.113.5');
    expect(normalizeIp('[2001:db8::1]')).toBe(normalizeIp('2001:db8::1'));
    expect(normalizeIp('203.0.113.5:8080')).toBe('203.0.113.5');
  });
  it.each(['', 'abc', '999.1.1.1', '1.2.3', "1.1.1.1'; drop table"])('rejects %j', (v) => {
    expect(normalizeIp(v)).toBeNull();
  });
});
