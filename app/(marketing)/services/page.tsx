'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ComputerPhoneSyncIcon, PaintBoardIcon, ThreeDViewIcon, AiInnovation02Icon } from '@hugeicons/core-free-icons';

export default function Services() {
  return (
    <div className="flex flex-col w-full">
      {/* Intro */}
      <section className="px-8 md:px-16 pt-32 pb-24 max-w-[1200px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight mb-8">Services</h1>
          <p className="text-xl md:text-2xl text-[#707070] leading-relaxed max-w-[800px]">
            We focus on small-team efficiency, not enterprise complexity. Everything we do is designed to get your product to market faster, with a stronger foundation.
          </p>
        </div>

        {/* Cascading stacked images */}
        <div className="relative h-[350px] md:h-[400px] hidden md:block">
          {[
            { src: '/images/carousel-1.jpg', alt: 'Marketing & Branding', left: '0%', top: '25%', rotate: -3, delay: 0, z: 5, gradient: 'linear-gradient(135deg, #f472b6, #a855f7)' },
            { src: '/images/carousel-2.jpg', alt: 'Automation', left: '14%', top: '15%', rotate: 2, delay: 0.12, z: 4, gradient: 'linear-gradient(135deg, #818cf8, #6366f1)' },
            { src: '/images/carousel-3.jpg', alt: 'Website Development', left: '28%', top: '22%', rotate: -1, delay: 0.24, z: 3, gradient: 'linear-gradient(135deg, #fb923c, #f59e0b)' },
            { src: '/images/carousel-4.jpg', alt: 'Logo Design', left: '42%', top: '12%', rotate: 3, delay: 0.36, z: 2, gradient: 'linear-gradient(135deg, #c084fc, #a855f7)' },
            { src: '/images/carousel-5.jpg', alt: 'Custom Visuals', left: '56%', top: '20%', rotate: -2, delay: 0.48, z: 1, gradient: 'linear-gradient(135deg, #2dd4bf, #06b6d4)' },
          ].map((img, i) => (
            <motion.div
              key={i}
              className="absolute rounded-2xl p-[3px]"
              style={{
                width: 190, height: 190,
                left: img.left, top: img.top,
                zIndex: img.z,
                rotate: img.rotate,
                background: img.gradient,
                boxShadow: '0 10px 35px rgba(0,0,0,0.1)',
              }}
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{
                opacity: 1, x: 0, y: [0, -(5 + i * 2), 0], scale: 1,
              }}
              transition={{
                opacity: { duration: 0.5, delay: img.delay },
                x: { duration: 0.6, delay: img.delay },
                scale: { duration: 0.5, delay: img.delay },
                y: { duration: 6 + i, delay: img.delay + 0.6, repeat: Infinity, ease: 'easeInOut' },
              }}
            >
              <div className="w-full h-full rounded-[13px] overflow-hidden">
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Service Blocks */}
      <section className="px-6 py-24 border-t border-[#F5F5F5] bg-[#F9F9F9]">
        <div className="max-w-[1200px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8">

          <div className="p-10 bg-white rounded-[32px] border border-[#E5E5E5] flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] mb-8 flex items-center justify-center">
              <HugeiconsIcon icon={ComputerPhoneSyncIcon} size={24} color="#4ECDC4" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">Software Development</h2>
            <ul className="space-y-4 text-[#707070] mt-auto">
              <li>Marketing websites that convert.</li>
              <li>Web applications built with modern stacks.</li>
              <li>Full native mobile apps (iOS & Android).</li>
              <li>Scalable Product UI systems.</li>
            </ul>
          </div>

          <div className="p-10 bg-white rounded-[32px] border border-[#E5E5E5] flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] mb-8 flex items-center justify-center">
              <HugeiconsIcon icon={PaintBoardIcon} size={24} color="#A855F7" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">Logo & Branding Design</h2>
            <ul className="space-y-4 text-[#707070] mt-auto">
              <li>Logo creation that stands the test of time.</li>
              <li>Identity systems that work across all touchpoints.</li>
              <li>Brand kits for internal teams.</li>
              <li>Launch assets for social and web.</li>
            </ul>
          </div>

          <div className="p-10 bg-white rounded-[32px] border border-[#E5E5E5] flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] mb-8 flex items-center justify-center">
              <HugeiconsIcon icon={ThreeDViewIcon} size={24} color="#60A5FA" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">Custom Visual Systems</h2>
            <ul className="space-y-4 text-[#707070] mt-auto">
              <li>UI visuals that feel premium.</li>
              <li>Product graphics and iconography.</li>
              <li>Visual direction for new ventures.</li>
              <li>Cohesive design languages for complex tools.</li>
            </ul>
          </div>

          <div className="p-10 bg-white rounded-[32px] border border-[#E5E5E5] flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] mb-8 flex items-center justify-center">
              <HugeiconsIcon icon={AiInnovation02Icon} size={24} color="#F472B6" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">Practical AI Automations</h2>
            <ul className="space-y-4 text-[#707070] mt-auto">
              <li>Content workflows that save hours of manual work.</li>
              <li>Internal tools that connect your existing data.</li>
              <li>Automated publishing systems.</li>
            </ul>
          </div>

        </div>
      </section>






      {/* FAQ */}
      <section className="px-6 py-32 border-t border-[#F5F5F5]">
        <div className="max-w-[800px] mx-auto w-full">
          <h2 className="text-3xl font-semibold tracking-tight mb-16">Frequently Asked Questions</h2>
          <div className="space-y-8">

            <div className="border-b border-[#F5F5F5] pb-8">
              <h3 className="text-lg font-semibold mb-4">What is your typical timeline?</h3>
              <p className="text-[#707070]">Most projects take 6–12 weeks from kickoff to launch.</p>
            </div>

            <div className="border-b border-[#F5F5F5] pb-8">
              <h3 className="text-lg font-semibold mb-4">Do you work with early-stage startups?</h3>
              <p className="text-[#707070]">Yes, we specialize in helping founders find their structure.</p>
            </div>

            <div className="border-b border-[#F5F5F5] pb-8">
              <h3 className="text-lg font-semibold mb-4">What is a &quot;Practical AI Automation&quot;?</h3>
              <p className="text-[#707070]">It&apos;s a custom tool that handles repetitive tasks using LLMs, built specifically for your team&apos;s workflow.</p>
            </div>

            <div className="border-b border-[#F5F5F5] pb-8">
              <h3 className="text-lg font-semibold mb-4">Do you offer ongoing maintenance?</h3>
              <p className="text-[#707070]">Yes, for products we build, we offer support packages to ensure they stay evolvable.</p>
            </div>

            <div className="border-b border-[#F5F5F5] pb-8">
              <h3 className="text-lg font-semibold mb-4">How do we start?</h3>
              <p className="text-[#707070]">We begin with a 30-minute fit call to see if our principles align with your goals.</p>
            </div>

          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-32 border-t border-[#F5F5F5] bg-[#F9F9F9] text-center">
        <h2 className="text-4xl font-semibold tracking-tight mb-10">Ready to start?</h2>
        <Link href="/contact" className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-[#000000] text-white text-base font-medium hover:-translate-y-1 transition-transform">
          Let’s Build Something Real
        </Link>
      </section>
    </div>
  );
}
