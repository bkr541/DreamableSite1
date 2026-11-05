'use client';

import dynamic from 'next/dynamic';
import OnlyWhenActive from './OnlyWhenActive';
import type { BackgroundTheme } from './backgroundThemes';

// The home page's decorative illustrations. Their code (and the motion library) is only downloaded once one is about to
// be seen; each stops and is unmounted when scrolled away or when the tab is hidden; for visitors who reduce motion the
// artwork is shown with its movement switched off. The boxes keep their size throughout, so nothing shifts.

const CubePuzzle = dynamic(() => import('./CubePuzzle'), { ssr: false });
const InteractiveElement = dynamic(() => import('./InteractiveElement'), { ssr: false });

export function LazyCubePuzzle() {
  return (
    <OnlyWhenActive className="h-full w-full">
      <CubePuzzle />
    </OnlyWhenActive>
  );
}

export function LazyInteractiveElement({ theme }: { theme: BackgroundTheme }) {
  return (
    <OnlyWhenActive className="h-full w-full">
      <InteractiveElement theme={theme} />
    </OnlyWhenActive>
  );
}
