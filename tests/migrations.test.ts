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
    for (const dir of ['20261105000000_abuse_protection', '20261105010000_files_sharing_archive', '20261105020000_email_outbox_notifications', '20261105030000_review_and_invitations']) {
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

describe('outbox and notification tables (real Postgres)', () => {
  it('the same email event can only exist once, so a retried request cannot queue it twice', async () => {
    const insert = `INSERT INTO email_outbox (event_type, recipient, dedupe_key) VALUES ('inquiry.notification', 'a@b.co', 'inquiry.notification:1') ON CONFLICT (dedupe_key) DO NOTHING`;
    await db.exec(insert); await db.exec(insert);
    expect(await q(`SELECT status, attempts, max_attempts FROM email_outbox`)).toEqual([{ status: 'PENDING', attempts: 0, max_attempts: 8 }]);
    expect(await fails(`INSERT INTO email_outbox (event_type, recipient, dedupe_key) VALUES ('x', 'a@b.co', 'inquiry.notification:1')`)).toMatch(/unique|duplicate/i);
  });
  it('the same notification event can only exist once; read state goes away with the notification', async () => {
    await db.exec(`INSERT INTO admin_notifications (type, title, url, dedupe_key) VALUES ('inquiry.new', 'New inquiry', '/admin', 'inquiry.new:1') ON CONFLICT (dedupe_key) DO NOTHING`);
    await db.exec(`INSERT INTO admin_notifications (type, title, url, dedupe_key) VALUES ('inquiry.new', 'New inquiry', '/admin', 'inquiry.new:1') ON CONFLICT (dedupe_key) DO NOTHING`);
    const [{ id }] = await q(`SELECT id FROM admin_notifications`);
    expect(await q(`SELECT 1 FROM admin_notifications`)).toHaveLength(1);
    await db.exec(`INSERT INTO notification_reads (notification_id, user_id) VALUES ('${id}', '${INQ}')`);
    expect(await fails(`INSERT INTO notification_reads (notification_id, user_id) VALUES ('${id}', '${INQ}')`)).toMatch(/unique|duplicate|primary/i);
    // "unread for this admin" is exactly what the app asks for:
    expect(await q(`SELECT 1 FROM admin_notifications n WHERE NOT EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.user_id = '${INQ}')`)).toHaveLength(0);
    expect(await q(`SELECT 1 FROM admin_notifications n WHERE NOT EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.user_id = '${FOLDER}')`)).toHaveLength(1);
    await db.exec(`DELETE FROM admin_notifications`);
    expect(await q(`SELECT 1 FROM notification_reads`)).toHaveLength(0);
  });
});

describe('review and invitation migration (real Postgres)', () => {
  const USER = '70000000-0000-4000-8000-0000000000aa';
  const ins = (id: string, email: string, status: string, extra = '') =>
    db.exec(`INSERT INTO users (id, name, email, status, password_hash${extra ? ', ' + extra.split('=')[0] : ''}) VALUES ('${id}', 'N', '${email}', '${status}', 'salt:hash'${extra ? ', ' + extra.split('=')[1] : ''})`);

  it('clears the unknowable password of never-signed-in invited clients, and nobody else', async () => {
    await ins('70000000-0000-4000-8000-000000000001', 'new@x.co', 'INVITED');
    await ins('70000000-0000-4000-8000-000000000002', 'seen@x.co', 'INVITED', "last_login_at=now()");
    await ins('70000000-0000-4000-8000-000000000003', 'active@x.co', 'ACTIVE');
    await ins('70000000-0000-4000-8000-000000000004', 'admin@x.co', 'INVITED', 'admin=true');
    await db.exec(`UPDATE users SET password_hash = NULL WHERE status = 'INVITED' AND last_login_at IS NULL AND admin = false AND password_hash IS NOT NULL`);   // the backfill statement
    const rows = Object.fromEntries((await q(`SELECT email, password_hash FROM users`)).map((r) => [r.email, r.password_hash]));
    expect(rows['new@x.co']).toBeNull();
    expect(rows['seen@x.co']).toBe('salt:hash');
    expect(rows['active@x.co']).toBe('salt:hash');
    expect(rows['admin@x.co']).toBe('salt:hash');
  });

  it('existing tokens become password-reset tokens; invitations and rejections have somewhere to live', async () => {
    await ins(USER, 'u@x.co', 'ACTIVE');
    await db.exec(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ('${USER}', 'h1', now() + interval '1 hour')`);
    expect(await q(`SELECT purpose FROM password_reset_tokens`)).toEqual([{ purpose: 'RESET' }]);
    await db.exec(`UPDATE inquiries SET status = 'REJECTED', rejected_at = now(), rejection_reason = 'no fit' WHERE id = '${INQ}'`);
    expect(await q(`SELECT status, rejection_reason FROM inquiries`)).toEqual([{ status: 'REJECTED', rejection_reason: 'no fit' }]);
  });
});
