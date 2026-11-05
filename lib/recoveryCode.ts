import { createHmac, timingSafeEqual } from 'crypto';
import { getResetSecret } from './secrets';

// Emailed codes are stored as a keyed hash (users.templogincode), never in clear text, so a database leak
// does not reveal a usable code. The hash is bound to the email so it can't be replayed for another account.
export const normalizeCode = (code: string) => code.toUpperCase().trim();

export function hashRecoveryCode(email: string, code: string): string {
  return createHmac('sha256', getResetSecret()).update(`code|${email.toLowerCase().trim()}|${normalizeCode(code)}`).digest('hex');
}

export function recoveryCodeMatches(email: string, submitted: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const a = Buffer.from(hashRecoveryCode(email, submitted));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}
