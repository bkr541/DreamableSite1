import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. With no (or a short) secret configured, every call is refused. */
export function isAuthorizedCron(req: NextRequest, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
