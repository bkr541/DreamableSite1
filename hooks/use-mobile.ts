import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    },
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  );
}
