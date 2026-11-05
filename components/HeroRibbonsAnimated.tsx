'use client';

import { motion } from 'motion/react';
import { codeSnippets, symbols, connections, nodes } from './heroRibbonsData';

export default function HeroRibbonsAnimated() {
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
                        x1={`${c.x1}%`}
                        y1={`${c.y1}%`}
                        x2={`${c.x2}%`}
                        y2={`${c.y2}%`}
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
