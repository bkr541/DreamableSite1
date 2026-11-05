import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === '.next' || f === 'tests') continue;
    const p = path.join(dir, f);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const rel = (p: string) => path.relative(root, p);
const files = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'lib'))].filter((f) => /\.(ts|tsx)$/.test(f));

describe('authorization is centralised', () => {
  it('every admin API route and the approve route uses requireAdmin', () => {
    const routes = files.filter((f) => /app\/api\/admin\/.*route\.ts$/.test(f) || /inquiries\/\[id\]\/approve\/route\.ts$/.test(f));
    expect(routes.length).toBeGreaterThan(10);
    for (const f of routes) expect(readFileSync(f, 'utf8'), rel(f)).toMatch(/requireAdmin\(req\)/);
  });
  it('only lib/authz.ts reads raw session claims', () => {
    const offenders = files.filter((f) => !/lib\/(authz|session)\.ts$/.test(f) && /getSessionClaims(FromRequest)?\b/.test(readFileSync(f, 'utf8')));
    expect(offenders.map(rel)).toEqual([]);
  });
  it('no source file hardcodes a fallback secret', () => {
    const offenders = files.filter((f) => /change-me-in-production/.test(readFileSync(f, 'utf8')));
    expect(offenders.map(rel)).toEqual([]);
  });
  it('admin and customer pages use the guarded helpers', () => {
    expect(readFileSync(path.join(root, 'app/(dashboard)/admin/page.tsx'), 'utf8')).toMatch(/requireAdminPage\(\)/);
    expect(readFileSync(path.join(root, 'app/(dashboard)/dashboard/page.tsx'), 'utf8')).toMatch(/requireClientPage\(\)/);
  });
});
