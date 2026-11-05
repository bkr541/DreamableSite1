'use client';

import { MotionConfig } from 'motion/react';

/** Makes every motion animation on the site honour the visitor's "reduce motion" setting (transform/layout movement is skipped, opacity still fades). */
export default function MotionPreferences({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
