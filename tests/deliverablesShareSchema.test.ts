import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('adds opt-in project shares with unique tokens, project ownership, RLS, and cascading cleanup', async () => {
  const db = new PGlite();
  const sql = readFileSync(path.resolve(__dirname, '../prisma/migrations/20261116000000_deliverables_sharing/migration.sql'), 'utf8');
  const project = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  try {
    await db.exec(`CREATE TABLE projects (id UUID PRIMARY KEY); INSERT INTO projects VALUES ('${project}'), ('${other}');`);
    await db.exec(sql);
    await db.exec(sql); // safe for the SQL-editor deployment workflow too
    await db.query('INSERT INTO deliverables_shares (project_id, share_token) VALUES ($1, $2)', [project, 'unique-token']);
    expect((await db.query<{ is_public: boolean }>('SELECT is_public FROM deliverables_shares')).rows[0].is_public).toBe(false);
    await expect(db.query('INSERT INTO deliverables_shares (project_id, share_token) VALUES ($1, $2)', [project, 'different-token'])).rejects.toThrow();
    await expect(db.query('INSERT INTO deliverables_shares (project_id, share_token) VALUES ($1, $2)', [other, 'unique-token'])).rejects.toThrow();
    await expect(db.query('INSERT INTO deliverables_shares (share_token) VALUES ($1)', ['ownerless-token'])).rejects.toThrow();
    await expect(db.query('INSERT INTO deliverables_shares (project_id, share_token) VALUES ($1, $2)', ['cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'missing-project'])).rejects.toThrow();
    expect((await db.query<{ relrowsecurity: boolean }>("SELECT relrowsecurity FROM pg_class WHERE relname = 'deliverables_shares'")).rows[0].relrowsecurity).toBe(true);
    await db.query('DELETE FROM projects WHERE id = $1', [project]);
    expect((await db.query('SELECT * FROM deliverables_shares')).rows).toHaveLength(0);
  } finally { await db.close(); }
});
