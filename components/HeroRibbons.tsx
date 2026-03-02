'use client';

import { motion } from 'motion/react';

/* ── Floating code snippets ────────────────────────────────── */
const codeSnippets = [
    { code: 'const app = create();', x: '5%', y: '12%', rotate: -3, delay: 0, size: 'text-[11px]' },
    { code: '<Component />', x: '78%', y: '8%', rotate: 4, delay: 1.2, size: 'text-xs' },
    { code: 'async deploy()', x: '70%', y: '72%', rotate: -2, delay: 2.5, size: 'text-[11px]' },
    { code: 'npm run build', x: '8%', y: '75%', rotate: 3, delay: 0.8, size: 'text-[10px]' },
    { code: 'git push origin main', x: '82%', y: '40%', rotate: -4, delay: 3.2, size: 'text-[10px]' },
    { code: 'export default', x: '15%', y: '45%', rotate: 2, delay: 1.8, size: 'text-[10px]' },
];

/* ── Floating symbols ──────────────────────────────────────── */
const symbols = [
    { char: '{  }', x: '22%', y: '18%', delay: 0.5 },
    { char: '< />', x: '65%', y: '22%', delay: 1.5 },
    { char: '( )', x: '40%', y: '78%', delay: 2.8 },
    { char: '[ ]', x: '88%', y: '58%', delay: 0.2 },
    { char: '=>', x: '50%', y: '10%', delay: 3.5 },
    { char: '&&', x: '30%', y: '65%', delay: 1 },
    { char: '...', x: '72%', y: '85%', delay: 2 },
];

/* ── Animated connection lines (like a node graph) ─────────── */
const connections = [
    { x1: 10, y1: 30, x2: 35, y2: 20 },
    { x1: 60, y1: 15, x2: 85, y2: 35 },
    { x1: 20, y1: 70, x2: 45, y2: 85 },
    { x1: 55, y1: 60, x2: 80, y2: 75 },
    { x1: 30, y1: 40, x2: 55, y2: 30 },
];

/* ── Small dot nodes ───────────────────────────────────────── */
const nodes = [
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

export default function HeroRibbons() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
            {/* Soft gradient glow base */}
            <div className="absolute top-1/3 left-1/4 w-[500px] h-[400px] rounded-full bg-cyan-200/30 blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[350px] rounded-full bg-purple-200/25 blur-[100px]" />

            {/* Grid pattern overlay */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.07]">
                <defs>
                    <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                        <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1a1a1a" strokeWidth="0.5" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Connection lines (node graph) */}
            <svg className="absolute inset-0 w-full h-full">
                {connections.map((c, i) => (
                    <motion.line
                        key={`line-${i}`}
                        x1={`${c.x1}%`} y1={`${c.y1}%`}
                        x2={`${c.x2}%`} y2={`${c.y2}%`}
                        stroke="rgba(120,160,190,0.2)"
                        strokeWidth="1"
                        strokeDasharray="6 4"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 2, delay: i * 0.4, ease: 'easeOut' }}
                    />
                ))}
                {/* Animated data pulses along lines */}
                {connections.map((c, i) => (
                    <motion.circle
                        key={`pulse-${i}`}
                        r="2"
                        fill="rgba(6,182,212,0.45)"
                        animate={{
                            cx: [`${c.x1}%`, `${c.x2}%`],
                            cy: [`${c.y1}%`, `${c.y2}%`],
                            opacity: [0, 0.6, 0],
                        }}
                        transition={{
                            duration: 3,
                            delay: i * 1.2 + 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    />
                ))}
            </svg>

            {/* Dot nodes */}
            {nodes.map((n, i) => (
                <motion.div
                    key={`node-${i}`}
                    className={`absolute w-2.5 h-2.5 rounded-full ${n.color}`}
                    style={{ left: n.x, top: n.y }}
                    animate={{
                        scale: [1, 1.8, 1],
                        opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{ duration: 4, delay: i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}

            {/* Floating code snippets */}
            {codeSnippets.map((s, i) => (
                <motion.div
                    key={`code-${i}`}
                    className={`absolute font-mono ${s.size} text-[#1a1a1a]/[0.18] whitespace-nowrap`}
                    style={{ left: s.x, top: s.y, rotate: s.rotate }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{
                        opacity: 1,
                        y: [0, -8, 0],
                    }}
                    transition={{
                        opacity: { duration: 1, delay: s.delay },
                        y: { duration: 8 + i, delay: s.delay, repeat: Infinity, ease: 'easeInOut' },
                    }}
                >
                    {s.code}
                </motion.div>
            ))}

            {/* Floating bracket/syntax symbols */}
            {symbols.map((s, i) => (
                <motion.div
                    key={`sym-${i}`}
                    className="absolute font-mono text-lg md:text-xl text-[#1a1a1a]/[0.12] font-light"
                    style={{ left: s.x, top: s.y }}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{
                        opacity: 1,
                        scale: [1, 1.15, 1],
                        y: [0, -12, 0],
                        rotate: [0, i % 2 === 0 ? 5 : -5, 0],
                    }}
                    transition={{
                        opacity: { duration: 0.8, delay: s.delay },
                        scale: { duration: 7 + i, delay: s.delay, repeat: Infinity, ease: 'easeInOut' },
                        y: { duration: 9 + i, delay: s.delay, repeat: Infinity, ease: 'easeInOut' },
                        rotate: { duration: 12, delay: s.delay, repeat: Infinity, ease: 'easeInOut' },
                    }}
                >
                    {s.char}
                </motion.div>
            ))}

            {/* Blinking terminal cursor */}
            <motion.div
                className="absolute font-mono text-sm text-cyan-500/30"
                style={{ left: '45%', top: '50%' }}
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
            >
                █
            </motion.div>
        </div>
    );
}
