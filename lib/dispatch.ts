import { after } from 'next/server';
import { processOutbox } from './emailOutbox';

/**
 * Starts sending queued email right after the response, for speed. This is an optimisation, not the guarantee:
 * the email is already safely in the outbox, and the cron job / admin Retry will pick up anything that didn't go.
 * `after()` is Next's supported way to keep a serverless function alive for post-response work.
 */
export function dispatchOutbox(): void {
  const work = () => processOutbox().then(() => undefined).catch((err) => console.error('[outbox] dispatch failed:', err instanceof Error ? err.message : err));
  try {
    after(work);
  } catch {
    void work(); // outside a request (scripts, tests)
  }
}
