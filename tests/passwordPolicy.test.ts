import { describe, expect, it } from 'vitest';
import { passwordProblem, PASSWORD_MIN } from '@/lib/passwordPolicy';

describe('password policy', () => {
  it('accepts a reasonable password', () => {
    expect(passwordProblem('correct horse battery staple')).toBeNull();
    expect(passwordProblem('Tr0ub4dor&3xyz')).toBeNull();
  });
  it.each(['short', '123456789', 'a'.repeat(PASSWORD_MIN - 1)])('rejects %j as too short', (p) => {
    expect(passwordProblem(p)).toMatch(/at least/);
  });
  it.each(['password123', 'Password123', '1234567890', 'qwertyuiop', 'aaaaaaaaaaaa', 'admin12345'])('rejects the common password %j', (p) => {
    expect(passwordProblem(p)).toMatch(/too easy/);
  });
  it('rejects a password containing the email name', () => {
    expect(passwordProblem('ada.lovelace-2024!', { email: 'ada.lovelace@example.com' })).toMatch(/email/);
    expect(passwordProblem('something else entirely', { email: 'ada.lovelace@example.com' })).toBeNull();
  });
  it('rejects non-strings and absurdly long values', () => {
    expect(passwordProblem(undefined)).toBeTruthy();
    expect(passwordProblem('x'.repeat(201) + 'y1!')).toMatch(/200/);
  });
});
