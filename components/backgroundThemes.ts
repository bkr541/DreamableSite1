// Colours shared by the still backdrop (components/SplineBackground.tsx) and the animated one (AnimatedBackground.tsx),
// so the animation fades in over exactly the same picture.
export type BackgroundTheme = 'evolvable' | 'buildable' | 'launchable' | 'memorable' | 'dreamable';

export const gradients: Record<BackgroundTheme, string> = {
    evolvable: 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 40%, #ecfdf5 100%)',
    buildable: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 40%, #f0f4ff 100%)',
    launchable: 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 40%, #fef3c7 100%)',
    memorable: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 40%, #fdf2f8 100%)',
    dreamable: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 40%, #faf5ff 100%)',
};

export const glows: Record<BackgroundTheme, string> = {
    evolvable: 'rgba(20, 184, 166, 0.2)',
    buildable: 'rgba(99, 102, 241, 0.2)',
    launchable: 'rgba(251, 146, 60, 0.2)',
    memorable: 'rgba(168, 85, 247, 0.2)',
    dreamable: 'rgba(244, 114, 182, 0.2)',
};

export const curveColors: Record<BackgroundTheme, [string, string, string]> = {
    evolvable: ['rgba(20,184,166,0.25)', 'rgba(6,182,212,0.18)', 'rgba(52,211,153,0.14)'],
    buildable: ['rgba(99,102,241,0.25)', 'rgba(129,140,248,0.18)', 'rgba(79,70,229,0.14)'],
    launchable: ['rgba(251,146,60,0.25)', 'rgba(245,158,11,0.18)', 'rgba(249,115,22,0.14)'],
    memorable: ['rgba(168,85,247,0.25)', 'rgba(192,132,252,0.18)', 'rgba(147,51,234,0.14)'],
    dreamable: ['rgba(244,114,182,0.25)', 'rgba(236,72,153,0.18)', 'rgba(251,146,182,0.14)'],
};
