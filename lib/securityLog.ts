import { createHash } from 'crypto';

/** Short, one-way reference for an identifier (email, IP). Lets logs be correlated without storing personal data. */
export const logRef = (value: string) => createHash('sha256').update(`log:v1:${value}`).digest('hex').slice(0, 12);

type Fields = Record<string, string | number | boolean | null | undefined>;

/**
 * One JSON line per security-relevant event, prefixed `[security]` so a log drain can filter on it.
 * Callers must pass references (logRef) and counts — never emails, IP addresses, passwords or message text.
 * Events logged at 'alert' level go to stderr and are meant to drive notifications.
 */
export function logSecurity(event: string, fields: Fields = {}, level: 'info' | 'alert' = 'info') {
  const line = `[security] ${JSON.stringify({ at: new Date().toISOString(), level, ...fields, event })}`;
  if (level === 'alert') console.error(line);
  else console.warn(line);
}
