// Deliverable categories per project type. Keys are the `service` values saved on inquiries and projects.
// Edit the lists here to change what admins can choose and how clients see their files grouped.
import { findService } from './services.catalog.mjs';

export const OTHER_CATEGORY = 'Other';

/**
 * The categories an admin can file a deliverable under, for a project/inquiry's service. The service may be any stored
 * spelling (older records say "Branding & Identity"); services with no categories of their own fall back to General.
 */
export function getDeliverableCategories(service: string): string[] {
  const own = findService(service)?.deliverableCategories ?? [];
  return [...(own.length ? own : ['General']), OTHER_CATEGORY];
}

export const DELIVERABLE_MAX_FILES = 10;
export const DELIVERABLE_MAX_BYTES = 25 * 1024 * 1024;
