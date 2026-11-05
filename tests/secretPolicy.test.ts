import { describe, expect, it } from 'vitest';
import { validateAuthSecrets } from '@/lib/secretPolicy.mjs';
import { RESET, SESSION } from './helpers';

describe('auth secret policy', () => {
  it('accepts two long random, different secrets', () => {
    expect(validateAuthSecrets({ SESSION_SECRET: SESSION, RESET_SECRET: RESET }).ok).toBe(true);
  });
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['short', 'abc123def456'],
    ['the old default', 'change-me-in-production'],
    ['placeholder padded to length', 'your-secret-goes-here-please-0123456789'],
    ['repeated character', 'a'.repeat(64)],
  ])('rejects a %s SESSION_SECRET', (_n, v) => {
    expect(validateAuthSecrets({ SESSION_SECRET: v, RESET_SECRET: RESET }).ok).toBe(false);
  });
  it('rejects identical secrets', () => {
    const r = validateAuthSecrets({ SESSION_SECRET: SESSION, RESET_SECRET: SESSION });
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/different/);
  });
  it('never puts a secret value in the messages', () => {
    const r = validateAuthSecrets({ SESSION_SECRET: 'change-me-in-production', RESET_SECRET: 'short' });
    expect(JSON.stringify(r)).not.toContain('change-me-in-production');
    expect(JSON.stringify(r)).not.toContain('short"');
  });
});
