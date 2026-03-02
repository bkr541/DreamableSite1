'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* SECTION 1 – HERO */}
      <section className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6 py-32 text-center max-w-[1200px] mx-auto w-full">
        <h1 className="font-semibold tracking-tight leading-[1.1] mb-8">
          <span className="text-3xl md:text-5xl lg:text-6xl text-[#707070]">Evolvable. Buildable.<br className="hidden md:block" /> Launchable. Memorable.<br className="hidden md:block" /> </span>
          <span className="text-5xl md:text-7xl lg:text-[80px] text-[#000000]">Dreamable.</span>
        </h1>
        <p className="text-lg md:text-xl text-[#707070] max-w-[600px] mb-12 leading-relaxed">
          A digital product and creative studio that turns ideas into structured brands, software, and systems that ship.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link href="/contact" className="w-full sm:w-auto inline-flex items-center justify-center h-14 px-8 rounded-full bg-[#000000] text-white text-base font-medium hover:-translate-y-1 transition-transform">
            Start a Project
          </Link>
          <a href="#principles" className="w-full sm:w-auto inline-flex items-center justify-center h-14 px-8 rounded-full bg-[#F5F5F5] text-[#000000] text-base font-medium hover:bg-[#E5E5E5] transition-colors">
            Explore Principles
          </a>
        </div>
        <div className="w-full max-w-[1000px] mt-24 rounded-2xl overflow-hidden">
          <Image
            src="/images/hero.jpg"
            alt="Dreamable.studio services showcase"
            width={1000}
            height={500}
            className="w-full h-auto object-cover"
            priority
          />
        </div>
      </section>

      <div id="principles" className="w-full">
        {/* SECTION 2 – EVOLVABLE */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <Image
            src="https://picsum.photos/seed/evolvable/1920/1080?blur=2"
            alt="Evolvable"
            fill
            className="object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-[800px] flex flex-col items-start text-white"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Evolv</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-white/90">Built to adapt.</p>
              <div className="text-lg text-white/80 leading-relaxed space-y-6">
                <p>
                  A product that can’t change is a product that’s already dying. We build modular systems and lightweight AI automations that grow with your team.
                </p>
                <p className="font-medium text-white">
                  Custom digital products across web and native platforms, designed for scale and long-term maintainability.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* SECTION 3 – BUILDABLE */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <Image
            src="https://picsum.photos/seed/buildable/1920/1080?blur=2"
            alt="Buildable"
            fill
            className="object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-[800px] flex flex-col items-start text-white"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Build</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-white/90">Designed to be executed.</p>
              <p className="text-lg text-white/80 leading-relaxed">
                Design is only as good as its implementation. We build with the end in mind. Whether it’s a native iOS app or a complex web platform, our code is clean, our systems are logical, and our architecture is ready for the real world.
              </p>
            </motion.div>
          </div>
        </section>

        {/* SECTION 4 – LAUNCHABLE */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <Image
            src="https://picsum.photos/seed/launchable/1920/1080?blur=2"
            alt="Launchable"
            fill
            className="object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-[800px] flex flex-col items-start text-white"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Launch</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-white/90">Finished means shipped.</p>
              <p className="text-lg text-white/80 leading-relaxed">
                The most dangerous state for a product is "almost finished." We specialize in the final 10%. From rigorous QA to rollout kits, we ensure that when we say it’s done, it’s ready for your first thousand users.
              </p>
            </motion.div>
          </div>
        </section>

        {/* SECTION 5 – MEMORABLE */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <Image
            src="https://picsum.photos/seed/memorable/1920/1080?blur=2"
            alt="Memorable"
            fill
            className="object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-[800px] flex flex-col items-start text-white"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Memor</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-white/90">Clarity is what lasts.</p>
              <p className="text-lg text-white/80 leading-relaxed">
                In a world of noise, clarity is the only thing that sticks. We create visual languages that feel inevitable. Cohesive branding, intentional typography, and product UI that users don’t just use—they remember.
              </p>
            </motion.div>
          </div>
        </section>

        {/* SECTION 6 – DREAMABLE */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <Image
            src="https://picsum.photos/seed/dreamable/1920/1080?blur=2"
            alt="Dreamable"
            fill
            className="object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-[800px] flex flex-col items-start text-white"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Dream</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-white/90">Ideas deserve structure.</p>
              <p className="text-lg text-white/80 leading-relaxed">
                Every great product starts as a vague ambition. We bring the rigor required to define it. We move from abstract concepts to concrete strategies, ensuring your idea has the positioning and direction needed to survive the market.
              </p>
            </motion.div>
          </div>
        </section>
      </div>

      {/* SECTION 7 – FINAL CTA */}
      <section className="px-6 py-32 border-t border-[#F5F5F5] bg-[#F9F9F9]">
        <div className="max-w-[800px] mx-auto text-center flex flex-col items-center">
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight mb-12">Stop overthinking.<br />Start shipping.</h2>
          <Link href="/contact" className="inline-flex items-center justify-center h-16 px-10 rounded-full bg-[#000000] text-white text-lg font-medium hover:-translate-y-1 transition-transform shadow-lg">
            Let’s Build Something Real.
          </Link>
        </div>
      </section>
    </div>
  );
}
