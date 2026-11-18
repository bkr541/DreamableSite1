import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (f: string) => readFileSync(path.join(root, f), 'utf8');
const walk = (dir: string, out: string[] = []) => {
  for (const f of readdirSync(dir)) {
    if (['node_modules', '.next', 'tests', '.git'].includes(f)) continue;
    const p = path.join(dir, f);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

describe('Zoho inbox: who can reach it', () => {
  it('every Zoho and inbox route is admin-only', () => {
    for (const f of ['app/api/admin/zoho/connect/route.ts', 'app/api/admin/zoho/route.ts', 'app/api/admin/inbox/route.ts', 'app/api/admin/inbox/[id]/route.ts', 'app/api/auth/zoho/callback/route.ts']) {
      expect(read(f), f).toMatch(/requireAdmin\(req\)/);
    }
  });
  it('the callback checks the one-time state before it trusts the code, and stores the token encrypted', () => {
    const cb = read('app/api/auth/zoho/callback/route.ts');
    expect(cb.indexOf('statesMatch(')).toBeGreaterThan(-1);
    expect(cb.indexOf('statesMatch(')).toBeLessThan(cb.indexOf('exchangeCode('));
    expect(cb).toMatch(/encryptToken\(/);
    expect(cb).not.toMatch(/refreshTokenEnc:\s*tokens\.refreshToken/);
  });
  it('message ids are validated before they reach a Zoho API path', () => {
    expect(read('app/api/admin/inbox/[id]/route.ts')).toMatch(/isZohoId\(id\)\s*\|\|\s*!isZohoId\(folderId\)/);
  });
  it('responses with mail in them are never cached', () => {
    for (const f of ['app/api/admin/inbox/route.ts', 'app/api/admin/inbox/[id]/route.ts']) expect(read(f), f).toContain("'Cache-Control': 'no-store'");
  });
});

describe('Zoho inbox: what an email can do', () => {
  const panel = read('components/InboxPanel.tsx');
  it('shows message HTML only in a frame with no permissions and a policy that blocks the network', () => {
    expect(panel).toMatch(/<iframe[^>]*sandbox=""/);
    expect(panel).not.toMatch(/sandbox="[^"]+"/); // no allow-scripts / allow-same-origin / allow-popups ...
    expect(panel).toContain("default-src 'none'");
    expect(panel).toContain("img-src data:");
    expect(panel).not.toContain('dangerouslySetInnerHTML');
  });
});

describe('secrets stay out of the repository', () => {
  it('no Zoho client id or secret (or any 1000.… client id) is written in a source file', () => {
    const offenders = walk(root).filter((f) => /\.(ts|tsx|mjs|js|json|md|sql|env\.example)$/.test(f) && !/package-lock\.json$/.test(f) && /\b1000\.[A-Z0-9]{25,}\b/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });
  it('the Inbox only ever asks Zoho for read access', () => {
    expect(read('lib/zohoMail.ts')).toMatch(/ZOHO_SCOPES = \['ZohoMail\.accounts\.READ', 'ZohoMail\.folders\.READ', 'ZohoMail\.messages\.READ'\]/);
  });
});
