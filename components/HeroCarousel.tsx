'use client';

import Image from 'next/image';
import { motion } from 'motion/react';

const floatingImages = [
    {
        src: '/images/carousel-1.jpg',
        alt: 'Marketing & Branding',
        style: { top: '8%', left: '3%', width: 220, height: 220 },
        animate: { y: [0, -18, 0], x: [0, 8, 0], rotate: [0, -3, 0] },
        duration: 10,
        delay: 0,
    },
    {
        src: '/images/carousel-2.jpg',
        alt: 'Automation',
        style: { top: '5%', right: '5%', width: 200, height: 200 },
        animate: { y: [0, -14, 0], x: [0, -10, 0], rotate: [0, 4, 0] },
        duration: 12,
        delay: 1.5,
    },
    {
        src: '/images/carousel-3.jpg',
        alt: 'Website Development',
        style: { bottom: '12%', left: '8%', width: 190, height: 190 },
        animate: { y: [0, -20, 0], x: [0, 12, 0], rotate: [0, 3, 0] },
        duration: 11,
        delay: 0.8,
    },
    {
        src: '/images/carousel-4.jpg',
        alt: 'Logo Design',
        style: { bottom: '8%', right: '3%', width: 210, height: 210 },
        animate: { y: [0, -16, 0], x: [0, -8, 0], rotate: [0, -4, 0] },
        duration: 13,
        delay: 2,
    },
    {
        src: '/images/carousel-5.jpg',
        alt: 'Custom Visuals',
        style: { top: '38%', right: '15%', width: 180, height: 180 },
        animate: { y: [0, -12, 0], x: [0, 6, 0], rotate: [0, 2, 0] },
        duration: 9,
        delay: 3,
    },
];

export default function HeroCarousel() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {floatingImages.map((img, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-2xl overflow-hidden shadow-xl"
                    style={{
                        ...img.style,
                        opacity: 0.25,
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{
                        opacity: 0.25,
                        scale: 1,
                        ...img.animate,
                    }}
                    transition={{
                        opacity: { duration: 1.2, delay: img.delay },
                        scale: { duration: 1.2, delay: img.delay },
                        y: { duration: img.duration, delay: img.delay, repeat: Infinity, ease: 'easeInOut' },
                        x: { duration: img.duration + 2, delay: img.delay, repeat: Infinity, ease: 'easeInOut' },
                        rotate: { duration: img.duration + 4, delay: img.delay, repeat: Infinity, ease: 'easeInOut' },
                    }}
                >
                    <Image
                        src={img.src}
                        alt={img.alt}
                        width={img.style.width as number}
                        height={img.style.height as number}
                        className="object-cover w-full h-full"
                    />
                </motion.div>
            ))}
        </div>
    );
}
