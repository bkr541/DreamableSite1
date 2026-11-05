'use client';

import dynamic from 'next/dynamic';
import OnlyWhenActive from './OnlyWhenActive';
import { codeSnippets, symbols, connections, nodes } from './heroRibbonsData';

/** The hero artwork held still: same glows, grid, graph lines, nodes and code snippets, no motion and no motion library. */
function StaticRibbons() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
            <div className="absolute top-1/3 left-1/4 w-[500px] h-[400px] rounded-full bg-cyan-200/30 blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[350px] rounded-full bg-purple-200/25 blur-[100px]" />
            <svg className="absolute inset-0 w-full h-full opacity-[0.07]">
                <defs>
                    <pattern id="grid-static" width="60" height="60" patternUnits="userSpaceOnUse">
                        <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1a1a1a" strokeWidth="0.5" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-static)" />
            </svg>
            <svg className="absolute inset-0 w-full h-full">
                {connections.map((c, i) => (
                    <line key={i} x1={`${c.x1}%`} y1={`${c.y1}%`} x2={`${c.x2}%`} y2={`${c.y2}%`} stroke="rgba(120,160,190,0.2)" strokeWidth="1" strokeDasharray="6 4" />
                ))}
            </svg>
            {nodes.map((n, i) => (
                <div key={i} className={`absolute w-2.5 h-2.5 rounded-full ${n.color}`} style={{ left: n.x, top: n.y, opacity: 0.45 }} />
            ))}
            {codeSnippets.map((s, i) => (
                <div key={i} className={`absolute font-mono ${s.size} text-[#1a1a1a]/[0.18] whitespace-nowrap`} style={{ left: s.x, top: s.y, transform: `rotate(${s.rotate}deg)` }}>
                    {s.code}
                </div>
            ))}
            {symbols.map((s, i) => (
                <div key={i} className="absolute font-mono text-lg md:text-xl text-[#1a1a1a]/[0.12] font-light" style={{ left: s.x, top: s.y }}>
                    {s.char}
                </div>
            ))}
        </div>
    );
}

const HeroRibbonsAnimated = dynamic(() => import('./HeroRibbonsAnimated'), { ssr: false });

export default function HeroRibbons() {
    return (
        <OnlyWhenActive className="absolute inset-0" onReducedMotion="hide" fallback={<StaticRibbons />}>
            <HeroRibbonsAnimated />
        </OnlyWhenActive>
    );
}
