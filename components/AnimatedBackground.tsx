'use client';
import { motion } from 'motion/react';

type Theme = 'evolvable' | 'buildable' | 'launchable' | 'memorable' | 'dreamable';

const gradients: Record<Theme, string> = {
    evolvable: 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 40%, #ecfdf5 100%)',
    buildable: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 40%, #f0f4ff 100%)',
    launchable: 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 40%, #fef3c7 100%)',
    memorable: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 40%, #fdf2f8 100%)',
    dreamable: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 40%, #faf5ff 100%)',
};

const glows: Record<Theme, string> = {
    evolvable: 'rgba(20, 184, 166, 0.2)',
    buildable: 'rgba(99, 102, 241, 0.2)',
    launchable: 'rgba(251, 146, 60, 0.2)',
    memorable: 'rgba(168, 85, 247, 0.2)',
    dreamable: 'rgba(244, 114, 182, 0.2)',
};

const curveColors: Record<Theme, [string, string, string]> = {
    evolvable: ['rgba(20,184,166,0.25)', 'rgba(6,182,212,0.18)', 'rgba(52,211,153,0.14)'],
    buildable: ['rgba(99,102,241,0.25)', 'rgba(129,140,248,0.18)', 'rgba(79,70,229,0.14)'],
    launchable: ['rgba(251,146,60,0.25)', 'rgba(245,158,11,0.18)', 'rgba(249,115,22,0.14)'],
    memorable: ['rgba(168,85,247,0.25)', 'rgba(192,132,252,0.18)', 'rgba(147,51,234,0.14)'],
    dreamable: ['rgba(244,114,182,0.25)', 'rgba(236,72,153,0.18)', 'rgba(251,146,182,0.14)'],
};

export default function SplineBackground({ theme }: { theme: Theme }) {
    const cc = curveColors[theme];
    return (
        <div className="absolute inset-0 overflow-hidden" style={{ background: gradients[theme] }}>
            <motion.div
                className="absolute rounded-full"
                style={{
                    width: 700, height: 700, left: '50%', top: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: `radial-gradient(circle, ${glows[theme]}, transparent 70%)`,
                }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 800" preserveAspectRatio="none" fill="none">
                <motion.g animate={{ y: [0, 12, 0] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}>
                    <path d="M-50,200 C200,150 400,280 600,200 S1000,240 1250,180" stroke={cc[0]} strokeWidth="1.5" />
                </motion.g>
                <motion.g animate={{ y: [0, -8, 0] }} transition={{ duration: 10, delay: 1, repeat: Infinity, ease: 'easeInOut' }}>
                    <path d="M-50,400 C150,370 350,440 550,380 S850,420 1250,400" stroke={cc[1]} strokeWidth="1" />
                </motion.g>
                <motion.g animate={{ y: [0, 10, 0] }} transition={{ duration: 12, delay: 2, repeat: Infinity, ease: 'easeInOut' }}>
                    <path d="M-50,600 C250,580 450,640 650,590 S1050,620 1250,600" stroke={cc[2]} strokeWidth="1" />
                </motion.g>
            </svg>
            <ThemeElements theme={theme} />
        </div>
    );
}

function ThemeElements({ theme }: { theme: Theme }) {
    switch (theme) {
        case 'evolvable': return <EvolvableElements />;
        case 'buildable': return <BuildableElements />;
        case 'launchable': return <LaunchableElements />;
        case 'memorable': return <MemorableElements />;
        case 'dreamable': return <DreamableElements />;
    }
}

/* ── EVOLVABLE: Morphing shapes, orbit rings, network nodes ── */
function EvolvableElements() {
    return (
        <div className="absolute inset-0" style={{ perspective: '1200px' }}>
            <motion.div
                className="absolute rounded-full"
                style={{ width: 280, height: 280, left: '8%', top: '10%', border: '2px solid rgba(20,184,166,0.2)', transformStyle: 'preserve-3d' }}
                animate={{ rotateX: [0, 360], rotateY: [0, 180] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
                className="absolute"
                style={{ width: 220, height: 220, right: '12%', top: '15%', background: 'radial-gradient(circle, rgba(6,182,212,0.12), transparent 70%)', borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%' }}
                animate={{ borderRadius: ['30% 70% 70% 30% / 30% 30% 70% 70%', '70% 30% 30% 70% / 70% 70% 30% 30%', '30% 70% 70% 30% / 30% 30% 70% 70%'], rotate: [0, 180, 0] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className="absolute rounded-2xl"
                style={{ width: 180, height: 130, left: '60%', top: '55%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}
                animate={{ y: [0, -15, 0], rotateY: [0, 5, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className="absolute rounded-full"
                style={{ width: 200, height: 200, right: '8%', bottom: '20%', border: '1.5px solid rgba(20,184,166,0.15)', transformStyle: 'preserve-3d' }}
                animate={{ rotateX: [0, -360], rotateZ: [0, 360] }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
            />
            {[{ x: '25%', y: '60%', s: 14 }, { x: '40%', y: '28%', s: 10 }, { x: '78%', y: '72%', s: 12 }, { x: '52%', y: '42%', s: 8 }, { x: '15%', y: '75%', s: 10 }].map((n, i) => (
                <motion.div key={i} className="absolute rounded-full bg-teal-400/30" style={{ width: n.s, height: n.s, left: n.x, top: n.y }}
                    animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 3, delay: i * 0.6, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

/* ── BUILDABLE: 3D blocks, grid structure, stacking elements ── */
function BuildableElements() {
    return (
        <div className="absolute inset-0" style={{ perspective: '1000px' }}>
            {/* 3D Cube face 1 */}
            <motion.div
                className="absolute rounded-xl"
                style={{ width: 120, height: 120, left: '12%', top: '20%', background: 'rgba(99,102,241,0.08)', border: '1.5px solid rgba(99,102,241,0.15)', transformStyle: 'preserve-3d' }}
                animate={{ rotateX: [0, 15, 0], rotateY: [0, 20, 0], y: [0, -10, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className="absolute rounded-xl"
                style={{ width: 100, height: 100, left: '15%', top: '23%', background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.12)', transformStyle: 'preserve-3d' }}
                animate={{ rotateX: [0, 15, 0], rotateY: [0, 20, 0], y: [0, -10, 0] }}
                transition={{ duration: 8, delay: 0.3, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Stacking blocks */}
            {[{ x: '70%', y: '15%', w: 140, h: 90 }, { x: '72%', y: '22%', w: 130, h: 85 }, { x: '74%', y: '29%', w: 120, h: 80 }].map((b, i) => (
                <motion.div key={i} className="absolute rounded-lg"
                    style={{ width: b.w, height: b.h, left: b.x, top: b.y, background: `rgba(99,102,241,${0.04 + i * 0.03})`, border: '1px solid rgba(99,102,241,0.12)' }}
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 6, delay: i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}
            {/* Blueprint grid */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.06]" viewBox="0 0 1200 800">
                {Array.from({ length: 12 }).map((_, i) => <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2="800" stroke="rgb(99,102,241)" strokeWidth="1" />)}
                {Array.from({ length: 8 }).map((_, i) => <line key={`h${i}`} x1="0" y1={i * 100} x2="1200" y2={i * 100} stroke="rgb(99,102,241)" strokeWidth="1" />)}
            </svg>
            {/* Glass panel */}
            <motion.div
                className="absolute rounded-2xl"
                style={{ width: 200, height: 150, left: '35%', top: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}
                animate={{ y: [0, -12, 0], rotateX: [0, 3, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Structural connector dots */}
            {[{ x: '30%', y: '35%' }, { x: '50%', y: '20%' }, { x: '85%', y: '60%' }, { x: '20%', y: '70%' }].map((d, i) => (
                <motion.div key={i} className="absolute rounded-full bg-indigo-400/25" style={{ width: 10, height: 10, left: d.x, top: d.y }}
                    animate={{ scale: [1, 1.6, 1], opacity: [0.25, 0.6, 0.25] }}
                    transition={{ duration: 4, delay: i * 0.8, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

/* ── LAUNCHABLE: Trajectory arcs, expanding rings, upward motion ── */
function LaunchableElements() {
    return (
        <div className="absolute inset-0" style={{ perspective: '1000px' }}>
            {/* Expanding rings */}
            {[0, 2, 4].map((delay, i) => (
                <motion.div key={i} className="absolute rounded-full"
                    style={{ width: 200, height: 200, left: '20%', top: '40%', border: '1.5px solid rgba(251,146,60,0.2)', transform: 'translate(-50%,-50%)' }}
                    animate={{ scale: [0.5, 2.5], opacity: [0.5, 0] }}
                    transition={{ duration: 6, delay, repeat: Infinity, ease: 'easeOut' }}
                />
            ))}
            {/* Upward chevrons */}
            {[{ x: '75%', y: '70%', s: 40, d: 0 }, { x: '78%', y: '55%', s: 35, d: 0.5 }, { x: '81%', y: '40%', s: 30, d: 1 }].map((c, i) => (
                <motion.div key={i} className="absolute" style={{ left: c.x, top: c.y, width: c.s, height: c.s, borderTop: '2px solid rgba(245,158,11,0.25)', borderRight: '2px solid rgba(245,158,11,0.25)', transform: 'rotate(-45deg)' }}
                    animate={{ y: [0, -20, 0], opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 3, delay: c.d, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}
            {/* Trajectory arc */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 800" fill="none">
                <motion.path d="M200,700 Q400,200 600,350 T1000,100" stroke="rgba(251,146,60,0.15)" strokeWidth="2" strokeDasharray="8 4"
                    animate={{ strokeDashoffset: [0, -100] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                />
            </svg>
            {/* Rising particles */}
            {[{ x: '30%', d: 0 }, { x: '45%', d: 1.5 }, { x: '60%', d: 0.8 }, { x: '50%', d: 2.2 }, { x: '35%', d: 1 }].map((p, i) => (
                <motion.div key={i} className="absolute rounded-full bg-amber-400/30" style={{ width: 6, height: 6, left: p.x, bottom: '10%' }}
                    animate={{ y: [0, -500], opacity: [0.6, 0], scale: [1, 0.3] }}
                    transition={{ duration: 5, delay: p.d, repeat: Infinity, ease: 'easeOut' }}
                />
            ))}
            {/* Glass panel */}
            <motion.div className="absolute rounded-2xl"
                style={{ width: 160, height: 110, right: '10%', top: '20%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
        </div>
    );
}

/* ── MEMORABLE: Prism shapes, light beams, crystalline geometry ── */
function MemorableElements() {
    return (
        <div className="absolute inset-0" style={{ perspective: '1200px' }}>
            {/* Diamond / prism */}
            <motion.div className="absolute"
                style={{ width: 120, height: 120, left: '15%', top: '20%', background: 'rgba(168,85,247,0.06)', border: '1.5px solid rgba(168,85,247,0.15)', transform: 'rotate(45deg)', transformStyle: 'preserve-3d' }}
                animate={{ rotateX: [0, 20, 0], rotateZ: [45, 55, 45], scale: [1, 1.05, 1] }}
                transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div className="absolute"
                style={{ width: 80, height: 80, right: '20%', top: '15%', background: 'rgba(192,132,252,0.05)', border: '1px solid rgba(192,132,252,0.12)', transform: 'rotate(45deg)' }}
                animate={{ rotateZ: [45, 35, 45], y: [0, -15, 0] }}
                transition={{ duration: 8, delay: 1, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Light beams */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 800" fill="none">
                <motion.line x1="300" y1="0" x2="500" y2="800" stroke="rgba(168,85,247,0.06)" strokeWidth="40"
                    animate={{ x1: [300, 350, 300], x2: [500, 550, 500] }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.line x1="700" y1="0" x2="900" y2="800" stroke="rgba(192,132,252,0.04)" strokeWidth="60"
                    animate={{ x1: [700, 650, 700], x2: [900, 850, 900] }}
                    transition={{ duration: 12, delay: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
            </svg>
            {/* Glass panel */}
            <motion.div className="absolute rounded-2xl"
                style={{ width: 200, height: 140, left: '55%', top: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}
                animate={{ y: [0, -12, 0], rotateY: [0, -4, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Sparkle dots */}
            {[{ x: '35%', y: '30%' }, { x: '70%', y: '25%' }, { x: '80%', y: '65%' }, { x: '25%', y: '70%' }, { x: '60%', y: '75%' }].map((s, i) => (
                <motion.div key={i} className="absolute rounded-full bg-purple-400/30" style={{ width: 8, height: 8, left: s.x, top: s.y }}
                    animate={{ scale: [0, 1.5, 0], opacity: [0, 0.8, 0] }}
                    transition={{ duration: 3, delay: i * 0.7, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}
            {/* Rotating crystal ring */}
            <motion.div className="absolute rounded-full"
                style={{ width: 250, height: 250, right: '5%', bottom: '15%', border: '1.5px solid rgba(147,51,234,0.12)', transformStyle: 'preserve-3d' }}
                animate={{ rotateX: [60, 60], rotateZ: [0, 360] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />
        </div>
    );
}

/* ── DREAMABLE: Clouds, bubbles, ethereal glass cards ── */
function DreamableElements() {
    return (
        <div className="absolute inset-0" style={{ perspective: '1000px' }}>
            {/* Glassmorphism card with nested shapes (matching reference) */}
            <motion.div className="absolute rounded-3xl"
                style={{ width: 280, height: 220, left: '8%', top: '20%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(12px)' }}
                animate={{ y: [0, -10, 0], rotateY: [0, 3, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            >
                <div className="p-5 space-y-3">
                    <div className="flex gap-3">
                        <div className="w-24 h-16 rounded-xl bg-white/20" />
                        <div className="w-16 h-16 rounded-full bg-white/15" />
                    </div>
                    <div className="w-full h-20 rounded-xl bg-white/10" />
                </div>
            </motion.div>
            {/* Floating bubbles */}
            {[{ x: '70%', y: '15%', s: 80 }, { x: '80%', y: '55%', s: 50 }, { x: '60%', y: '70%', s: 35 }, { x: '85%', y: '30%', s: 25 }, { x: '50%', y: '25%', s: 45 }].map((b, i) => (
                <motion.div key={i} className="absolute rounded-full"
                    style={{ width: b.s, height: b.s, left: b.x, top: b.y, background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3), rgba(244,114,182,0.08))', border: '1px solid rgba(255,255,255,0.15)' }}
                    animate={{ y: [0, -(10 + i * 5), 0], x: [0, (i % 2 === 0 ? 8 : -8), 0] }}
                    transition={{ duration: 5 + i, delay: i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}
            {/* Cloud shapes */}
            <motion.div className="absolute rounded-full"
                style={{ width: 300, height: 100, right: '5%', top: '60%', background: 'rgba(255,255,255,0.08)', filter: 'blur(20px)' }}
                animate={{ x: [0, 20, 0], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div className="absolute rounded-full"
                style={{ width: 250, height: 80, left: '20%', bottom: '15%', background: 'rgba(255,255,255,0.06)', filter: 'blur(15px)' }}
                animate={{ x: [0, -15, 0], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 12, delay: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Second smaller glass card */}
            <motion.div className="absolute rounded-2xl"
                style={{ width: 120, height: 90, left: '35%', top: '55%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
                animate={{ y: [0, -8, 0], rotate: [0, 2, 0] }}
                transition={{ duration: 7, delay: 1, repeat: Infinity, ease: 'easeInOut' }}
            />
        </div>
    );
}
