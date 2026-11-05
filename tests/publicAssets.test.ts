import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

// /public is served to the whole internet. It should hold only what this site uses, and nothing it uses should be missing.

const root = path.resolve(__dirname, '..');
const pub = path.join(root, 'public');

const walk = (d: string): string[] =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name.startsWith('.') ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const sourceFiles = ['app', 'components', 'lib', 'hooks'].flatMap((d) => walk(path.join(root, d))).filter((f) => /\.(tsx?|mjs|css)$/.test(f));
const sources = sourceFiles.map((f) => ({ f, text: readFileSync(f, 'utf8') }));
const publicFiles = walk(pub).map((f) => '/' + path.relative(pub, f).split(path.sep).join('/'));

describe('public folder', () => {
  it('no longer serves the unrelated DRMVYZ Google Cast pages', () => {
    expect(existsSync(path.join(pub, 'cast'))).toBe(false);
    expect(publicFiles.filter((f) => /cast|receiver|sender/i.test(f))).toEqual([]);
    for (const { f, text } of sources) expect(text, f).not.toMatch(/\/cast\/(sender|receiver)|gstatic\.com\/cast|DRMVYZ/i);
  });

  it('contains no stray HTML, scripts or source files', () => {
    expect(publicFiles.filter((f) => /\.(html?|js|mjs|ts|map|zip|psd|ai|sketch)$/i.test(f))).toEqual([]);
  });

  it('every asset path the code refers to exists', () => {
    const missing: string[] = [];
    for (const { f, text } of sources) {
      for (const m of text.matchAll(/['"`](\/(?:images|fonts)\/[A-Za-z0-9._\-/]+)['"`]/g)) {
        if (!existsSync(path.join(pub, m[1]))) missing.push(`${path.relative(root, f)} → ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has no oversized image (the 2 MB master logo lives in design-source/, not here)', () => {
    for (const f of publicFiles.filter((x) => /\.(png|jpe?g|webp|gif)$/i.test(x))) {
      expect(statSync(path.join(pub, f)).size, f).toBeLessThan(1.5 * 1024 * 1024);
    }
    expect(existsSync(path.join(pub, 'images/logo_transparent.png'))).toBe(false);
    expect(existsSync(path.join(root, 'design-source/logo_transparent.png'))).toBe(true);
  });

  it('every file in it is used by the site (links to /og.png count: it is the link preview)', () => {
    const used = new Set<string>(['/og.png']);
    for (const { text } of sources) for (const m of text.matchAll(/\/(?:images|fonts)\/[A-Za-z0-9._\-/]+/g)) used.add(m[0]);
    // Known leftovers that are the site's own artwork but nothing references yet; deleting them is the owner's call.
    const KNOWN_UNREFERENCED = new Set(['/images/hero.jpg']);
    // Fonts are loaded through next/font (files bundled at build time), not by URL.
    const unreferenced = publicFiles.filter((f) => !used.has(f) && !f.startsWith('/fonts/') && !KNOWN_UNREFERENCED.has(f));
    expect(unreferenced).toEqual([]);
  });
});
