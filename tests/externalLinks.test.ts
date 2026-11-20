import { readdirSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (f: string) => readFileSync(path.join(root, f), 'utf8');
const MIGRATION = '20261119000000_external_links';

describe('the migration', () => {
  it('adds the three columns, leaves data alone, and can be run twice', async () => {
    const db = new PGlite();
    const dir = path.join(root, 'prisma/migrations');
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isDirectory() && e.name < MIGRATION && existsSync(path.join(dir, e.name, 'migration.sql'))) await db.exec(readFileSync(path.join(dir, e.name, 'migration.sql'), 'utf8'));
    }
    await db.exec(`INSERT INTO inquiries (id, name, email, service, description) VALUES ('00000000-0000-4000-8000-000000000001', 'A', 'a@x.co', 'Other', 'x')`);
    const sql = read(`prisma/migrations/${MIGRATION}/migration.sql`);
    await db.exec(sql);
    await db.exec(sql);
    const cols = (await db.query(`SELECT table_name FROM information_schema.columns WHERE column_name = 'external_link' ORDER BY 1`)).rows.map((r) => (r as { table_name: string }).table_name);
    expect(cols).toEqual(['deliverable_folders', 'deliverables', 'projects']);
    expect(((await db.query('SELECT count(*)::int n FROM inquiries')).rows[0] as { n: number }).n).toBe(1);
    expect(read('prisma/APPLY_ALL_PENDING.sql')).toContain(`-- ${MIGRATION}`);
  });
});

describe('every place a link can be set validates it on the server', () => {
  it.each([
    'app/api/admin/projects/route.ts',
    'app/api/admin/projects/[id]/route.ts',
    'app/api/admin/deliverable-folders/route.ts',
    'app/api/admin/deliverable-folders/[id]/route.ts',
    'app/api/admin/deliverables/[id]/route.ts',
    'app/api/admin/deliverables/uploads/route.ts',
    'app/api/admin/deliverables/route.ts',
  ])('%s', (f) => {
    const src = read(f);
    expect(src).toContain('normalizeExternalLink(');
    if (!/uploads|deliverables\/route/.test(f)) expect(src).toMatch(/requireAdmin\(req\)/);
  });
  it('the project link can be changed later (PATCH) and is audited', () => {
    const src = read('app/api/admin/projects/[id]/route.ts');
    expect(src).toMatch(/export async function PATCH/);
    expect(src).toContain("action: 'project.update_external_link'");
  });
});

describe('links are shown safely', () => {
  it('open in a new tab without handing the page to the destination', () => {
    const src = read('components/ExternalLink.tsx');
    expect(src).toContain('target="_blank"');
    expect(src).toContain('rel="noopener noreferrer"');
    expect(src).not.toContain('dangerouslySetInnerHTML');
  });
  it('appear on the admin project info page and in the client portal', () => {
    expect(read('app/(dashboard)/admin/AdminDashboardClient.tsx')).toContain('<ProjectExternalLinks');
    const portal = read('app/(dashboard)/dashboard/CustomerDashboardClient.tsx');
    expect(portal).toContain('project.externalLink');
    expect(portal).toContain('g.link');
    expect(portal).toContain('d.externalLink');
  });
  it('are not shown on the public share page (anyone with that link can open it)', () => {
    expect(read('app/share/[token]/page.tsx')).not.toContain('externalLink');
  });
});
