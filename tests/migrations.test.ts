import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { makeSchema } from './pg';

let db: Awaited<ReturnType<typeof makeSchema>>['db'];
const INQ = '10000000-0000-4000-8000-000000000001';
const FOLDER = '20000000-0000-4000-8000-000000000001';

const q = async (sql: string) => (await db.query(sql)).rows as Record<string, any>[];
const fails = async (sql: string) => { try { await db.exec(sql); return null; } catch (e) { return String((e as Error).message); } };

beforeEach(async () => {
  ({ db } = await makeSchema());
  await db.exec(`INSERT INTO inquiries (id, name, email, service, description) VALUES ('${INQ}', 'Ada', 'ada@example.com', 'Branding', 'x')`);
});

describe('migration safety (real Postgres, real schema)', () => {
  it('the new migrations are idempotent — running them again changes nothing and errors nothing', async () => {
    for (const dir of ['20261105000000_abuse_protection', '20261105010000_files_sharing_archive']) {
      const sql = readFileSync(path.resolve(__dirname, `../prisma/migrations/${dir}/migration.sql`), 'utf8');
      await db.exec(sql);
      await db.exec(sql);
    }
  });

  it('pre-existing files stay READY and keep their bytes', async () => {
    await db.exec(`INSERT INTO deliverables (id, inquiry_id, file_name, content_type, size, data) VALUES ('30000000-0000-4000-8000-000000000001', '${INQ}', 'a.png', 'image/png', 3, '\\x010203')`);
    const [row] = await q(`SELECT status, storage_key, data FROM deliverables`);
    expect(row.status).toBe('READY');
    expect(row.storage_key).toBeNull();
    expect(row.data.length).toBe(3);
    expect(await q(`SELECT 1 FROM deliverables WHERE data IS NULL AND storage_key IS NULL`)).toHaveLength(0);
  });

  it('a storage-backed file needs no bytes in the database, and a pending public upload needs no inquiry yet', async () => {
    await db.exec(`INSERT INTO deliverables (inquiry_id, file_name, content_type, size, storage_key, status) VALUES ('${INQ}', 'a.png', 'image/png', 3, 'deliverables/x', 'PENDING')`);
    await db.exec(`INSERT INTO inquiry_attachments (file_name, content_type, size, storage_key, status) VALUES ('b.pdf', 'application/pdf', 3, 'inquiries/y', 'PENDING')`);
    expect(await q(`SELECT count(*)::int AS n FROM inquiry_attachments WHERE inquiry_id IS NULL`)).toEqual([{ n: 1 }]);
  });

  it('two files cannot share one stored object', async () => {
    await db.exec(`INSERT INTO deliverables (inquiry_id, file_name, content_type, size, storage_key) VALUES ('${INQ}', 'a', 'x', 1, 'deliverables/same')`);
    expect(await fails(`INSERT INTO deliverables (inquiry_id, file_name, content_type, size, storage_key) VALUES ('${INQ}', 'b', 'x', 1, 'deliverables/same')`)).toMatch(/unique|duplicate/i);
  });
});

describe('deleting an inquiry can no longer take client work with it', () => {
  async function seedWork() {
    await db.exec(`INSERT INTO deliverable_folders (id, inquiry_id, name, share_token) VALUES ('${FOLDER}', '${INQ}', 'Wordmark', 'tok1')`);
    await db.exec(`INSERT INTO deliverables (inquiry_id, folder_id, file_name, content_type, size, data) VALUES ('${INQ}', '${FOLDER}', 'a.png', 'image/png', 1, '\\x01')`);
  }

  it('the database refuses to delete an inquiry that has folders or files (they used to cascade away)', async () => {
    await seedWork();
    expect(await fails(`DELETE FROM inquiries WHERE id = '${INQ}'`)).toMatch(/foreign key|violates/i);
    expect(await q(`SELECT 1 FROM deliverables`)).toHaveLength(1);
    expect(await q(`SELECT 1 FROM deliverable_folders`)).toHaveLength(1);
  });

  it('archiving changes only the archive columns — the project, client, folders and files are untouched', async () => {
    await seedWork();
    await db.exec(`INSERT INTO companies (id, inquiry_id, name) VALUES ('40000000-0000-4000-8000-000000000001', '${INQ}', 'Acme')`);
    await db.exec(`INSERT INTO users (id, inquiry_id, company_id, name, email) VALUES ('50000000-0000-4000-8000-000000000001', '${INQ}', '40000000-0000-4000-8000-000000000001', 'Ada', 'ada@example.com')`);
    await db.exec(`INSERT INTO projects (id, inquiry_id, company_id, primary_user_id, name, service, description) VALUES ('60000000-0000-4000-8000-000000000001', '${INQ}', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'P', 'Branding', 'x')`);
    const snapshot = async () => JSON.stringify([await q(`SELECT * FROM projects`), await q(`SELECT * FROM users`), await q(`SELECT * FROM companies`), await q(`SELECT id, inquiry_id, folder_id, status FROM deliverables`), await q(`SELECT * FROM deliverable_folders`)]);
    const before = await snapshot();
    await db.exec(`UPDATE inquiries SET archived_at = now() WHERE id = '${INQ}'`);
    expect(await snapshot()).toBe(before);
    await db.exec(`UPDATE inquiries SET archived_at = NULL WHERE id = '${INQ}'`);
    expect(await snapshot()).toBe(before);
    expect((await q(`SELECT id FROM inquiries WHERE archived_at IS NULL`))).toHaveLength(1);
  });

  it('an inquiry with no delivered work can still be removed (and only its own attachments go with it)', async () => {
    await db.exec(`INSERT INTO inquiry_attachments (inquiry_id, file_name, content_type, size, data) VALUES ('${INQ}', 'b.pdf', 'application/pdf', 1, '\\x01')`);
    await db.exec(`DELETE FROM inquiries WHERE id = '${INQ}'`);
    expect(await q(`SELECT 1 FROM inquiry_attachments`)).toHaveLength(0);
  });

  it('deleting a PROJECT is still an explicit act that removes that project’s own folders and files', async () => {
    await db.exec(`INSERT INTO companies (id, name) VALUES ('40000000-0000-4000-8000-000000000002', 'Co')`);
    await db.exec(`INSERT INTO projects (id, company_id, name, service, description) VALUES ('60000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'P', 's', 'd')`);
    await db.exec(`INSERT INTO deliverable_folders (id, project_id, name, share_token) VALUES ('${FOLDER}', '60000000-0000-4000-8000-000000000002', 'F', 'tok2')`);
    await db.exec(`INSERT INTO deliverables (project_id, folder_id, file_name, content_type, size, data) VALUES ('60000000-0000-4000-8000-000000000002', '${FOLDER}', 'a', 'x', 1, '\\x01')`);
    await db.exec(`DELETE FROM projects WHERE id = '60000000-0000-4000-8000-000000000002'`);
    expect(await q(`SELECT 1 FROM deliverables`)).toHaveLength(0);
  });
});

describe('share token uniqueness', () => {
  it('two folders can never hold the same token, so a rotated token can’t collide with a live one', async () => {
    await db.exec(`INSERT INTO deliverable_folders (inquiry_id, name, share_token) VALUES ('${INQ}', 'A', 'dup')`);
    expect(await fails(`INSERT INTO deliverable_folders (inquiry_id, name, share_token) VALUES ('${INQ}', 'B', 'dup')`)).toMatch(/unique|duplicate/i);
  });
});
