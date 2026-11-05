import { readFileSync } from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { PostgresRateLimitStore } from '@/lib/rateLimit';

/** A real (in-process) Postgres running the exact rate_limits DDL from the production migration. */
export async function makePg() {
  const db = new PGlite();
  const sql = readFileSync(path.resolve(__dirname, '../prisma/migrations/20261105000000_abuse_protection/migration.sql'), 'utf8');
  const ddl = sql.slice(sql.indexOf('-- 1.'), sql.indexOf('-- 2.'));
  await db.exec(ddl);
  const exec = async (q: string, params: unknown[]) => (await db.query(q, params)).rows as Record<string, unknown>[];
  return {
    db,
    /** Each call is a separate "application instance" that shares only the database. */
    instance: () => new PostgresRateLimitStore(exec),
    /** Pretend `seconds` have passed for every bucket. */
    async age(seconds: number) {
      await db.exec(`UPDATE rate_limits SET window_start = window_start - interval '${seconds} seconds',
        blocked_until = blocked_until - interval '${seconds} seconds', updated_at = updated_at - interval '${seconds} seconds'`);
    },
    async rows() { return (await db.query('SELECT * FROM rate_limits')).rows as Record<string, unknown>[]; },
  };
}

/** For suites that don't care about throttling: never limits, never touches a database. */
export class NoopStore extends PostgresRateLimitStore {
  constructor() { super(async () => []); }
  async hit() { return { hits: 1, strikes: 0, windowLeft: 60, blockLeft: 0 }; }
  async escalate() { return null; }
  async peek() { return null; }
  async reset() {}
  async sweep() {}
}

/** The real schema, built by applying every migration in order to an in-process Postgres. */
export async function makeSchema() {
  const { readdirSync, existsSync } = await import('fs');
  const root = path.resolve(__dirname, '../prisma/migrations');
  const db = new PGlite();
  const files: string[] = [];
  for (const e of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.isDirectory() && existsSync(path.join(root, e.name, 'migration.sql'))) files.push(path.join(root, e.name, 'migration.sql'));
  }
  for (const f of files) await db.exec(readFileSync(f, 'utf8'));
  return { db, files };
}
