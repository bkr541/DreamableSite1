import { NOINDEX } from '@/lib/site';

// The sign-in and password-reset screens are for existing clients; they have no value in search results, and a reset
// link carries a one-time token in its address.
export const metadata = { ...NOINDEX, title: 'Client Portal' };

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
