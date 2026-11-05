import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { SERVICES, LEGACY_ALIASES, canonicalServiceLabel, findService, intakeServices, serviceKey } from '@/lib/services.catalog.mjs';
import { intakeOptions, serviceById, serviceIdOf } from '@/lib/services';
import { getDeliverableCategories, OTHER_CATEGORY } from '@/lib/deliverables';
import { seedServices } from '../prisma/seed.mjs';

// One catalog drives the public forms, admin pickers, seed data, deliverable categories and the SQL migration.

describe('the catalog itself', () => {
  it('has unique ids, labels and aliases, and no alias that points at two services', () => {
    expect(new Set(SERVICES.map((s) => s.id)).size).toBe(SERVICES.length);
    const keys = SERVICES.flatMap((s) => [s.label, s.id.replace(/-/g, ' '), ...s.aliases].map(serviceKey));
    // ids like "ui ux design" and labels like "UI/UX Design" are the same key on purpose, so compare per service.
    const owner = new Map<string, string>();
    for (const s of SERVICES) for (const n of [s.label, s.id.replace(/-/g, ' '), ...s.aliases]) {
      const prev = owner.get(serviceKey(n));
      expect(prev === undefined || prev === s.id, `"${n}" claimed by ${prev} and ${s.id}`).toBe(true);
      owner.set(serviceKey(n), s.id);
    }
    expect(keys.length).toBeGreaterThan(SERVICES.length);
    expect(new Set(SERVICES.map((s) => s.label)).size).toBe(SERVICES.length);
  });

  it('keeps the old spellings working: both brand names resolve to Brand Identity', () => {
    expect(canonicalServiceLabel('Branding & Identity')).toBe('Brand Identity');
    expect(canonicalServiceLabel('Branding & Logo')).toBe('Brand Identity');
    expect(canonicalServiceLabel(' branding and logo ')).toBe('Brand Identity');
    expect(serviceIdOf('Branding & Identity')).toBe('brand-identity');
    expect(LEGACY_ALIASES.map((a) => a.alias).sort()).toEqual(['Branding & Identity', 'Branding & Logo']);
  });

  it('never rewrites a value it does not recognise', () => {
    expect(canonicalServiceLabel('Podcast Production')).toBe('Podcast Production');
    expect(canonicalServiceLabel('  Podcast Production ')).toBe('Podcast Production');
    expect(findService('Podcast Production')).toBeNull();
    expect(serviceIdOf(null)).toBeNull();
    expect(canonicalServiceLabel(undefined)).toBe('');
  });

  it('gives every service an id that round-trips', () => {
    for (const s of SERVICES) {
      expect(serviceById(s.id)).toBe(s);
      expect(findService(s.label)).toBe(s);
      expect(findService(s.id)).toBe(s);
    }
  });
});

describe('the public inquiry forms', () => {
  it('offer every intake service, once, and every option is a known service', () => {
    const opts = intakeOptions();
    expect(opts.map((o) => o.value)).toEqual(intakeServices().map((s: { label: string }) => s.label));
    for (const o of opts) {
      expect(o.value).toBe(o.label);
      expect(findService(o.value)?.label).toBe(o.value); // what a visitor submits is already canonical
    }
    expect(opts.map((o) => o.label)).toContain('Marketing & Ads'); // was on the contact form only, with no other definition
    expect(opts.map((o) => o.label)).not.toContain('Support'); // internal service
  });

  it('are driven by the catalog, not by their own copies of the list', () => {
    for (const f of ['app/(marketing)/page.tsx', 'app/(marketing)/HomeClient.tsx', 'app/(marketing)/contact/page.tsx']) {
      let src = '';
      try { src = readFileSync(path.resolve(__dirname, '..', f), 'utf8'); } catch { continue; }
      expect(src, f).not.toMatch(/Branding & (Logo|Identity)/);
    }
    expect(readFileSync(path.resolve(__dirname, '../app/(marketing)/contact/page.tsx'), 'utf8')).toContain('intakeOptions()');
    expect(readFileSync(path.resolve(__dirname, '../app/(marketing)/HomeClient.tsx'), 'utf8')).toContain('intakeOptions()');
  });
});

describe('deliverable categories', () => {
  it('exist for every service and every legacy spelling, always ending in Other', () => {
    for (const s of SERVICES) {
      for (const name of [s.label, ...s.aliases]) {
        const cats = getDeliverableCategories(name);
        expect(cats.length, name).toBeGreaterThanOrEqual(2);
        expect(cats[cats.length - 1]).toBe(OTHER_CATEGORY);
        expect(new Set(cats).size).toBe(cats.length);
      }
    }
    expect(getDeliverableCategories('Branding & Logo')).toEqual(getDeliverableCategories('Brand Identity'));
    expect(getDeliverableCategories('Brand Identity')).toContain('Logos');
  });

  it('fall back to General for services with none of their own and for unknown values', () => {
    expect(getDeliverableCategories('Marketing & Ads')).toEqual(['General', OTHER_CATEGORY]);
    expect(getDeliverableCategories('Something New')).toEqual(['General', OTHER_CATEGORY]);
  });
});

describe('admin pickers', () => {
  it('pick icons by service id, so every spelling of a service gets the same icon', () => {
    const src = readFileSync(path.resolve(__dirname, '../components/dropdowns/options.ts'), 'utf8');
    expect(src).toContain('serviceIdOf(o.value)');
    for (const s of SERVICES.filter((x) => x.intake)) expect(src, s.id).toMatch(new RegExp(`['"]?${s.id}['"]?:`));
  });
});

// A small in-memory stand-in for the two Prisma models the seed touches.
function fakePrisma(initial: { name: string; subs?: string[] }[]) {
  let n = 0;
  const services: { id: string; name: string; order: number }[] = [];
  const subs: { id: string; serviceId: string; name: string; order: number }[] = [];
  for (const s of initial) {
    const row = { id: `s${++n}`, name: s.name, order: 99 };
    services.push(row);
    for (const sub of s.subs ?? []) subs.push({ id: `c${++n}`, serviceId: row.id, name: sub, order: 99 });
  }
  const pick = (row: any, select?: Record<string, boolean>) => (select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : { ...row });
  const prisma = {
    service: {
      findMany: async ({ select }: any = {}) => services.map((r) => pick(r, select)),
      update: async ({ where, data }: any) => { Object.assign(services.find((r) => r.id === where.id)!, data); },
      delete: async ({ where }: any) => {
        services.splice(services.findIndex((r) => r.id === where.id), 1);
        for (let i = subs.length - 1; i >= 0; i--) if (subs[i].serviceId === where.id) subs.splice(i, 1);
      },
      upsert: async ({ where, update, create }: any) => {
        const hit = services.find((r) => r.name === where.name);
        if (hit) { Object.assign(hit, update); return hit; }
        const row = { id: `s${++n}`, ...create }; services.push(row); return row;
      },
    },
    serviceSubCategory: {
      findMany: async ({ where, select }: any) => subs.filter((r) => r.serviceId === where.serviceId).map((r) => pick(r, select)),
      update: async ({ where, data }: any) => { Object.assign(subs.find((r) => r.id === where.id)!, data); },
      upsert: async ({ where, update, create }: any) => {
        const { serviceId, name } = where.serviceId_name;
        const hit = subs.find((r) => r.serviceId === serviceId && r.name === name);
        if (hit) { Object.assign(hit, update); return hit; }
        subs.push({ id: `c${++n}`, ...create });
      },
    },
  };
  return { prisma, services, subs };
}

describe('seed', () => {
  const expectedSubs = SERVICES.reduce((t, s) => t + s.subCategories.length, 0);

  it('creates every catalog service and sub-category on an empty database', async () => {
    const { prisma, services, subs } = fakePrisma([]);
    await seedServices(prisma, () => {});
    expect(services.map((s) => s.name)).toEqual(SERVICES.map((s) => s.label));
    expect(subs).toHaveLength(expectedSubs);
  });

  it('is idempotent: a second run changes nothing', async () => {
    const { prisma, services, subs } = fakePrisma([]);
    await seedServices(prisma, () => {});
    const before = JSON.stringify({ services, subs });
    await seedServices(prisma, () => {});
    expect(JSON.stringify({ services, subs })).toBe(before);
  });

  it('renames a legacy row in place, keeping its sub-categories and any custom ones', async () => {
    const { prisma, services, subs } = fakePrisma([{ name: 'Branding & Identity', subs: ['Logo Design & Logo Systems', 'My Custom Offer'] }]);
    await seedServices(prisma, () => {});
    expect(services.filter((s) => serviceKey(s.name) === serviceKey('Branding & Identity'))).toHaveLength(0);
    const brand = services.find((s) => s.name === 'Brand Identity')!;
    expect(brand.id).toBe('s1'); // same row, so anything pointing at it keeps working
    const names = subs.filter((s) => s.serviceId === brand.id).map((s) => s.name);
    expect(names).toContain('My Custom Offer');
    expect(names.filter((n) => n === 'Logo Design & Logo Systems')).toHaveLength(1);
  });

  it('merges a legacy duplicate into the canonical row without losing its unique sub-categories', async () => {
    const { prisma, services, subs } = fakePrisma([
      { name: 'Brand Identity', subs: ['Logo Design & Logo Systems'] },
      { name: 'Branding & Logo', subs: ['Logo Design & Logo Systems', 'Legacy Only Offer'] },
    ]);
    await seedServices(prisma, () => {});
    expect(services.filter((s) => s.name === 'Brand Identity')).toHaveLength(1);
    expect(services.some((s) => s.name === 'Branding & Logo')).toBe(false);
    const names = subs.filter((s) => s.serviceId === 's1').map((s) => s.name);
    expect(names).toContain('Legacy Only Offer');
    expect(names.filter((n) => n === 'Logo Design & Logo Systems')).toHaveLength(1);
  });

  it('leaves a service it does not know untouched', async () => {
    const { prisma, services } = fakePrisma([{ name: 'Podcast Production' }]);
    await seedServices(prisma, () => {});
    expect(services.some((s) => s.name === 'Podcast Production')).toBe(true);
  });
});

describe('the SQL migration stays in step with the catalog', () => {
  const sql = readFileSync(path.resolve(__dirname, '../prisma/migrations/20261105050000_canonical_services/migration.sql'), 'utf8');
  const pairs = [...sql.matchAll(/\('([^']+)', '([^']+)'\)/g)].map((m) => `${m[1]}=>${m[2]}`);

  it('maps every label, id-spelling and alias to its canonical label', () => {
    const expected = new Set<string>();
    for (const s of SERVICES) for (const name of [s.label, ...s.aliases]) expected.add(`${serviceKey(name)}=>${s.label}`);
    const found = new Set(pairs);
    for (const e of expected) expect(found.has(e), `migration is missing ${e}`).toBe(true);
    for (const f of found) expect(expected.has(f), `migration has an extra mapping ${f}`).toBe(true);
  });
});
