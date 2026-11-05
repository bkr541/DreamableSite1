import { SERVICES, LEGACY_ALIASES, canonicalServiceLabel, findService, intakeServices, serviceKey } from './services.catalog.mjs';

export type ServiceDef = (typeof SERVICES)[number];
export type ServiceId = 'web-development' | 'brand-identity' | 'ui-ux-design' | 'marketing' | 'consulting' | 'support' | 'other';

export { SERVICES, LEGACY_ALIASES, canonicalServiceLabel, findService, intakeServices, serviceKey };

export const serviceById = (id: string): ServiceDef | undefined => SERVICES.find((s) => s.id === id);

/** The id of the service a stored value refers to (legacy spellings included), or null for an unrecognised value. */
export const serviceIdOf = (value: unknown): ServiceId | null => (findService(value)?.id as ServiceId | undefined) ?? null;

/** `{ value, label }` pairs for the public inquiry forms. Both forms use this, so they can never drift apart. */
export const intakeOptions = () => intakeServices().map((s: ServiceDef) => ({ value: s.label, label: s.label, id: s.id as ServiceId }));
