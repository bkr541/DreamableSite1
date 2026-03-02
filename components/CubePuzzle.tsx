'use client';

import { motion } from 'motion/react';

const pieces = [
    { label: 'Dream', color: '#c084fc', shadow: 'rgba(192,132,252,0.4)', x: 0, y: -60, z: 0 },
    { label: 'Build', color: '#818cf8', shadow: 'rgba(129,140,248,0.4)', x: 55, y: 0, z: 0 },
    { label: 'Launch', color: '#67e8f9', shadow: 'rgba(103,232,249,0.4)', x: -55, y: 10, z: 0 },
    { label: 'Evolve', color: '#d4d4d8', shadow: 'rgba(212,212,216,0.5)', x: 0, y: -120, z: 0 },
    { label: 'Design', color: '#e2c08d', shadow: 'rgba(226,192,141,0.4)', x: -30, y: 50, z: 0 },
];

export default function CubePuzzle() {
    return (
        <div className="relative w-full h-full flex items-center justify-center" style={{ perspective: '800px' }}>
            <motion.div
                className="relative"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: 'rotateX(-20deg) rotateY(30deg)',
                }}
                animate={{ rotateY: [30, 35, 30, 25, 30] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            >
                {/* Central cube */}
                <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
                    {/* Main assembling pieces */}
                    {pieces.map((piece, i) => (
                        <motion.div
                            key={piece.label}
                            className="absolute"
                            style={{
                                width: i === 3 ? 110 : i === 0 ? 120 : 90,
                                height: i === 3 ? 45 : i === 0 ? 65 : 55,
                                left: '50%',
                                top: '50%',
                                transformStyle: 'preserve-3d',
                            }}
                            initial={{
                                x: piece.x * 3 - 45,
                                y: piece.y * 2 - 25,
                                opacity: 0,
                                scale: 0.5,
                            }}
                            animate={{
                                x: piece.x - 45,
                                y: piece.y - 25,
                                opacity: 1,
                                scale: 1,
                            }}
                            transition={{
                                duration: 1.2,
                                delay: i * 0.15,
                                ease: 'easeOut',
                            }}
                        >
                            {/* Top face */}
                            <div
                                className="absolute inset-0 rounded-lg flex items-center justify-center"
                                style={{
                                    background: `linear-gradient(135deg, ${piece.color}, ${piece.color}dd)`,
                                    transform: 'translateZ(25px)',
                                    boxShadow: `0 0 20px ${piece.shadow}`,
                                }}
                            >
                                <span className="text-white/90 text-xs font-semibold tracking-wide select-none" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                                    {piece.label}
                                </span>
                            </div>

                            {/* Front face */}
                            <div
                                className="absolute left-0 right-0 rounded-b-lg"
                                style={{
                                    height: 25,
                                    bottom: 0,
                                    background: `linear-gradient(180deg, ${piece.color}cc, ${piece.color}88)`,
                                    transform: 'rotateX(-90deg) translateZ(0px)',
                                    transformOrigin: 'bottom',
                                }}
                            />

                            {/* Right face */}
                            <div
                                className="absolute top-0 bottom-0 rounded-r-lg"
                                style={{
                                    width: 25,
                                    right: 0,
                                    background: `linear-gradient(90deg, ${piece.color}bb, ${piece.color}77)`,
                                    transform: 'rotateY(90deg) translateZ(0px)',
                                    transformOrigin: 'right',
                                }}
                            />
                        </motion.div>
                    ))}

                    {/* Floating accent pieces */}
                    {[
                        { x: -140, y: -80, size: 35, color: '#93c5fd', label: '✦', delay: 1.5 },
                        { x: 130, y: 60, size: 30, color: '#f0abfc', label: '◆', delay: 1.8 },
                        { x: 150, y: -100, size: 25, color: '#d4d4d8', label: '', delay: 2.0 },
                    ].map((accent, i) => (
                        <motion.div
                            key={`accent-${i}`}
                            className="absolute rounded-md"
                            style={{
                                width: accent.size,
                                height: accent.size,
                                left: '50%',
                                top: '50%',
                                background: `linear-gradient(135deg, ${accent.color}, ${accent.color}aa)`,
                                boxShadow: `0 4px 15px ${accent.color}40`,
                                transformStyle: 'preserve-3d',
                                transform: 'translateZ(10px)',
                            }}
                            initial={{ x: accent.x, y: accent.y, opacity: 0, scale: 0 }}
                            animate={{
                                x: accent.x,
                                y: [accent.y, accent.y - 8, accent.y],
                                opacity: 0.6,
                                scale: 1,
                            }}
                            transition={{
                                opacity: { duration: 0.6, delay: accent.delay },
                                scale: { duration: 0.6, delay: accent.delay },
                                y: { duration: 5 + i, delay: accent.delay, repeat: Infinity, ease: 'easeInOut' },
                            }}
                        >
                            {accent.label && (
                                <span className="flex items-center justify-center w-full h-full text-white/60 text-xs">
                                    {accent.label}
                                </span>
                            )}
                        </motion.div>
                    ))}

                    {/* Shadow on ground */}
                    <div
                        className="absolute rounded-full"
                        style={{
                            width: 200,
                            height: 40,
                            left: '50%',
                            top: '50%',
                            transform: 'translateX(-50%) translateY(80px) rotateX(90deg)',
                            background: 'radial-gradient(ellipse, rgba(0,0,0,0.08) 0%, transparent 70%)',
                        }}
                    />
                </div>
            </motion.div>
        </div>
    );
}
