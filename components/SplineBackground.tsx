'use client';

import dynamic from 'next/dynamic';
import OnlyWhenActive from './OnlyWhenActive';
import { gradients, glows, curveColors, type BackgroundTheme } from './backgroundThemes';

/**
 * The still version of the page backdrop: same gradient, glow and flowing lines as the animated one, no motion.
 * It is what shows on first paint, to visitors who reduce motion or save data, offscreen, and if the animation fails.
 */
function StaticBackdrop({ theme }: { theme: BackgroundTheme }) {
  const cc = curveColors[theme];
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: gradients[theme] }}>
      <div
        className="absolute rounded-full"
        style={{
          width: 700, height: 700, left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${glows[theme]}, transparent 70%)`, opacity: 0.8,
        }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="none" fill="none">
        <path d="M-50,200 C200,150 400,280 600,200 S1000,240 1250,180" stroke={cc[0]} strokeWidth="1.5" />
        <path d="M-50,400 C150,370 350,440 550,380 S850,420 1250,400" stroke={cc[1]} strokeWidth="1" />
        <path d="M-50,600 C250,580 450,640 650,590 S1050,620 1250,600" stroke={cc[2]} strokeWidth="1" />
      </svg>
    </div>
  );
}

// The motion library and the themed scenery are only downloaded when the backdrop is about to animate.
const AnimatedBackground = dynamic(() => import('./AnimatedBackground'), { ssr: false });

export default function SplineBackground({ theme }: { theme: BackgroundTheme }) {
  return (
    <OnlyWhenActive
      className="absolute inset-0"
      onReducedMotion="hide"
      underlay
      fallback={<StaticBackdrop theme={theme} />}
    >
      <AnimatedBackground theme={theme} />
    </OnlyWhenActive>
  );
}
