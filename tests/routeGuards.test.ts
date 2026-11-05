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

  it('only lib/clientIp.ts reads forwarded-IP headers (no route trusts them directly)', () => {
    const offenders = files.filter((f) => !/lib\/clientIp\.ts$/.test(f) && /x-forwarded-for|x-real-ip|x-vercel-forwarded-for/i.test(readFileSync(f, 'utf8')));
    expect(offenders.map(rel)).toEqual([]);
  });
  it('no per-process rate limiter is left in any route', () => {
    const offenders = files.filter((f) => /app\/api\//.test(f) && /new Map<string, \{ count: number/.test(readFileSync(f, 'utf8')));
    expect(offenders.map(rel)).toEqual([]);
  });
  it('every public/auth route that must be throttled uses the shared limiter', () => {
    const must = [
      'app/api/auth/login/route.ts', 'app/api/auth/request-code/route.ts', 'app/api/auth/forgot-password/route.ts',
      'app/api/auth/verify-code/route.ts', 'app/api/auth/update-password/route.ts', 'app/api/auth/set-password/route.ts',
      'app/api/auth/verify-reset-token/route.ts', 'app/api/inquiries/route.ts', 'app/api/inquiries/uploads/route.ts', 'app/api/share/[token]/files/[id]/comments/route.ts',
    ];
    for (const f of must) expect(readFileSync(path.join(root, f), 'utf8'), f).toMatch(/@\/lib\/rateLimit/);
  });
  it('the public share page only queries approved comments', () => {
    const src = readFileSync(path.join(root, 'app/share/[token]/page.tsx'), 'utf8');
    expect(src).toMatch(/PUBLIC_COMMENT_FILTER/);
  });
  it('email bodies are built only through the escaping templates', () => {
    const src = readFileSync(path.join(root, 'app/api/inquiries/route.ts'), 'utf8');
    expect(src).not.toMatch(/\$\{inquiry\.(name|email|description|company)\}/);
    expect(src).toMatch(/buildAdminInquiryEmail/);
  });
  it('every file route delivers bytes through the one shared delivery path', () => {
    for (const f of ['app/api/deliverables/[id]/route.ts', 'app/api/share/[token]/files/[id]/route.ts', 'app/api/admin/inquiries/[id]/attachments/[attachmentId]/route.ts']) {
      const src = readFileSync(path.join(root, f), 'utf8');
      expect(src, f).toMatch(/deliverFile\(/);
      expect(src, f).not.toMatch(/new NextResponse\(|\.data\b/);
    }
  });
  it('listings and downloads only ever see verified (READY) files', () => {
    for (const f of ['app/api/deliverables/[id]/route.ts', 'app/api/share/[token]/files/[id]/route.ts', 'app/(dashboard)/dashboard/page.tsx', 'app/share/[token]/page.tsx', 'app/(dashboard)/admin/page.tsx', 'lib/shareAccess.ts']) {
      expect(readFileSync(path.join(root, f), 'utf8'), f).toMatch(/status: 'READY'/);
    }
  });
  it('there is no unguarded way to hard-delete an inquiry', () => {
    const files2 = files.filter((f) => /app\/api\//.test(f) && /prisma\.inquiry\.delete\(|tx\.inquiry\.delete\(/.test(readFileSync(f, 'utf8')));
    expect(files2.map(rel)).toEqual(['app/api/admin/inquiries/[id]/purge/route.ts']);
  });
});
