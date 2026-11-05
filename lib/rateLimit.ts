import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { getSessionSecret } from './secrets';
import { logRef, logSecurity } from './securityLog';

// One rate limiter for the whole app: counters live in Postgres (table rate_limits), so every serverless
// instance and every redeploy shares the same state. Each hit is a single atomic INSERT … ON CONFLICT
// UPDATE, so simultaneous requests cannot slip past the limit.
//
// A rule is a fixed window with progressive cooldown: once a bucket goes over budget it is blocked for
// the rest of the window, and each repeat offence within 24h doubles the block (capped at maxBlockSec).
// Blocks always expire — there is no permanent lockout.

export interface Rule {
  name: string;
  /** Allowed events per window. */
  limit: number;
  windowSec: number;
  /** Upper bound for the escalating cooldown. Must be >= windowSec. */
  maxBlockSec: number;
  /** true: only failures are recorded, and the bucket is checked *before* the attempt (see `check`). */
  failuresOnly?: boolean;
}

export interface Decision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
}

interface Row { hits: number; strikes: number; windowLeft: number; blockLeft: number }

type Exec = (sql: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

const num = (v: unknown) => Number(v ?? 0);
const toRow = (r: Record<string, unknown>): Row => ({ hits: num(r.hits), strikes: num(r.strikes), windowLeft: num(r.window_left), blockLeft: num(r.block_left) });

export class PostgresRateLimitStore {
  constructor(private exec: Exec) {}

  async hit(key: string, rule: Rule): Promise<Row> {
    const rows = await this.exec(
      `INSERT INTO rate_limits AS r (key, hits, window_start, strikes, blocked_until, updated_at)
       VALUES ($1, 1, now(), 0, NULL, now())
       ON CONFLICT (key) DO UPDATE SET
         hits         = CASE WHEN r.window_start <= now() - ($2::int * interval '1 second') THEN 1 ELSE r.hits + 1 END,
         window_start = CASE WHEN r.window_start <= now() - ($2::int * interval '1 second') THEN now() ELSE r.window_start END,
         strikes      = CASE WHEN r.updated_at <= now() - interval '24 hours' THEN 0 ELSE r.strikes END,
         blocked_until= CASE WHEN r.updated_at <= now() - interval '24 hours' THEN NULL ELSE r.blocked_until END,
         updated_at   = now()
       RETURNING hits, strikes,
         GREATEST(0, EXTRACT(EPOCH FROM (window_start + ($2::int * interval '1 second') - now())))::float8 AS window_left,
         GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (blocked_until - now())), 0))::float8 AS block_left`,
      [key, rule.windowSec],
    );
    return toRow(rows[0]);
  }

  /** Starts (or lengthens) the cooldown. Conditional, so only one of several simultaneous requests escalates. */
  async escalate(key: string, rule: Rule): Promise<Row | null> {
    const rows = await this.exec(
      `UPDATE rate_limits SET
         strikes = strikes + 1,
         blocked_until = now() + (LEAST($2::int * power(2, strikes), $3::int) * interval '1 second')
       WHERE key = $1 AND (blocked_until IS NULL OR blocked_until <= now())
       RETURNING hits, strikes, 0::float8 AS window_left,
         GREATEST(0, EXTRACT(EPOCH FROM (blocked_until - now())))::float8 AS block_left`,
      [key, rule.windowSec, rule.maxBlockSec],
    );
    return rows[0] ? toRow(rows[0]) : null;
  }

  async peek(key: string, rule: Rule): Promise<Row | null> {
    const rows = await this.exec(
      `SELECT CASE WHEN window_start <= now() - ($2::int * interval '1 second') THEN 0 ELSE hits END AS hits,
              strikes,
              GREATEST(0, EXTRACT(EPOCH FROM (window_start + ($2::int * interval '1 second') - now())))::float8 AS window_left,
              GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (blocked_until - now())), 0))::float8 AS block_left
       FROM rate_limits WHERE key = $1`,
      [key, rule.windowSec],
    );
    return rows[0] ? toRow(rows[0]) : null;
  }

  async reset(key: string): Promise<void> {
    await this.exec('DELETE FROM rate_limits WHERE key = $1', [key]);
  }

  async sweep(): Promise<void> {
    await this.exec(`DELETE FROM rate_limits WHERE updated_at < now() - interval '2 days' AND (blocked_until IS NULL OR blocked_until < now())`, []);
  }
}

let store = new PostgresRateLimitStore((sql, params) => prisma.$queryRawUnsafe(sql, ...params) as Promise<Record<string, unknown>[]>);
/** Tests point the limiter at an in-process Postgres; production uses the default. */
export function setRateLimitStore(s: PostgresRateLimitStore) { store = s; }

/** Identifiers are hashed before storage so the table holds no emails or IP addresses. */
function keyFor(rule: Rule, ...identity: string[]): string {
  let secret = 'rl-static-v1';
  try { secret = getSessionSecret(); } catch { /* public routes keep working if auth secrets are misconfigured */ }
  const digest = createHash('sha256').update(`${secret}|${identity.join('|').toLowerCase()}`).digest('hex').slice(0, 32);
  return `${rule.name}:${digest}`;
}

const exhausted = (rule: Rule, row: Row) => (rule.failuresOnly ? row.hits >= rule.limit : row.hits > rule.limit);

function decide(rule: Rule, row: Row | null): Decision {
  if (!row) return { allowed: true, limit: rule.limit, remaining: rule.limit, retryAfterSec: 0 };
  const over = exhausted(rule, row);
  const wait = Math.max(row.blockLeft, over ? row.windowLeft : 0);
  const allowed = !over && row.blockLeft <= 0;
  return { allowed, limit: rule.limit, remaining: Math.max(0, rule.limit - row.hits), retryAfterSec: allowed ? 0 : Math.max(1, Math.ceil(wait)) };
}

const ALLOW = (rule: Rule): Decision => ({ allowed: true, limit: rule.limit, remaining: rule.limit, retryAfterSec: 0 });

function storeFailed(rule: Rule, err: unknown): Decision {
  // The limiter must never take sign-in or the contact form down with it. Fail open, loudly.
  logSecurity('rate_limit.store_error', { rule: rule.name, error: err instanceof Error ? err.message.slice(0, 160) : 'unknown' }, 'alert');
  return ALLOW(rule);
}

/** Records one event for the bucket and says whether it is (still) within budget. */
export async function consume(rule: Rule, ...identity: string[]): Promise<Decision> {
  try {
    const key = keyFor(rule, ...identity);
    let row = await store.hit(key, rule);
    if (exhausted(rule, row) && row.blockLeft <= 0) {
      const escalated = await store.escalate(key, rule);
      if (escalated) {
        row = { ...row, strikes: escalated.strikes, blockLeft: escalated.blockLeft };
        const burst = row.hits >= rule.limit * 10;
        logSecurity('rate_limit.blocked', {
          rule: rule.name, ref: logRef(identity.join('|')), hits: row.hits, strikes: row.strikes, blockSec: Math.ceil(row.blockLeft),
        }, row.strikes >= 3 || burst ? 'alert' : 'info');
      }
    }
    if (Math.random() < 0.01) store.sweep().catch(() => {});
    return decide(rule, row);
  } catch (err) {
    return storeFailed(rule, err);
  }
}

/** Looks at a bucket without recording anything — used before an attempt for `failuresOnly` rules. */
export async function check(rule: Rule, ...identity: string[]): Promise<Decision> {
  try {
    return decide(rule, await store.peek(keyFor(rule, ...identity), rule));
  } catch (err) {
    return storeFailed(rule, err);
  }
}

/** Forgets a bucket (e.g. after a successful sign-in clears that account's failure count). */
export async function clear(rule: Rule, ...identity: string[]): Promise<void> {
  try { await store.reset(keyFor(rule, ...identity)); } catch (err) { storeFailed(rule, err); }
}

/** The most restrictive decision of several, or the first denial. */
export const firstDenied = (...ds: Decision[]) => ds.find((d) => !d.allowed) ?? null;

export function waitText(sec: number): string {
  if (sec < 60) return 'a few seconds';
  const min = Math.ceil(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'}`;
  const hrs = Math.ceil(min / 60);
  return `${hrs} hour${hrs === 1 ? '' : 's'}`;
}

/** Standard 429. `error` and `message` both carry the text because the app's forms read different keys. */
export function tooManyRequests(d: Decision, what = 'attempts'): NextResponse {
  const text = `Too many ${what}. Please wait ${waitText(d.retryAfterSec)} and try again.`;
  return NextResponse.json(
    { ok: false, error: text, message: text, retryAfterSeconds: d.retryAfterSec },
    { status: 429, headers: { 'Retry-After': String(d.retryAfterSec), 'Cache-Control': 'no-store' } },
  );
}

/* ── Budgets ───────────────────────────────────────────────────────────────────
   IP rules protect against one source; account rules protect against many sources hitting one account.
   Account rules count failures only, so a victim's correct password isn't spent by an attacker's guesses,
   and every block expires (15 min first offence, doubling to at most 1 h).                              */
const MIN = 60;
export const RULES = {
  loginIp:           { name: 'login.ip',            limit: 30, windowSec: 15 * MIN, maxBlockSec: 60 * MIN },
  loginIpEmail:      { name: 'login.ip-email',      limit: 5,  windowSec: 15 * MIN, maxBlockSec: 60 * MIN, failuresOnly: true },
  loginEmail:        { name: 'login.email',         limit: 10, windowSec: 15 * MIN, maxBlockSec: 60 * MIN, failuresOnly: true },

  // Re-entering a current password to change it: a few wrong tries per account, then a cooldown that always expires.
  accountReauth:     { name: 'account.reauth', limit: 5, windowSec: 15 * MIN, maxBlockSec: 60 * MIN, failuresOnly: true },

  // Shared by forgot-password and request-code so the two together cannot flood one mailbox.
  recoveryEmailIp:   { name: 'recovery.send.ip',    limit: 10, windowSec: 60 * MIN, maxBlockSec: 240 * MIN },
  recoveryEmail:     { name: 'recovery.send.email', limit: 3,  windowSec: 60 * MIN, maxBlockSec: 240 * MIN },

  codeIp:            { name: 'recovery.code.ip',        limit: 30, windowSec: 15 * MIN, maxBlockSec: 60 * MIN },
  codeIpEmail:       { name: 'recovery.code.ip-email',  limit: 5,  windowSec: 15 * MIN, maxBlockSec: 60 * MIN, failuresOnly: true },
  codeEmail:         { name: 'recovery.code.email',     limit: 10, windowSec: 15 * MIN, maxBlockSec: 60 * MIN, failuresOnly: true },
  linkIp:            { name: 'recovery.link.ip',        limit: 30, windowSec: 15 * MIN, maxBlockSec: 60 * MIN },

  inquiryIp:         { name: 'inquiry.ip',    limit: 8, windowSec: 10 * MIN, maxBlockSec: 120 * MIN },
  inquiryEmail:      { name: 'inquiry.email', limit: 3, windowSec: 60 * MIN, maxBlockSec: 240 * MIN },
  // Each grant allows up to 5 files of 10 MB into storage before anything is submitted, so it is budgeted tightly.
  inquiryUploadIp:   { name: 'inquiry.upload.ip', limit: 4, windowSec: 10 * MIN, maxBlockSec: 120 * MIN },

  commentIp:         { name: 'comment.ip',       limit: 10, windowSec: 10 * MIN, maxBlockSec: 120 * MIN },
  commentIpFile:     { name: 'comment.ip-file',  limit: 5,  windowSec: 10 * MIN, maxBlockSec: 120 * MIN },
  commentLink:       { name: 'comment.link',     limit: 60, windowSec: 60 * MIN, maxBlockSec: 240 * MIN },
} satisfies Record<string, Rule>;
