'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { useAfterIdle, useInView, usePageVisible, usePrefersReducedMotion, useSavesData } from '@/hooks/use-animation-active';

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Shown while the animation isn't running (first paint, offscreen, background tab). */
  fallback?: ReactNode;
  /**
   * What a visitor who asked for reduced motion gets:
   *  'hide'   – nothing animated at all (use for purely decorative layers)
   *  'freeze' – the same artwork, held still (movement is switched off; use for illustrations)
   */
  onReducedMotion?: 'hide' | 'freeze';
  /** Keep the fallback mounted underneath the animation, so nothing is blank while the animation's code is still loading. */
  underlay?: boolean;
}

/**
 * Runs decorative animation only while it can be seen: after the first paint, while on screen, while the tab is in
 * the foreground, and not at all for visitors who reduce motion or save data. When it isn't running the animated
 * subtree is unmounted (zero CPU, and its JavaScript is never even fetched if it was imported with next/dynamic).
 * The wrapper keeps its box, so the layout never shifts.
 */
export default function OnlyWhenActive({ children, className, style, fallback = null, onReducedMotion = 'freeze', underlay = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const savesData = useSavesData();
  const ready = useAfterIdle();
  const visible = usePageVisible();
  const inView = useInView(ref);

  const running = ready && visible && inView && !savesData && !(reduced && onReducedMotion === 'hide');
  const animated = running ? <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>{children}</MotionConfig> : null;
  const content = underlay ? <>{fallback}{animated}</> : (animated ?? fallback);
  return <div ref={ref} className={className} style={style} aria-hidden="true">{content}</div>;
}
