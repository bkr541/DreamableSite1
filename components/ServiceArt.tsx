import { useId } from 'react';
import { serviceIdOf, type ServiceId } from '@/lib/services';

// One illustration per service, drawn for this site in its colours (navy #1a2030 outlines, brand gradients). Every
// service in lib/services.catalog.mjs must have an entry here (tests/serviceArt.test.ts checks), and any value we don't
// recognise gets the "other" artwork, so a project never shows an empty slot.

const NAVY = '#1a2030';

/** Two-stop gradient per service, so each category reads as its own colour at a glance. */
const PALETTE: Record<ServiceId, [string, string]> = {
  'web-development': ['#3DD9C8', '#4f6df5'],
  'brand-identity': ['#B87AF5', '#F472B6'],
  'ui-ux-design': ['#7BB5F5', '#B87AF5'],
  marketing: ['#FB923C', '#F472B6'],
  consulting: ['#4f6df5', '#7BB5F5'],
  support: ['#3DD9C8', '#7BB5F5'],
  other: ['#B87AF5', '#3DD9C8'],
};

type Glyph = (p: { g: string }) => React.ReactElement;

const GLYPHS: Record<ServiceId, Glyph> = {
  // A browser window with code brackets.
  'web-development': ({ g }) => (
    <>
      <rect x="11" y="14" width="42" height="36" rx="6" fill="#fff" stroke={NAVY} strokeWidth="2.5" />
      <path d="M11 24h42" stroke={NAVY} strokeWidth="2.5" />
      <circle cx="17" cy="19" r="1.7" fill={`url(#${g})`} />
      <circle cx="22.5" cy="19" r="1.7" fill={`url(#${g})`} />
      <circle cx="28" cy="19" r="1.7" fill={`url(#${g})`} />
      <path d="M26 31l-6 6.5 6 6.5M38 31l6 6.5-6 6.5M34.5 30l-5 15" fill="none" stroke={`url(#${g})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // An identity mark: a circle and a diamond overlapping, with the corner anchors of a vector shape.
  'brand-identity': ({ g }) => (
    <>
      <circle cx="26" cy="30" r="13" fill={`url(#${g})`} />
      <path d="M40 19l14 14-14 14-14-14z" fill="#fff" fillOpacity=".55" stroke={NAVY} strokeWidth="2.5" strokeLinejoin="round" />
      {[[40, 19], [54, 33], [40, 47], [26, 33]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x - 2.6} y={y - 2.6} width="5.2" height="5.2" rx="1" fill="#fff" stroke={NAVY} strokeWidth="1.8" />
      ))}
    </>
  ),
  // A wireframed screen with a cursor.
  'ui-ux-design': ({ g }) => (
    <>
      <rect x="11" y="11" width="38" height="42" rx="6" fill="#fff" stroke={NAVY} strokeWidth="2.5" />
      <rect x="16" y="16" width="28" height="7" rx="2.5" fill={`url(#${g})`} />
      <rect x="16" y="27" width="12" height="11" rx="2.5" fill={`url(#${g})`} fillOpacity=".35" />
      <rect x="32" y="27" width="12" height="11" rx="2.5" fill="none" stroke={NAVY} strokeWidth="2" />
      <path d="M16 43h26M16 48h14" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />
      <path d="M41 39v17l4.6-4.4 3.2 6.8 3.4-1.6-3.2-6.6 6.4-.4z" fill={NAVY} stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  // A megaphone with sound waves.
  marketing: ({ g }) => (
    <>
      <path d="M17 29l21-11v29L17 36z" fill={`url(#${g})`} />
      <rect x="9" y="28.5" width="10" height="8.5" rx="2.5" fill={NAVY} />
      <path d="M20 37l2.6 12.5h6L26 40" fill={NAVY} />
      <path d="M43 26.5c3.6 3.4 3.6 7.6 0 11M48.5 21.5c7 6.6 7 14.4 0 21" fill="none" stroke={`url(#${g})`} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  // Two conversation bubbles: advice going back and forth.
  consulting: ({ g }) => (
    <>
      <path d="M17 13h22a6 6 0 016 6v10a6 6 0 01-6 6H27l-8 7v-7h-2a6 6 0 01-6-6V19a6 6 0 016-6z" fill={`url(#${g})`} />
      <circle cx="21" cy="24" r="2" fill="#fff" />
      <circle cx="28" cy="24" r="2" fill="#fff" />
      <circle cx="35" cy="24" r="2" fill="#fff" />
      <path d="M31 33h17a5.5 5.5 0 015.5 5.5v6A5.5 5.5 0 0148 50h-1.5v6l-7-6H31a5.5 5.5 0 01-5.5-5.5v-6A5.5 5.5 0 0131 33z" fill="#fff" stroke={NAVY} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M32 39.5h15M32 44.5h9" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  // A lifebuoy.
  support: ({ g }) => (
    <>
      <circle cx="32" cy="32" r="14" fill="none" stroke={`url(#${g})`} strokeWidth="10" />
      <circle cx="32" cy="32" r="14" fill="none" stroke="#fff" strokeWidth="10" strokeDasharray="11 11" strokeDashoffset="5.5" />
      <circle cx="32" cy="32" r="19" fill="none" stroke={NAVY} strokeWidth="2.5" />
      <circle cx="32" cy="32" r="9" fill="none" stroke={NAVY} strokeWidth="2.5" />
    </>
  ),
  // Sparks: ideas that don't fit a box.
  other: ({ g }) => (
    <>
      <path d="M28 12c1 12 6 17 18 18-12 1-17 6-18 18-1-12-6-17-18-18 12-1 17-6 18-18z" transform="translate(-1 4)" fill={`url(#${g})`} />
      <path d="M47 10c.5 5.5 2.6 7.6 8 8-5.4.4-7.5 2.5-8 8-.5-5.5-2.6-7.6-8-8 5.4-.4 7.5-2.5 8-8z" fill="none" stroke={NAVY} strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="50" cy="46" r="3" fill="none" stroke={NAVY} strokeWidth="2.2" />
      <circle cx="14" cy="52" r="2" fill={NAVY} />
    </>
  ),
};

/** The artwork for a service: pass the stored service name (any spelling) and a size in pixels. Decorative (the name is shown beside it). */
export default function ServiceArt({ service, size = 56, className = '' }: { service: string; size?: number; className?: string }) {
  const id = serviceIdOf(service) ?? 'other';
  const [from, to] = PALETTE[id];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const g = `sg${uid}`;
  const Glyph = GLYPHS[id];
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      data-service-art={id}
    >
      <defs>
        <linearGradient id={g} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <linearGradient id={`${g}-tint`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={from} stopOpacity=".16" />
          <stop offset="1" stopColor={to} stopOpacity=".26" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${g}-tint)`} />
      <Glyph g={g} />
    </svg>
  );
}
