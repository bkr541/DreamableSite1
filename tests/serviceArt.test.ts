import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { SERVICES } from '@/lib/services.catalog.mjs';

// Every service gets its own illustration. (The component is TSX, so it is checked by reading the source.)
const src = readFileSync(path.resolve(__dirname, '../components/ServiceArt.tsx'), 'utf8');
const section = (name: string) => src.slice(src.indexOf(`const ${name}`));

describe('service artwork', () => {
  it('has a colour palette and a drawing for every service in the catalog', () => {
    const palette = src.slice(src.indexOf('const PALETTE'), src.indexOf('type Glyph'));
    const glyphs = section('GLYPHS');
    for (const s of SERVICES) {
      const key = new RegExp(`(^|\\n)\\s*(['"]?)${s.id}\\2:`);
      expect(palette, `palette for ${s.id}`).toMatch(key);
      expect(glyphs, `drawing for ${s.id}`).toMatch(key);
    }
  });
  it('falls back to the "other" artwork for a value it does not recognise', () => {
    expect(src).toContain("serviceIdOf(service) ?? 'other'");
  });
  it('is decorative (hidden from screen readers) and the project card shows it', () => {
    expect(src).toContain('aria-hidden="true"');
    expect(readFileSync(path.resolve(__dirname, '../components/ProjectCard.tsx'), 'utf8')).toContain('<ServiceArt service={project.service}');
  });
});
