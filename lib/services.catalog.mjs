// The one list of services the studio offers. Everything that names a service — the public forms, the admin pickers,
// the seed data, deliverable categories, emails and the portal — reads this file, so a service has exactly one id and
// one display name everywhere.
//
// Plain JavaScript (no imports) so the seed script, the Next.js app and the tests can all load it.
//
// What is stored: inquiries.service, projects.service and services.name hold the service's `label`. A label is therefore a
// stable key: to rename one, keep the old text in `aliases`, add a SQL migration (see 20261105050000_canonical_services)
// and run the seed. `id` is the permanent machine identifier for code, analytics and URLs.

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   aliases: string[],
 *   intake: boolean,
 *   deliverableCategories: string[],
 *   subCategories: string[],
 * }} ServiceDef
 */

/** @type {ServiceDef[]} */
export const SERVICES = [
  {
    id: 'web-development',
    label: 'App or Web Development',
    aliases: [],
    intake: true,
    deliverableCategories: ['Source Code', 'Designs & Mockups', 'Builds & Releases', 'Documentation', 'Credentials & Access'],
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
    id: 'brand-identity',
    label: 'Brand Identity',
    // Older spellings found in the seed data and on the contact form. They keep working everywhere and are
    // rewritten to the label by the migration, the seed and the intake API.
    aliases: ['Branding & Identity', 'Branding & Logo'],
    intake: true,
    deliverableCategories: ['Logos', 'Brand Guidelines', 'Color & Typography', 'Social Media Kits', 'Brand Assets'],
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
    id: 'ui-ux-design',
    label: 'UI/UX Design',
    aliases: [],
    intake: true,
    deliverableCategories: ['Wireframes', 'Prototypes', 'UI Designs', 'Design System', 'Research & Reports'],
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
    // Offered on the contact form but never defined anywhere else; it is now a first-class service so inquiries that
    // already carry it keep a valid category, filter and icon.
    id: 'marketing',
    label: 'Marketing & Ads',
    aliases: [],
    intake: true,
    deliverableCategories: [],
    subCategories: [],
  },
  {
    id: 'consulting',
    label: 'Consulting',
    aliases: [],
    intake: true,
    deliverableCategories: ['Reports', 'Strategy Documents', 'Presentations', 'Recommendations'],
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
    // Internal: ongoing support for existing clients. Not offered to new visitors.
    id: 'support',
    label: 'Support',
    aliases: [],
    intake: false,
    deliverableCategories: [],
    subCategories: ['Technical Support'],
  },
  {
    id: 'other',
    label: 'Other',
    aliases: [],
    intake: true,
    deliverableCategories: ['General'],
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

/** Case-, spacing- and punctuation-insensitive key: "Branding & Logo", "branding and logo" and " BRANDING  &  LOGO " are one. */
export const serviceKey = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const BY_KEY = new Map();
for (const s of SERVICES) for (const name of [s.label, s.id.replace(/-/g, ' '), ...s.aliases]) BY_KEY.set(serviceKey(name), s);

/** The service a stored or typed value refers to, or null if it isn't one we know. */
export const findService = (value) => BY_KEY.get(serviceKey(value)) ?? null;

/**
 * The canonical display name for a value. A value we don't recognise is returned exactly as given (trimmed): historical
 * records are never silently re-labelled, dropped or blanked.
 */
export const canonicalServiceLabel = (value) => findService(value)?.label ?? String(value ?? '').trim();

/** Services a visitor can pick on the public inquiry forms, in display order. */
export const intakeServices = () => SERVICES.filter((s) => s.intake);

/** Every legacy spelling and the label it becomes — the single list the SQL migration is written from. */
export const LEGACY_ALIASES = SERVICES.flatMap((s) => s.aliases.map((alias) => ({ alias, label: s.label })));
