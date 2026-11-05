// Seeds the `services` table from the one service catalog (lib/services.catalog.mjs).
//
//   node --env-file=.env.local prisma/seed.mjs        (or: npm run seed)
//
// Safe to run as often as you like: it only creates what is missing and never duplicates a service. Databases that still
// hold an older spelling ("Branding & Identity") are reconciled first: the old row is renamed to the canonical name (or,
// if the canonical row already exists, its sub-categories are moved across and the old row removed).
import { SERVICES, LEGACY_ALIASES, serviceKey } from '../lib/services.catalog.mjs';

/** @param {{ service: any, serviceSubCategory: any }} prisma */
export async function seedServices(prisma, log = console.log) {
  // 1. Fold legacy spellings into their canonical service.
  const existing = await prisma.service.findMany({ select: { id: true, name: true } });
  for (const { alias, label } of LEGACY_ALIASES) {
    const legacy = existing.filter((s) => serviceKey(s.name) === serviceKey(alias) && s.name !== label);
    for (const row of legacy) {
      const canonical = (await prisma.service.findMany({ select: { id: true, name: true } })).find((s) => s.name === label);
      if (!canonical) {
        await prisma.service.update({ where: { id: row.id }, data: { name: label } });
        log(`  renamed "${row.name}" → "${label}"`);
      } else {
        const keep = new Set((await prisma.serviceSubCategory.findMany({ where: { serviceId: canonical.id }, select: { name: true } })).map((c) => c.name));
        for (const sc of await prisma.serviceSubCategory.findMany({ where: { serviceId: row.id }, select: { id: true, name: true } })) {
          if (!keep.has(sc.name)) await prisma.serviceSubCategory.update({ where: { id: sc.id }, data: { serviceId: canonical.id } });
        }
        await prisma.service.delete({ where: { id: row.id } });
        log(`  merged "${row.name}" into "${label}"`);
      }
    }
  }

  // 2. Make sure every catalog service and sub-category exists, in catalog order.
  for (let si = 0; si < SERVICES.length; si++) {
    const { label, subCategories } = SERVICES[si];
    const service = await prisma.service.upsert({
      where: { name: label },
      update: { order: si },
      create: { name: label, order: si },
    });
    for (let ci = 0; ci < subCategories.length; ci++) {
      await prisma.serviceSubCategory.upsert({
        where: { serviceId_name: { serviceId: service.id, name: subCategories[ci] } },
        update: { order: ci },
        create: { serviceId: service.id, name: subCategories[ci], order: ci },
      });
    }
    log(`  ✓ ${label} (${subCategories.length} sub-categories)`);
  }
}

// Run only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  console.log('Seeding services…');
  try {
    await seedServices(prisma);
    console.log('Done.');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
