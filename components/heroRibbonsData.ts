// Positions and copy for the home-page hero artwork; shared by the still and the animated versions.

/* ── Floating code snippets ────────────────────────────────── */
export const codeSnippets = [
    { code: 'export const app = create();', x: '5%', y: '12%', rotate: -3, delay: 0, size: 'text-[11px]' },
    { code: '<Component />', x: '78%', y: '8%', rotate: 4, delay: 1.2, size: 'text-xs' },
    { code: 'async deploy()', x: '70%', y: '72%', rotate: -2, delay: 2.5, size: 'text-[11px]' },
    { code: 'npm run build', x: '8%', y: '75%', rotate: 3, delay: 0.8, size: 'text-[10px]' },
    { code: 'git push origin main', x: '82%', y: '40%', rotate: -4, delay: 3.2, size: 'text-[10px]' },
    { code: 'export default', x: '15%', y: '45%', rotate: 2, delay: 1.8, size: 'text-[10px]' },
];

/* ── Floating symbols ──────────────────────────────────────── */
export const symbols = [
    { char: '{  }', x: '22%', y: '18%', delay: 0.5 },
    { char: '< />', x: '65%', y: '22%', delay: 1.5 },
    { char: '( )', x: '40%', y: '78%', delay: 2.8 },
    { char: '[ ]', x: '88%', y: '58%', delay: 0.2 },
    { char: '=>', x: '50%', y: '10%', delay: 3.5 },
    { char: '&&', x: '30%', y: '65%', delay: 1 },
    { char: '...', x: '72%', y: '85%', delay: 2 },
];

/* ── Animated connection lines (like a node graph) ─────────── */
export const connections = [
    { x1: 10, y1: 30, x2: 35, y2: 20 },
    { x1: 60, y1: 15, x2: 85, y2: 35 },
    { x1: 20, y1: 70, x2: 45, y2: 85 },
    { x1: 55, y1: 60, x2: 80, y2: 75 },
    { x1: 30, y1: 40, x2: 55, y2: 30 },
];

/* ── Small dot nodes ───────────────────────────────────────── */
export const nodes = [
    { x: '10%', y: '30%', color: 'bg-cyan-400/30' },
    { x: '35%', y: '20%', color: 'bg-purple-400/25' },
    { x: '60%', y: '15%', color: 'bg-pink-400/25' },
    { x: '85%', y: '35%', color: 'bg-amber-400/25' },
    { x: '20%', y: '70%', color: 'bg-teal-400/30' },
    { x: '45%', y: '85%', color: 'bg-indigo-400/20' },
    { x: '55%', y: '60%', color: 'bg-cyan-400/20' },
    { x: '80%', y: '75%', color: 'bg-purple-400/20' },
    { x: '30%', y: '40%', color: 'bg-pink-400/20' },
    { x: '55%', y: '30%', color: 'bg-amber-400/20' },
];
