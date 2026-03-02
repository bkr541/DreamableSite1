'use client';

import { motion } from 'motion/react';

export default function HeroRibbons() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Soft glow base */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full bg-gradient-to-r from-cyan-100/20 via-purple-100/15 to-pink-100/20 blur-[80px]" />

            <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 1400 800"
                fill="none"
                preserveAspectRatio="xMidYMid slice"
            >
                <defs>
                    {/* Ribbon 1: Cyan to Teal */}
                    <linearGradient id="ribbon1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(6,182,212,0.35)" />
                        <stop offset="50%" stopColor="rgba(34,211,238,0.25)" />
                        <stop offset="100%" stopColor="rgba(20,184,166,0.15)" />
                    </linearGradient>
                    {/* Ribbon 2: Pink to Purple */}
                    <linearGradient id="ribbon2" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(244,114,182,0.3)" />
                        <stop offset="50%" stopColor="rgba(192,132,252,0.2)" />
                        <stop offset="100%" stopColor="rgba(168,85,247,0.15)" />
                    </linearGradient>
                    {/* Ribbon 3: Yellow to Orange */}
                    <linearGradient id="ribbon3" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(251,191,36,0.25)" />
                        <stop offset="50%" stopColor="rgba(251,146,60,0.2)" />
                        <stop offset="100%" stopColor="rgba(245,158,11,0.12)" />
                    </linearGradient>
                    {/* Ribbon 4: Iridescent multi */}
                    <linearGradient id="ribbon4" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(6,182,212,0.2)" />
                        <stop offset="30%" stopColor="rgba(168,85,247,0.18)" />
                        <stop offset="60%" stopColor="rgba(244,114,182,0.2)" />
                        <stop offset="100%" stopColor="rgba(34,211,238,0.12)" />
                    </linearGradient>
                    {/* Sheen filter */}
                    <filter id="ribbonBlur">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
                    </filter>
                </defs>

                {/* Ribbon 1 – Cyan, flowing across center */}
                <motion.path
                    d="M-100,420 C150,350 350,500 600,380 C850,260 1050,450 1300,350 L1500,380 L1500,440 C1250,520 1050,380 800,460 C550,540 350,380 100,480 L-100,460 Z"
                    fill="url(#ribbon1)"
                    filter="url(#ribbonBlur)"
                    animate={{
                        d: [
                            'M-100,420 C150,350 350,500 600,380 C850,260 1050,450 1300,350 L1500,380 L1500,440 C1250,520 1050,380 800,460 C550,540 350,380 100,480 L-100,460 Z',
                            'M-100,400 C150,320 350,480 600,400 C850,320 1050,420 1300,370 L1500,400 L1500,460 C1250,500 1050,400 800,440 C550,480 350,360 100,460 L-100,440 Z',
                            'M-100,420 C150,350 350,500 600,380 C850,260 1050,450 1300,350 L1500,380 L1500,440 C1250,520 1050,380 800,460 C550,540 350,380 100,480 L-100,460 Z',
                        ],
                    }}
                    transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Ribbon 2 – Pink/Purple, upper sweep */}
                <motion.path
                    d="M-50,300 C200,220 400,380 650,280 C900,180 1100,320 1400,240 L1500,260 L1500,310 C1200,380 1000,250 750,340 C500,430 300,280 50,370 L-50,350 Z"
                    fill="url(#ribbon2)"
                    filter="url(#ribbonBlur)"
                    animate={{
                        d: [
                            'M-50,300 C200,220 400,380 650,280 C900,180 1100,320 1400,240 L1500,260 L1500,310 C1200,380 1000,250 750,340 C500,430 300,280 50,370 L-50,350 Z',
                            'M-50,320 C200,260 400,350 650,300 C900,250 1100,340 1400,280 L1500,300 L1500,350 C1200,400 1000,310 750,360 C500,410 300,300 50,350 L-50,330 Z',
                            'M-50,300 C200,220 400,380 650,280 C900,180 1100,320 1400,240 L1500,260 L1500,310 C1200,380 1000,250 750,340 C500,430 300,280 50,370 L-50,350 Z',
                        ],
                    }}
                    transition={{ duration: 14, delay: 1, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Ribbon 3 – Yellow/Orange, lower sweep */}
                <motion.path
                    d="M-100,520 C150,480 400,580 650,500 C900,420 1100,540 1400,480 L1500,500 L1500,545 C1200,590 1000,490 750,550 C500,610 300,500 50,570 L-100,560 Z"
                    fill="url(#ribbon3)"
                    filter="url(#ribbonBlur)"
                    animate={{
                        d: [
                            'M-100,520 C150,480 400,580 650,500 C900,420 1100,540 1400,480 L1500,500 L1500,545 C1200,590 1000,490 750,550 C500,610 300,500 50,570 L-100,560 Z',
                            'M-100,540 C150,500 400,560 650,510 C900,460 1100,520 1400,490 L1500,510 L1500,555 C1200,580 1000,510 750,540 C500,570 300,510 50,550 L-100,540 Z',
                            'M-100,520 C150,480 400,580 650,500 C900,420 1100,540 1400,480 L1500,500 L1500,545 C1200,590 1000,490 750,550 C500,610 300,500 50,570 L-100,560 Z',
                        ],
                    }}
                    transition={{ duration: 10, delay: 2, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Ribbon 4 – Thin iridescent accent line */}
                <motion.path
                    d="M-50,380 C200,320 450,440 700,360 C950,280 1150,400 1450,340"
                    stroke="url(#ribbon4)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                    animate={{
                        d: [
                            'M-50,380 C200,320 450,440 700,360 C950,280 1150,400 1450,340',
                            'M-50,360 C200,300 450,420 700,380 C950,340 1150,380 1450,360',
                            'M-50,380 C200,320 450,440 700,360 C950,280 1150,400 1450,340',
                        ],
                    }}
                    transition={{ duration: 8, delay: 0.5, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Ribbon 5 – Thin secondary accent */}
                <motion.path
                    d="M-50,450 C250,400 500,510 750,430 C1000,350 1200,470 1500,410"
                    stroke="url(#ribbon1)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.5"
                    animate={{
                        d: [
                            'M-50,450 C250,400 500,510 750,430 C1000,350 1200,470 1500,410',
                            'M-50,430 C250,380 500,480 750,440 C1000,400 1200,440 1500,420',
                            'M-50,450 C250,400 500,510 750,430 C1000,350 1200,470 1500,410',
                        ],
                    }}
                    transition={{ duration: 11, delay: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
            </svg>

            {/* Sparkle accents */}
            {[
                { x: '15%', y: '25%', d: 0 },
                { x: '70%', y: '35%', d: 1.5 },
                { x: '45%', y: '65%', d: 3 },
                { x: '85%', y: '55%', d: 2 },
            ].map((s, i) => (
                <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full"
                    style={{
                        left: s.x, top: s.y,
                        background: 'radial-gradient(circle, rgba(255,255,255,0.8), rgba(200,220,255,0.3))',
                    }}
                    animate={{
                        scale: [0, 1.5, 0],
                        opacity: [0, 0.8, 0],
                    }}
                    transition={{ duration: 4, delay: s.d, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}
