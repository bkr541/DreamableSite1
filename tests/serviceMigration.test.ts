import { readdirSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

// The canonical-services migration, run on a deliberately messy copy of "production": old spellings, odd casing and
// spacing, a legacy duplicate in the services table, and a service nobody has heard of. Nothing may be lost.

const root = path.resolve(__dirname, '../prisma/migrations');
const MIGRATION = '20261105050000_canonical_services';
const sql = () => readFileSync(path.join(root, MIGRATION, 'migration.sql'), 'utf8');
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let db: PGlite;
const q = async (text: string) => (await db.query(text)).rows as Record<string, any>[];

beforeAll(async () => {
  db = new PGlite();
  for (const e of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.isDirectory() && e.name < MIGRATION && existsSync(path.join(root, e.name, 'migration.sql'))) await db.exec(readFileSync(path.join(root, e.name, 'migration.sql'), 'utf8'));
  }
  await db.exec(`
    INSERT INTO inquiries (id, name, email, service, description) VALUES
      ('${id(1)}', 'A', 'a@x.co', 'Branding & Identity',     'x'),
      ('${id(2)}', 'B', 'b@x.co', 'Branding & Logo',         'x'),
      ('${id(3)}', 'C', 'c@x.co', ' branding and LOGO ',     'x'),
      ('${id(4)}', 'D', 'd@x.co', 'Brand Identity',          'x'),
      ('${id(5)}', 'E', 'e@x.co', 'Marketing & Ads',         'x'),
      ('${id(6)}', 'F', 'f@x.co', 'ui/ux design',            'x'),
      ('${id(7)}', 'G', 'g@x.co', 'Podcast Production',      'x'),
      ('${id(8)}', 'H', 'h@x.co', 'Branding',                'x');
    INSERT INTO companies (id, name) VALUES ('${id(50)}', 'Acme');
    INSERT INTO users (id, name, email, company_id, status) VALUES ('${id(60)}', 'Jane', 'jane@acme.co', '${id(50)}', 'ACTIVE');
    INSERT INTO projects (id, company_id, primary_user_id, name, service, description) VALUES
      ('${id(21)}', '${id(50)}', '${id(60)}', 'P1', 'Branding & Identity', 'x'),
      ('${id(22)}', '${id(50)}', '${id(60)}', 'P2', 'App or Web Development', 'x'),
      ('${id(23)}', '${id(50)}', '${id(60)}', 'P3', 'Mystery Service', 'x');
    INSERT INTO services (id, name, "order") VALUES
      ('${id(31)}', 'Branding & Identity', 1), ('${id(32)}', 'Brand Identity', 2), ('${id(33)}', 'Consulting', 3), ('${id(34)}', 'Branding & Logo', 4);
    INSERT INTO service_sub_categories (service_id, name, "order") VALUES
      ('${id(31)}', 'Shared Offer', 0), ('${id(31)}', 'Legacy Only Offer', 1),
      ('${id(32)}', 'Shared Offer', 0),
      ('${id(34)}', 'Another Legacy Offer', 0);
  `);
  await db.exec(sql());
}, 60_000);

describe('inquiries and projects', () => {
  it('rewrites every recognised spelling to the canonical name and nothing else', async () => {
    const rows = await q(`SELECT id, service FROM inquiries ORDER BY id`);
    expect(rows.map((r) => r.service)).toEqual([
      'Brand Identity', 'Brand Identity', 'Brand Identity', 'Brand Identity', 'Marketing & Ads', 'UI/UX Design',
      'Podcast Production', // unknown: kept exactly
      'Branding', // not a recognised alias: kept exactly (we never guess)
    ]);
  });

  it('never deletes or duplicates a row', async () => {
    expect((await q(`SELECT count(*)::int AS n FROM inquiries`))[0].n).toBe(8);
    expect((await q(`SELECT count(*)::int AS n FROM projects`))[0].n).toBe(3);
    expect((await q(`SELECT service FROM projects ORDER BY name`)).map((r) => r.service)).toEqual(['Brand Identity', 'App or Web Development', 'Mystery Service']);
  });

  it('records every change (old and new value) in the audit table', async () => {
    const a = await q(`SELECT table_name, old_value, new_value FROM service_migration_audit WHERE table_name IN ('inquiries','projects') ORDER BY table_name, old_value`);
    expect(a).toEqual([
      { table_name: 'inquiries', old_value: ' branding and LOGO ', new_value: 'Brand Identity' },
      { table_name: 'inquiries', old_value: 'Branding & Identity', new_value: 'Brand Identity' },
      { table_name: 'inquiries', old_value: 'Branding & Logo', new_value: 'Brand Identity' },
      { table_name: 'inquiries', old_value: 'ui/ux design', new_value: 'UI/UX Design' },
      { table_name: 'projects', old_value: 'Branding & Identity', new_value: 'Brand Identity' },
    ]);
  });
});

describe('the services table', () => {
  it('leaves one Brand Identity row, with every sub-category from the legacy rows (no duplicates)', async () => {
    const names = (await q(`SELECT name FROM services ORDER BY "order"`)).map((r) => r.name);
    expect(names).toEqual(['Brand Identity', 'Consulting']);
    const subs = (await q(`SELECT service_id, name FROM service_sub_categories ORDER BY name`));
    expect(subs.every((s) => s.service_id === id(32))).toBe(true);
    expect(subs.map((s) => s.name)).toEqual(['Another Legacy Offer', 'Legacy Only Offer', 'Shared Offer']);
  });

  it('records the merged rows', async () => {
    const a = await q(`SELECT old_value, new_value FROM service_migration_audit WHERE table_name = 'services' ORDER BY old_value`);
    expect(a).toEqual([{ old_value: 'Branding & Identity', new_value: 'Brand Identity' }, { old_value: 'Branding & Logo', new_value: 'Brand Identity' }]);
  });
});

describe('re-running', () => {
  it('is a no-op the second time (no new audit rows, no changes)', async () => {
    const before = await q(`SELECT (SELECT count(*)::int FROM service_migration_audit) AS audit, (SELECT string_agg(service, ',' ORDER BY id) FROM inquiries) AS inq`);
    await db.exec(sql());
    const after = await q(`SELECT (SELECT count(*)::int FROM service_migration_audit) AS audit, (SELECT string_agg(service, ',' ORDER BY id) FROM inquiries) AS inq`);
    expect(after).toEqual(before);
  });

  it('renames a lone legacy services row in place (keeping its id and sub-categories)', async () => {
    const d = new PGlite();
    for (const e of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isDirectory() && e.name < MIGRATION && existsSync(path.join(root, e.name, 'migration.sql'))) await d.exec(readFileSync(path.join(root, e.name, 'migration.sql'), 'utf8'));
    }
    await d.exec(`INSERT INTO services (id, name, "order") VALUES ('${id(71)}', 'Branding & Identity', 1);
                  INSERT INTO service_sub_categories (service_id, name, "order") VALUES ('${id(71)}', 'Custom', 0);`);
    await d.exec(sql());
    const rows = (await d.query(`SELECT id, name FROM services`)).rows as any[];
    expect(rows).toEqual([{ id: id(71), name: 'Brand Identity' }]);
    expect(((await d.query(`SELECT count(*)::int AS n FROM service_sub_categories WHERE service_id = '${id(71)}'`)).rows as any[])[0].n).toBe(1);
  });
});
