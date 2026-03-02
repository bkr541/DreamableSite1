'use client';
import { motion } from 'motion/react';

type Theme = 'evolvable' | 'buildable' | 'launchable' | 'memorable' | 'dreamable';

export default function InteractiveElement({ theme }: { theme: Theme }) {
    switch (theme) {
        case 'dreamable': return <DreamableElement />;
        case 'buildable': return <BuildableElement />;
        case 'launchable': return <LaunchableElement />;
        case 'memorable': return <MemorableElement />;
        case 'evolvable': return <EvolvableElement />;
    }
}

/* ── DREAMABLE: Glowing lightbulb with floating particles and rays ── */
function DreamableElement() {
    return (
        <div className="relative w-full h-full flex items-center justify-center" style={{ perspective: '1200px' }}>
            {/* Center glow behind the bulb */}
            <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: 250, height: 250,
                    background: 'radial-gradient(circle, rgba(251,191,36,0.2) 0%, rgba(251,191,36,0) 70%)',
                }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* The Bulb Container */}
            <motion.div
                className="relative z-10 flex flex-col items-center"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
                {/* Glass bulb shape */}
                <div className="relative w-32 h-32 rounded-full"
                    style={{
                        background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.4), rgba(251,191,36,0.25))',
                        border: '2px solid rgba(255,255,255,0.4)',
                        boxShadow: '0 0 40px rgba(251,191,36,0.3), inset 0 0 20px rgba(255,255,255,0.5)',
                        backdropFilter: 'blur(10px)',
                    }}
                >
                    {/* Glowing filament */}
                    <motion.div
                        className="absolute w-8 h-12 left-1/2 -ml-4 bottom-4 flex justify-between items-end"
                        animate={{ opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <div className="w-[2px] h-full bg-amber-400/80 rounded" />
                        <div className="w-[2px] h-full bg-amber-400/80 rounded" />
                        <div className="absolute top-0 w-full h-[6px] rounded-full" style={{ borderTop: '2px solid rgba(251,191,36,0.9)' }} />
                    </motion.div>

                    {/* Subtle inner reflection */}
                    <div className="absolute top-3 left-4 w-6 h-10 rounded-full bg-white/30 blur-sm transform -rotate-45" />
                </div>

                {/* Base collar */}
                <div className="relative w-16 h-4 bg-gray-400/30 rounded-t-sm backdrop-blur-md mt-[-8px] z-10" style={{ border: '1px solid rgba(255,255,255,0.2)' }} />

                {/* Screw thread rings */}
                <div className="flex flex-col gap-1 w-14 items-center">
                    <div className="w-full h-2 rounded bg-gray-500/40 backdrop-blur-md" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                    <div className="w-[90%] h-2 rounded bg-gray-500/40 backdrop-blur-md" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                    <div className="w-[80%] h-2 rounded bg-gray-500/40 backdrop-blur-md" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                    {/* Bottom contact dot */}
                    <div className="w-5 h-2 rounded-b-xl bg-gray-800/40 backdrop-blur-md" style={{ border: '1px solid rgba(255,255,255,0.05)' }} />
                </div>
            </motion.div>

            {/* Glowing outer rings / aura */}
            {[
                { s: 180, delay: 0 },
                { s: 230, delay: 1.5 },
            ].map((ring, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                        width: ring.s, height: ring.s,
                        border: '1px solid rgba(251,191,36,0.15)',
                    }}
                    animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0, 0.2] }}
                    transition={{ duration: 4, delay: ring.delay, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}

            {/* Floating idea sparks */}
            {[
                { x: '20%', y: '15%', size: 12, dur: 4, del: 0 },
                { x: '85%', y: '25%', size: 8, dur: 3, del: 1 },
                { x: '15%', y: '60%', size: 10, dur: 5, del: 2 },
                { x: '75%', y: '75%', size: 14, dur: 4.5, del: 0.5 },
            ].map((spark, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        left: spark.x, top: spark.y, width: spark.size, height: spark.size,
                        background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(251,191,36,0.4))',
                        boxShadow: '0 0 10px rgba(251,191,36,0.5)',
                    }}
                    animate={{
                        y: [0, -15, 0],
                        x: [0, (i % 2 === 0 ? 8 : -8), 0],
                        scale: [0.8, 1.2, 0.8],
                        opacity: [0.4, 1, 0.4]
                    }}
                    transition={{ duration: spark.dur, delay: spark.del, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

/* ── BUILDABLE: Code editor / IDE mockup with stacking blocks ── */
function BuildableElement() {
    return (
        <div className="relative w-full h-full" style={{ perspective: '1200px' }}>
            {/* Main IDE window */}
            <motion.div
                className="absolute rounded-3xl overflow-hidden"
                style={{
                    width: '75%', height: '75%', right: '5%', top: '12%',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                    border: '1px solid rgba(255,255,255,0.25)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                }}
                animate={{ y: [0, -6, 0], rotateY: [0, -2, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            >
                {/* Window chrome */}
                <div className="p-4 flex items-center gap-2 border-b border-white/10">
                    <div className="w-3 h-3 rounded-full bg-red-300/40" />
                    <div className="w-3 h-3 rounded-full bg-yellow-300/40" />
                    <div className="w-3 h-3 rounded-full bg-green-300/40" />
                    <div className="ml-4 w-24 h-4 rounded bg-white/10" />
                </div>
                <div className="flex h-[calc(100%-48px)]">
                    {/* Sidebar - file tree */}
                    <div className="w-1/4 border-r border-white/10 p-3 space-y-2">
                        {[0.12, 0.08, 0.10, 0.06, 0.09, 0.07].map((op, i) => (
                            <motion.div
                                key={i}
                                className="h-3 rounded"
                                style={{ background: `rgba(99,102,241,${op})`, width: `${60 + (i % 3) * 15}%`, marginLeft: i > 2 ? 12 : 0 }}
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 3, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        ))}
                    </div>
                    {/* Code area */}
                    <div className="flex-1 p-4 space-y-2">
                        {/* Code lines */}
                        {[
                            { w: '70%', op: 0.15, c: 'indigo' },
                            { w: '55%', op: 0.10, c: 'blue' },
                            { w: '80%', op: 0.12, c: 'indigo' },
                            { w: '45%', op: 0.08, c: 'purple' },
                            { w: '65%', op: 0.14, c: 'indigo' },
                            { w: '50%', op: 0.10, c: 'blue' },
                            { w: '75%', op: 0.12, c: 'indigo' },
                            { w: '40%', op: 0.08, c: 'purple' },
                        ].map((line, i) => (
                            <motion.div
                                key={i}
                                className="flex items-center gap-2"
                                animate={{ opacity: [0.6, 1, 0.6] }}
                                transition={{ duration: 2, delay: i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <span className="text-[10px] w-4 text-indigo-400/30 select-none">{i + 1}</span>
                                <div className="h-2.5 rounded" style={{ width: line.w, background: `rgba(99,102,241,${line.op})`, marginLeft: i === 1 || i === 3 || i === 5 ? 12 : 0 }} />
                            </motion.div>
                        ))}
                        {/* Cursor blink */}
                        <motion.div
                            className="w-0.5 h-4 bg-indigo-400/50 ml-6"
                            animate={{ opacity: [1, 1, 0, 0] }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear', times: [0, 0.5, 0.5, 1] }}
                        />
                    </div>
                </div>
            </motion.div>

            {/* Floating building blocks */}
            {[
                { x: '2%', y: '25%', w: 50, h: 50, r: 12, d: 0 },
                { x: '8%', y: '55%', w: 40, h: 40, r: 10, d: 0.5 },
                { x: '0%', y: '70%', w: 35, h: 35, r: 8, d: 1 },
            ].map((b, i) => (
                <motion.div
                    key={i}
                    className="absolute"
                    style={{
                        width: b.w, height: b.h, left: b.x, top: b.y,
                        borderRadius: b.r,
                        background: 'rgba(99,102,241,0.06)',
                        border: '1px solid rgba(99,102,241,0.15)',
                    }}
                    animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
                    transition={{ duration: 5, delay: b.d, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

/* ── LAUNCHABLE: Deployment pipeline / CI-CD dashboard ── */
function LaunchableElement() {
    return (
        <div className="relative w-full h-full" style={{ perspective: '1200px' }}>
            {/* Main deployment dashboard */}
            <motion.div
                className="absolute rounded-3xl overflow-hidden"
                style={{
                    width: '75%', height: '78%', left: '5%', top: '11%',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                    border: '1px solid rgba(255,255,255,0.25)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                }}
                animate={{ y: [0, -6, 0], rotateY: [0, 3, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            >
                <div className="p-5 h-full flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-400/50" />
                            <div className="w-20 h-3 rounded bg-amber-300/15" />
                        </div>
                        <div className="w-16 h-5 rounded-full bg-white/10" />
                    </div>

                    {/* Pipeline stages */}
                    <div className="flex items-center gap-1 mb-5">
                        {[
                            { label: 'Build', color: 'rgba(34,197,94,0.3)', done: true },
                            { label: 'Test', color: 'rgba(34,197,94,0.3)', done: true },
                            { label: 'Review', color: 'rgba(34,197,94,0.3)', done: true },
                            { label: 'Stage', color: 'rgba(251,191,36,0.3)', done: false },
                            { label: 'Deploy', color: 'rgba(251,146,60,0.15)', done: false },
                        ].map((stage, i) => (
                            <div key={i} className="flex items-center flex-1">
                                <motion.div
                                    className="flex-1 h-8 rounded-lg flex items-center justify-center"
                                    style={{ background: stage.color, border: `1px solid ${stage.done ? 'rgba(34,197,94,0.2)' : 'rgba(251,146,60,0.15)'}` }}
                                    animate={stage.done ? {} : { opacity: [0.6, 1, 0.6] }}
                                    transition={{ duration: 2, delay: i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                    <span className="text-[9px] font-medium" style={{ color: stage.done ? 'rgba(34,197,94,0.7)' : 'rgba(251,146,60,0.6)' }}>
                                        {stage.done ? '✓' : '●'}
                                    </span>
                                </motion.div>
                                {i < 4 && <div className="w-2 h-px bg-white/15" />}
                            </div>
                        ))}
                    </div>

                    {/* Metrics row */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {[
                            { value: '99.9%', label: 'Uptime' },
                            { value: '142ms', label: 'Latency' },
                            { value: '0', label: 'Errors' },
                        ].map((metric, i) => (
                            <motion.div
                                key={i}
                                className="rounded-xl p-3 text-center"
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                                animate={{ y: [0, -2, 0] }}
                                transition={{ duration: 3, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <div className="text-sm font-semibold" style={{ color: 'rgba(251,146,60,0.6)' }}>{metric.value}</div>
                                <div className="text-[8px] mt-0.5" style={{ color: 'rgba(0,0,0,0.25)' }}>{metric.label}</div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Activity graph */}
                    <div className="flex-1 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <svg className="w-full h-full" viewBox="0 0 300 80" fill="none" preserveAspectRatio="none">
                            <motion.path
                                d="M0,60 C30,55 60,40 90,45 C120,50 150,20 180,25 C210,30 240,15 270,10 L300,12"
                                stroke="rgba(251,146,60,0.35)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                animate={{
                                    d: [
                                        'M0,60 C30,55 60,40 90,45 C120,50 150,20 180,25 C210,30 240,15 270,10 L300,12',
                                        'M0,55 C30,50 60,45 90,35 C120,40 150,25 180,20 C210,22 240,18 270,8 L300,5',
                                        'M0,60 C30,55 60,40 90,45 C120,50 150,20 180,25 C210,30 240,15 270,10 L300,12',
                                    ]
                                }}
                                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                            />
                            <motion.path
                                d="M0,65 C30,60 60,50 90,55 C120,58 150,40 180,42 C210,44 240,35 270,30 L300,28"
                                stroke="rgba(34,197,94,0.2)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                animate={{
                                    d: [
                                        'M0,65 C30,60 60,50 90,55 C120,58 150,40 180,42 C210,44 240,35 270,30 L300,28',
                                        'M0,62 C30,58 60,52 90,48 C120,52 150,38 180,35 C210,37 240,30 270,25 L300,22',
                                        'M0,65 C30,60 60,50 90,55 C120,58 150,40 180,42 C210,44 240,35 270,30 L300,28',
                                    ]
                                }}
                                transition={{ duration: 6, delay: 1, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        </svg>
                    </div>

                    {/* Go live button */}
                    <motion.div
                        className="mt-3 h-9 rounded-xl flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(135deg, rgba(251,146,60,0.2), rgba(245,158,11,0.15))',
                            border: '1px solid rgba(251,146,60,0.25)',
                        }}
                        animate={{ scale: [1, 1.02, 1], opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <span className="text-[11px] font-semibold tracking-wider" style={{ color: 'rgba(251,146,60,0.7)' }}>● GO LIVE</span>
                    </motion.div>
                </div>
            </motion.div>

            {/* Floating notification badges */}
            {[
                { x: '78%', y: '18%', d: 0 },
                { x: '85%', y: '42%', d: 0.8 },
                { x: '80%', y: '68%', d: 1.5 },
            ].map((n, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-xl"
                    style={{
                        width: 44, height: 44, left: n.x, top: n.y,
                        background: 'rgba(255,255,255,0.12)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18,
                    }}
                    animate={{ y: [0, -6, 0], rotate: [0, 3, 0], scale: [0.9, 1.05, 0.9] }}
                    transition={{ duration: 4, delay: n.d, repeat: Infinity, ease: 'easeInOut' }}
                >
                    {['📦', '⚡', '🎯'][i]}
                </motion.div>
            ))}
        </div>
    );
}

/* ── MEMORABLE: Brand identity board with logo mark, colors, typography ── */
function MemorableElement() {
    return (
        <div className="relative w-full h-full" style={{ perspective: '1200px' }}>
            {/* Main brand board */}
            <motion.div
                className="absolute rounded-3xl overflow-hidden"
                style={{
                    width: '72%', height: '72%', right: '5%', top: '14%',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                    border: '1px solid rgba(255,255,255,0.25)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                }}
                animate={{ y: [0, -8, 0], rotateY: [0, -2, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            >
                <div className="p-5 h-full flex flex-col">
                    {/* Logo mark area */}
                    <div className="flex items-center justify-center flex-1">
                        <div className="relative">
                            {/* Outer ring */}
                            <motion.div
                                className="w-28 h-28 rounded-full"
                                style={{ border: '3px solid rgba(168,85,247,0.2)' }}
                                animate={{ rotate: [0, 360] }}
                                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                            />
                            {/* Color segments on ring */}
                            <motion.svg
                                className="absolute inset-0 w-28 h-28"
                                viewBox="0 0 100 100"
                                animate={{ rotate: [0, -360] }}
                                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                            >
                                <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(34,211,238,0.4)" strokeWidth="3" strokeDasharray="30 250" strokeLinecap="round" />
                                <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(244,114,182,0.4)" strokeWidth="3" strokeDasharray="30 250" strokeDashoffset="-72" strokeLinecap="round" />
                                <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(251,191,36,0.4)" strokeWidth="3" strokeDasharray="30 250" strokeDashoffset="-144" strokeLinecap="round" />
                            </motion.svg>
                            {/* Inner circle */}
                            <motion.div
                                className="absolute rounded-full bg-white/20"
                                style={{ width: 20, height: 20, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        </div>
                    </div>

                    {/* Color palette row */}
                    <div className="flex gap-2 mb-3">
                        {['rgba(168,85,247,0.3)', 'rgba(34,211,238,0.3)', 'rgba(244,114,182,0.3)', 'rgba(251,191,36,0.3)', 'rgba(52,211,153,0.3)'].map((c, i) => (
                            <motion.div
                                key={i}
                                className="flex-1 h-6 rounded-lg"
                                style={{ background: c }}
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        ))}
                    </div>

                    {/* Typography preview */}
                    <div className="space-y-1">
                        <div className="w-3/4 h-3 rounded bg-purple-300/15" />
                        <div className="w-1/2 h-2 rounded bg-purple-200/10" />
                    </div>
                </div>
            </motion.div>

            {/* Floating accent cards */}
            {[
                { x: '2%', y: '20%', w: 55, h: 55, d: 0 },
                { x: '8%', y: '60%', w: 40, h: 40, d: 0.8 },
                { x: '88%', y: '80%', w: 35, h: 35, d: 1.5 },
            ].map((c, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-xl"
                    style={{
                        width: c.w, height: c.h, left: c.x, top: c.y,
                        background: 'rgba(255,255,255,0.12)',
                        border: '1px solid rgba(255,255,255,0.2)',
                    }}
                    animate={{ y: [0, -8, 0], rotate: [0, 3, 0] }}
                    transition={{ duration: 5, delay: c.d, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

/* ── EVOLVABLE: Morphing shapes, DNA-like transformation, evolving elements ── */
function EvolvableElement() {
    return (
        <div className="relative w-full h-full" style={{ perspective: '1200px' }}>
            {/* Main transformation panel */}
            <motion.div
                className="absolute rounded-3xl overflow-hidden"
                style={{
                    width: '72%', height: '72%', right: '5%', top: '14%',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                    border: '1px solid rgba(255,255,255,0.25)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                }}
                animate={{ y: [0, -6, 0], rotateY: [0, 2, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            >
                <div className="p-5 h-full flex flex-col items-center justify-center gap-6">
                    {/* Morphing shapes row */}
                    <div className="flex items-center gap-8">
                        {/* Shape 1: Circle morphing to square */}
                        <motion.div
                            className="w-16 h-16"
                            style={{ background: 'rgba(20,184,166,0.15)', border: '1.5px solid rgba(20,184,166,0.25)' }}
                            animate={{
                                borderRadius: ['50%', '15%', '50%'],
                                rotate: [0, 90, 0],
                                scale: [1, 1.1, 1],
                            }}
                            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                        />

                        {/* Arrow indicator */}
                        <motion.div
                            className="text-teal-400/40 text-xl"
                            animate={{ x: [0, 5, 0], opacity: [0.3, 0.7, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            →
                        </motion.div>

                        {/* Shape 2: Triangle morphing to diamond */}
                        <motion.div
                            className="w-16 h-16"
                            style={{ background: 'rgba(6,182,212,0.15)', border: '1.5px solid rgba(6,182,212,0.25)' }}
                            animate={{
                                borderRadius: ['50% 0% 50% 50%', '15%', '50% 0% 50% 50%'],
                                rotate: [0, 180, 360],
                                scale: [1, 1.1, 1],
                            }}
                            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                        />

                        {/* Arrow indicator */}
                        <motion.div
                            className="text-teal-400/40 text-xl"
                            animate={{ x: [0, 5, 0], opacity: [0.3, 0.7, 0.3] }}
                            transition={{ duration: 2, delay: 0.5, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            →
                        </motion.div>

                        {/* Shape 3: Final evolved form */}
                        <motion.div
                            className="w-16 h-16"
                            style={{ background: 'rgba(52,211,153,0.15)', border: '1.5px solid rgba(52,211,153,0.25)' }}
                            animate={{
                                borderRadius: ['25%', '50%', '10%', '50%', '25%'],
                                rotate: [0, 45, 90, 45, 0],
                                scale: [1, 1.15, 1, 1.15, 1],
                            }}
                            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                        />
                    </div>

                    {/* DNA-like double helix */}
                    <svg width="200" height="60" viewBox="0 0 200 60" fill="none" className="opacity-40">
                        <motion.path
                            d="M0,30 C25,5 50,55 75,30 C100,5 125,55 150,30 C175,5 200,55 200,30"
                            stroke="rgba(20,184,166,0.5)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            animate={{
                                d: [
                                    'M0,30 C25,5 50,55 75,30 C100,5 125,55 150,30 C175,5 200,55 200,30',
                                    'M0,30 C25,55 50,5 75,30 C100,55 125,5 150,30 C175,55 200,5 200,30',
                                    'M0,30 C25,5 50,55 75,30 C100,5 125,55 150,30 C175,5 200,55 200,30',
                                ]
                            }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.path
                            d="M0,30 C25,55 50,5 75,30 C100,55 125,5 150,30 C175,55 200,5 200,30"
                            stroke="rgba(6,182,212,0.5)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            animate={{
                                d: [
                                    'M0,30 C25,55 50,5 75,30 C100,55 125,5 150,30 C175,55 200,5 200,30',
                                    'M0,30 C25,5 50,55 75,30 C100,5 125,55 150,30 C175,5 200,55 200,30',
                                    'M0,30 C25,55 50,5 75,30 C100,55 125,5 150,30 C175,55 200,5 200,30',
                                ]
                            }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        {/* Connecting nodes */}
                        {[25, 75, 125, 175].map((cx, i) => (
                            <motion.circle
                                key={i}
                                cx={cx} cy="30" r="3"
                                fill="rgba(20,184,166,0.4)"
                                animate={{ r: [3, 5, 3], opacity: [0.4, 0.8, 0.4] }}
                                transition={{ duration: 2, delay: i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        ))}
                    </svg>

                    {/* Progress / evolution bar */}
                    <div className="w-3/4 h-2 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                            className="h-full rounded-full"
                            style={{ background: 'linear-gradient(90deg, rgba(20,184,166,0.4), rgba(6,182,212,0.4), rgba(52,211,153,0.4))' }}
                            animate={{ width: ['20%', '100%', '20%'] }}
                            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                        />
                    </div>
                </div>
            </motion.div>

            {/* Floating evolving particles */}
            {[
                { x: '5%', y: '30%', d: 0 },
                { x: '10%', y: '60%', d: 0.8 },
                { x: '2%', y: '75%', d: 1.5 },
            ].map((p, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        width: 12, height: 12, left: p.x, top: p.y,
                        background: 'rgba(20,184,166,0.2)',
                        border: '1px solid rgba(20,184,166,0.3)',
                    }}
                    animate={{
                        borderRadius: ['50%', '20%', '50%'],
                        scale: [1, 1.5, 1],
                        opacity: [0.3, 0.7, 0.3],
                    }}
                    transition={{ duration: 3, delay: p.d, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}
