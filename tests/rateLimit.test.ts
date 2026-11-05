import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePg } from './pg';
import { PostgresRateLimitStore, RULES, check, clear, consume, setRateLimitStore, tooManyRequests, waitText, type Rule } from '@/lib/rateLimit';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

const burst: Rule = { name: 't.burst', limit: 5, windowSec: 600, maxBlockSec: 4800 };
const failures: Rule = { name: 't.fail', limit: 3, windowSec: 600, maxBlockSec: 4800, failuresOnly: true };

let pg: Awaited<ReturnType<typeof makePg>>;
beforeEach(async () => {
  pg = await makePg();
  setRateLimitStore(pg.instance());
});

describe('limiter on real Postgres', () => {
  it('allows the budget, then denies with a retry hint', async () => {
    for (let i = 0; i < 5; i++) expect((await consume(burst, 'a')).allowed).toBe(true);
    const d = await consume(burst, 'a');
    expect(d.allowed).toBe(false);
    expect(d.retryAfterSec).toBeGreaterThan(0);
  });

  it('keeps identities separate', async () => {
    for (let i = 0; i < 6; i++) await consume(burst, 'a');
    expect((await consume(burst, 'b')).allowed).toBe(true);
  });

  it('is shared between independent application instances', async () => {
    const a = pg.instance(), b = pg.instance();
    setRateLimitStore(a);
    for (let i = 0; i < 3; i++) await consume(burst, 'x');
    setRateLimitStore(b); // a different "process" with no in-memory state
    expect((await consume(burst, 'x')).allowed).toBe(true);  // 4th
    expect((await consume(burst, 'x')).allowed).toBe(true);  // 5th
    expect((await consume(burst, 'x')).allowed).toBe(false); // 6th — counted across both instances
  });

  it('simultaneous requests cannot exceed the budget', async () => {
    const results = await Promise.all(Array.from({ length: 25 }, () => consume(burst, 'race')));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it('recovers once the cooldown has passed', async () => {
    for (let i = 0; i < 6; i++) await consume(burst, 'rec');
    expect((await consume(burst, 'rec')).allowed).toBe(false);
    await pg.age(700); // window (600s) and first block (600s) are over
    expect((await consume(burst, 'rec')).allowed).toBe(true);
  });

  it('cooldowns grow with repeat offences but are capped, never permanent', async () => {
    const waits: number[] = [];
    for (let round = 0; round < 6; round++) {
      let last = await consume(burst, 'esc');
      for (let i = 0; i < 6 && last.allowed; i++) last = await consume(burst, 'esc');
      waits.push(last.retryAfterSec);
      await pg.age(last.retryAfterSec + 1);
    }
    expect(waits[1]).toBeGreaterThan(waits[0]);
    expect(waits[2]).toBeGreaterThan(waits[1]);
    expect(Math.max(...waits)).toBeLessThanOrEqual(burst.maxBlockSec);
    expect((await consume(burst, 'esc')).allowed).toBe(true); // always recoverable
  });

  it('failure-only buckets: check does not count, failures do, clear resets', async () => {
    for (let i = 0; i < 10; i++) expect((await check(failures, 'u')).allowed).toBe(true);
    expect(await pg.rows()).toHaveLength(0);
    for (let i = 0; i < 3; i++) await consume(failures, 'u');
    expect((await check(failures, 'u')).allowed).toBe(false);
    await clear(failures, 'u');
    expect((await check(failures, 'u')).allowed).toBe(true);
  });

  it('stores no emails or IP addresses', async () => {
    await consume(RULES.loginEmail, 'victim@example.com');
    await consume(RULES.loginIp, '203.0.113.7');
    const dump = JSON.stringify(await pg.rows());
    expect(dump).not.toContain('victim');
    expect(dump).not.toContain('203.0.113');
  });

  it('fails open (and raises an alert) if the store is unavailable', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setRateLimitStore(new PostgresRateLimitStore(async () => { throw new Error('connection refused'); }));
    expect((await consume(burst, 'z')).allowed).toBe(true);
    expect(spy.mock.calls.join(' ')).toContain('rate_limit.store_error');
    spy.mockRestore();
  });

  it('alerts when an identity keeps coming back after repeated blocks', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let round = 0; round < 3; round++) {
      let last = await consume(burst, 'noisy');
      for (let i = 0; i < 6 && last.allowed; i++) last = await consume(burst, 'noisy');
      await pg.age(last.retryAfterSec + 1);
    }
    expect(spy.mock.calls.join(' ')).toContain('"level":"alert"');
    spy.mockRestore(); warn.mockRestore();
  });
});

describe('429 response', () => {
  it('carries Retry-After and a readable message in both keys the forms read', async () => {
    const res = tooManyRequests({ allowed: false, limit: 5, remaining: 0, retryAfterSec: 720 }, 'sign-in attempts');
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('720');
    const body = await res.json();
    expect(body.error).toBe('Too many sign-in attempts. Please wait 12 minutes and try again.');
    expect(body.message).toBe(body.error);
    expect(body.retryAfterSeconds).toBe(720);
  });
  it.each([[20, 'a few seconds'], [60, '1 minute'], [61, '2 minutes'], [3600, '1 hour'], [7300, '3 hours']])('%is → %s', (s, t) => {
    expect(waitText(s)).toBe(t);
  });
});
