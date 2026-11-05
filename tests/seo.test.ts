import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INDEXABLE_PAGES, NOINDEX, OG_IMAGE, PRIVATE_PATH_PREFIXES, absoluteUrl, organizationJsonLd, pageMetadata, siteUrl } from '@/lib/site';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

const root = path.resolve(__dirname, '..');
const read = (f: string) => readFileSync(path.join(root, f), 'utf8');

afterEach(() => vi.unstubAllEnvs());

describe('canonical origin', () => {
  it('comes from APP_URL, normalised', () => {
    vi.stubEnv('APP_URL', 'https://dreamable.example/');
    expect(siteUrl()).toBe('https://dreamable.example');
    vi.stubEnv('APP_URL', 'https://dreamable.example/some/path?x=1');
    expect(siteUrl()).toBe('https://dreamable.example');
    expect(absoluteUrl('/about')).toBe('https://dreamable.example/about');
  });
  it('falls back to localhost when unset or malformed, never throws', () => {
    vi.stubEnv('APP_URL', '');
    expect(siteUrl()).toBe('http://localhost:3000');
    vi.stubEnv('APP_URL', 'not a url');
    expect(siteUrl()).toBe('http://localhost:3000');
  });
});

describe('every indexable page', () => {
  it('has a unique title and description of a sensible length, and a canonical path', () => {
    const titles = INDEXABLE_PAGES.map((p) => String(pageMetadata(p.path).title instanceof Object ? (pageMetadata(p.path).title as any).absolute : pageMetadata(p.path).title));
    expect(new Set(titles).size).toBe(INDEXABLE_PAGES.length);
    expect(new Set(INDEXABLE_PAGES.map((p) => p.description)).size).toBe(INDEXABLE_PAGES.length);
    for (const p of INDEXABLE_PAGES) {
      expect(p.description.length, p.path).toBeGreaterThanOrEqual(70);
      expect(p.description.length, p.path).toBeLessThanOrEqual(175);
      const m = pageMetadata(p.path);
      expect(m.alternates?.canonical).toBe(p.path);
      expect(m.openGraph).toMatchObject({ url: p.path, siteName: 'Dreamable.studio', type: 'website' });
      expect((m.openGraph as any).images[0].url).toBe(OG_IMAGE.path);
      expect(m.twitter).toMatchObject({ card: 'summary_large_image' });
      expect(m.robots).toBeUndefined(); // indexable
    }
  });

  it('is wired into its route (a metadata export built from lib/site)', () => {
    const files: Record<string, string> = {
      '/': 'app/(marketing)/page.tsx', '/about': 'app/(marketing)/about/page.tsx',
      '/services': 'app/(marketing)/services/layout.tsx', '/contact': 'app/(marketing)/contact/layout.tsx',
    };
    for (const p of INDEXABLE_PAGES) {
      expect(files[p.path], `no route file recorded for ${p.path}`).toBeTruthy();
      expect(read(files[p.path])).toContain(`pageMetadata('${p.path}')`);
    }
  });

  it('is one real route: every marketing page.tsx is either indexable or noindex, none is neither', () => {
    const base = path.join(root, 'app/(marketing)');
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name === 'page.tsx' ? [path.join(d, e.name)] : []));
    for (const f of walk(base)) {
      const route = '/' + path.relative(base, path.dirname(f)).split(path.sep).filter((s) => s && !s.startsWith('(')).join('/');
      const r = route === '/' ? '/' : route.replace(/\/$/, '');
      const indexable = INDEXABLE_PAGES.some((p) => p.path === r);
      const isNoindex = PRIVATE_PATH_PREFIXES.some((p) => r === p || r.startsWith(p + '/'));
      expect(indexable || isNoindex, `${r} is neither listed for indexing nor marked noindex`).toBe(true);
      expect(indexable && isNoindex, `${r} is both`).toBe(false);
    }
  });
});

describe('sitemap.xml', () => {
  it('lists exactly the indexable pages as absolute URLs on the APP_URL origin', () => {
    vi.stubEnv('APP_URL', 'https://dreamable.example');
    const urls = sitemap().map((e) => e.url);
    expect(urls).toEqual(['https://dreamable.example', 'https://dreamable.example/about', 'https://dreamable.example/services', 'https://dreamable.example/contact']);
  });
  it('never includes private areas', () => {
    for (const e of sitemap()) for (const p of PRIVATE_PATH_PREFIXES) expect(new URL(e.url).pathname.startsWith(p)).toBe(false);
  });
});

describe('robots.txt', () => {
  it('allows the site, hides the private areas and points at the sitemap', () => {
    vi.stubEnv('APP_URL', 'https://dreamable.example');
    const r = robots();
    const rule = (Array.isArray(r.rules) ? r.rules[0] : r.rules) as { allow: string; disallow: string[] };
    expect(rule.allow).toBe('/');
    for (const p of ['/admin', '/dashboard', '/portal', '/share', '/api']) expect(rule.disallow).toContain(p);
    expect(r.sitemap).toBe('https://dreamable.example/sitemap.xml');
  });
});

describe('private areas', () => {
  it('NOINDEX blocks indexing and hides the address from other sites', () => {
    expect(NOINDEX.robots).toMatchObject({ index: false, follow: false });
    expect(NOINDEX.referrer).toBe('no-referrer');
  });
  it('are marked noindex by their layout/page', () => {
    expect(read('app/(dashboard)/layout.tsx')).toContain('...NOINDEX');
    expect(read('app/(marketing)/portal/layout.tsx')).toContain('...NOINDEX');
    const share = read('app/share/[token]/page.tsx');
    expect(share).toMatch(/robots:\s*{\s*index:\s*false/);
  });
  it('also get an X-Robots-Tag header, from the same list robots.txt uses', () => {
    const cfg = read('next.config.ts');
    expect(cfg).toContain('X-Robots-Tag');
    expect(cfg).toContain(`PRIVATE_PATH_PREFIXES = ${JSON.stringify(PRIVATE_PATH_PREFIXES).replace(/"/g, "'").replace(/,/g, ', ')}`);
  });
});

describe('link-preview image', () => {
  it('is a real 1200x630 file in /public', async () => {
    const file = path.join(root, 'public', OG_IMAGE.path);
    expect(existsSync(file)).toBe(true);
    const meta = await sharp(file).metadata();
    expect([meta.width, meta.height]).toEqual([OG_IMAGE.width, OG_IMAGE.height]);
    expect(statSync(file).size).toBeLessThan(600 * 1024);
  });
  it('has tab and home-screen icons', () => {
    expect(existsSync(path.join(root, 'app/icon.png'))).toBe(true);
    expect(existsSync(path.join(root, 'app/apple-icon.png'))).toBe(true);
  });
});

describe('structured data', () => {
  it('only states facts published on the site: name, url, logo, description', () => {
    vi.stubEnv('APP_URL', 'https://dreamable.example');
    const ld = organizationJsonLd();
    expect(ld['@type']).toBe('Organization');
    expect(Object.keys(ld).sort()).toEqual(['@context', '@type', 'description', 'logo', 'name', 'url']);
    expect(ld.url).toBe('https://dreamable.example');
    expect(existsSync(path.join(root, 'public', new URL(ld.logo).pathname))).toBe(true);
  });
});
