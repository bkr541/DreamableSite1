// Deliverable categories per project type. Keys are the `service` values saved on inquiries and projects.
// Edit the lists here to change what admins can choose and how clients see their files grouped.
export const OTHER_CATEGORY = 'Other';

const CATEGORIES: Record<string, string[]> = {
  'App or Web Development': ['Source Code', 'Designs & Mockups', 'Builds & Releases', 'Documentation', 'Credentials & Access'],
  'Brand Identity': ['Logos', 'Brand Guidelines', 'Color & Typography', 'Social Media Kits', 'Brand Assets'],
  'UI/UX Design': ['Wireframes', 'Prototypes', 'UI Designs', 'Design System', 'Research & Reports'],
  Consulting: ['Reports', 'Strategy Documents', 'Presentations', 'Recommendations'],
  Other: ['General'],
};

// Older inquiries/projects may carry a retired service label.
const ALIASES: Record<string, string> = {
  'Branding & Identity': 'Brand Identity',
  'Branding & Logo': 'Brand Identity',
};

export function getDeliverableCategories(service: string): string[] {
  const key = ALIASES[service] ?? service;
  return [...(CATEGORIES[key] ?? CATEGORIES.Other), OTHER_CATEGORY];
}

export const DELIVERABLE_MAX_FILES = 10;
export const DELIVERABLE_MAX_BYTES = 25 * 1024 * 1024;
