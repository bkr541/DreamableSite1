import { createHmac, randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { getResetSecret } from './secrets';

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// The emailed token is 32 random bytes. Only a keyed hash is stored, so a database leak does not yield usable
// links, and rotating RESET_SECRET invalidates every outstanding link at once.
export const generateResetToken = () => randomBytes(32).toString('base64url');

export function hashResetToken(token: string): string {
  return createHmac('sha256', getResetSecret()).update(token).digest('hex');
}

/** Replaces any earlier unused links for the user with one new link. Returns the raw token to email. */
export async function issueResetToken(userId: string): Promise<string> {
  const token = generateResetToken();
  const tokenHash = hashResetToken(token);
  const now = new Date();
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } }),
    prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS) } }),
  ]);
  return token;
}

export type TokenLookup =
  | { state: 'valid'; id: string; user: { id: string; status: string } }
  | { state: 'expired' }
  | { state: 'invalid' };

/** Read-only check used by the reset page. Does not consume the token. */
export async function lookupResetToken(token: unknown): Promise<TokenLookup> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return { state: 'invalid' };
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { id: true, expiresAt: true, consumedAt: true, user: { select: { id: true, status: true } } },
  });
  // Used, replaced and unknown links all look the same from outside.
  if (!row || row.consumedAt) return { state: 'invalid' };
  if (row.expiresAt.getTime() <= Date.now()) return { state: 'expired' };
  return { state: 'valid', id: row.id, user: row.user };
}

/** Atomically claims the token inside a transaction. Returns false if someone else got there first. */
export async function consumeResetToken(tx: Prisma.TransactionClient, id: string): Promise<boolean> {
  const { count } = await tx.passwordResetToken.updateMany({
    where: { id, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  return count === 1;
}
