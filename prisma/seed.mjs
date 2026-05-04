import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SERVICES = [
  {
    name: 'App or Web Development',
    subCategories: [
      'Custom Web Applications',
      'SaaS Development',
      'Mobile App Development (iOS / Android / Cross-platform)',
      'Landing Pages & Marketing Sites',
      'E-commerce Development',
      'API Development & Integrations',
      'Database Architecture & Backend Systems',
      'Performance Optimization & Scaling',
      'Maintenance & Support',
      'MVP Development',
    ],
  },
  {
    name: 'Branding & Identity',
    subCategories: [
      'Logo Design & Logo Systems',
      'Brand Identity Systems',
      'Brand Strategy & Positioning',
      'Naming & Tagline Development',
      'Visual Direction & Moodboards',
      'Brand Guidelines / Style Guides',
      'Rebranding / Brand Refresh',
      'Social Media Branding Kits',
      'Merchandise & Packaging Design',
      'Creative Direction',
    ],
  },
  {
    name: 'UI/UX Design',
    subCategories: [
      'User Experience (UX) Research',
      'Wireframing & User Flows',
      'High-Fidelity UI Design',
      'Design Systems & Component Libraries',
      'Prototyping (Interactive Demos)',
      'Usability Testing',
      'Mobile App UI Design',
      'Dashboard / SaaS Interface Design',
      'Conversion Optimization (CRO)',
      'Accessibility Design',
    ],
  },
  {
    name: 'Consulting',
    subCategories: [
      'Product Strategy',
      'Startup MVP Planning',
      'Technical Architecture Consulting',
      'UX Audits & Heuristic Evaluations',
      'Brand Strategy Consulting',
      'Growth Strategy',
      'Monetization Strategy',
      'App / Website Performance Audits',
      'Team & Workflow Optimization',
      'Creative Direction Consulting',
    ],
  },
  {
    name: 'Other',
    subCategories: [
      'AI Integrations',
      'Automation & Workflow Systems',
      'Motion Graphics & Microinteractions',
      '3D / Visual Assets',
      'Content Creation',
      'Pitch Deck & Presentation Design',
      'DJ / Music Branding Packages',
      'Experimental / Concept Projects',
      'Custom Requests',
    ],
  },
];

async function main() {
  console.log('Seeding services…');

  for (let si = 0; si < SERVICES.length; si++) {
    const { name, subCategories } = SERVICES[si];

    const service = await prisma.service.upsert({
      where: { name },
      update: { order: si },
      create: { name, order: si },
    });

    for (let ci = 0; ci < subCategories.length; ci++) {
      await prisma.serviceSubCategory.upsert({
        where: { serviceId_name: { serviceId: service.id, name: subCategories[ci] } },
        update: { order: ci },
        create: { serviceId: service.id, name: subCategories[ci], order: ci },
      });
    }

    console.log(`  ✓ ${name} (${subCategories.length} sub-categories)`);
  }

  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
