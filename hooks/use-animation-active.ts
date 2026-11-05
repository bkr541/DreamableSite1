'use client';

import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

// Decorative animation costs CPU on every frame, so it only runs while a person can actually see it and hasn't asked
// for less motion. These hooks answer those questions; <OnlyWhenActive> uses them.

const REDUCED = '(prefers-reduced-motion: reduce)';

/** The visitor's "reduce motion" operating-system setting (live: it updates if they change it). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const m = window.matchMedia(REDUCED);
      m.addEventListener('change', notify);
      return () => m.removeEventListener('change', notify);
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

/** False while the tab is in the background. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    (notify) => {
      document.addEventListener('visibilitychange', notify);
      return () => document.removeEventListener('visibilitychange', notify);
    },
    () => document.visibilityState !== 'hidden',
    () => true,
  );
}

/** True while the element is on (or just about to enter) the screen. */
export function useInView(ref: RefObject<Element | null>, rootMargin = '120px'): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      const t = setTimeout(() => setInView(true), 0); // no observer support: just run
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

/** Becomes true once the browser is idle (or after `timeout` ms), so animation never competes with the first paint. */
export function useAfterIdle(timeout = 1500): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    type Idle = (cb: () => void, o?: { timeout: number }) => number;
    const w = window as unknown as { requestIdleCallback?: Idle; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setReady(true), { timeout });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, [timeout]);
  return ready;
}

/** Data-saver or a very slow connection: skip decorative animation entirely. */
export function useSavesData(): boolean {
  const [saves, setSaves] = useState(false);
  useEffect(() => {
    const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const t = setTimeout(() => setSaves(!!c?.saveData || c?.effectiveType === 'slow-2g' || c?.effectiveType === '2g'), 0);
    return () => clearTimeout(t);
  }, []);
  return saves;
}
