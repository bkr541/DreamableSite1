'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import SplineBackground from '@/components/SplineBackground';

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
          <Link href="#contact" className="w-full sm:w-auto inline-flex items-center justify-center h-14 px-8 rounded-full bg-[#000000] text-white text-base font-medium hover:-translate-y-1 transition-transform">
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
          <SplineBackground theme="evolvable" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-[800px] flex flex-col items-start text-gray-900"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Evolv</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-gray-700">Built to adapt.</p>
              <div className="text-lg text-gray-600 leading-relaxed space-y-6">
                <p>
                  A product that can’t change is a product that’s already dying. We build modular systems and lightweight AI automations that grow with your team.
                </p>
                <p className="font-medium text-gray-800">
                  Custom digital products across web and native platforms, designed for scale and long-term maintainability.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* SECTION 3 – BUILDABLE */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <SplineBackground theme="buildable" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-[800px] flex flex-col items-start text-gray-900"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Build</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-gray-700">Designed to be executed.</p>
              <p className="text-lg text-gray-600 leading-relaxed">
                Design is only as good as its implementation. We build with the end in mind. Whether it's a native iOS app or a complex web platform, our code is clean, our systems are logical, and our architecture is ready for the real world.
              </p>
            </motion.div>
          </div>
        </section>

        {/* SECTION 4 – LAUNCHABLE */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <SplineBackground theme="launchable" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-[800px] flex flex-col items-start text-gray-900"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Launch</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-gray-700">Finished means shipped.</p>
              <p className="text-lg text-gray-600 leading-relaxed">
                The most dangerous state for a product is "almost finished." We specialize in the final 10%. From rigorous QA to rollout kits, we ensure that when we say it’s done, it’s ready for your first thousand users.
              </p>
            </motion.div>
          </div>
        </section>

        {/* SECTION 5 – MEMORABLE */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <SplineBackground theme="memorable" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-[800px] flex flex-col items-start text-gray-900"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Memor</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-gray-700">Clarity is what lasts.</p>
              <p className="text-lg text-gray-600 leading-relaxed">
                In a world of noise, clarity is the only thing that sticks. We create visual languages that feel inevitable. Cohesive branding, intentional typography, and product UI that users don't just use—they remember.
              </p>
            </motion.div>
          </div>
        </section>

        {/* SECTION 6 – DREAMABLE */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <SplineBackground theme="dreamable" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-[800px] flex flex-col items-start text-gray-900"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Dream</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-gray-700">Ideas deserve structure.</p>
              <p className="text-lg text-gray-600 leading-relaxed">
                Every great product starts as a vague ambition. We bring the rigor required to define it. We move from abstract concepts to concrete strategies, ensuring your idea has the positioning and direction needed to survive the market.
              </p>
            </motion.div>
          </div>
        </section>
      </div>

      {/* SECTION 7 – CONTACT */}
      <section id="contact" className="px-6 py-32 border-t border-[#F5F5F5] bg-gradient-to-br from-[#FAFAFA] via-[#F5F5F5] to-[#F0F0F0]">
        <div className="max-w-[1200px] mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col lg:flex-row gap-16 lg:gap-24"
          >
            {/* Left – Heading */}
            <div className="w-full lg:w-5/12 flex flex-col justify-center">
              <h2 className="text-4xl md:text-6xl font-semibold tracking-tight mb-8">Start Something<br />Real.</h2>
              <p className="text-lg text-[#707070] leading-relaxed mb-8 max-w-[480px]">
                We&apos;re ready when you are. Tell us a little about what you&apos;re building, and we&apos;ll get back to you within 24 hours.
              </p>
              <div className="flex items-center gap-3 text-sm text-[#999999]">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Typically responds within 24 hours
              </div>
            </div>

            {/* Right – Form */}
            <div className="w-full lg:w-7/12">
              <form className="w-full max-w-[540px] space-y-8" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="flex flex-col">
                    <label htmlFor="contact-name" className="text-sm font-medium text-[#707070] mb-2">Name</label>
                    <input type="text" id="contact-name" className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#000000] transition-colors" placeholder="Jane Doe" />
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="contact-email" className="text-sm font-medium text-[#707070] mb-2">Email</label>
                    <input type="email" id="contact-email" className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#000000] transition-colors" placeholder="jane@example.com" />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label htmlFor="contact-company" className="text-sm font-medium text-[#707070] mb-2">Company</label>
                  <input type="text" id="contact-company" className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#000000] transition-colors" placeholder="Acme Corp" />
                </div>

                <div className="flex flex-col">
                  <label htmlFor="contact-building" className="text-sm font-medium text-[#707070] mb-2">What are you building?</label>
                  <textarea id="contact-building" rows={3} className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#000000] transition-colors resize-none" placeholder="Tell us about your project..." />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="flex flex-col">
                    <label htmlFor="contact-timeline" className="text-sm font-medium text-[#707070] mb-2">Timeline</label>
                    <select id="contact-timeline" className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] focus:outline-none focus:border-[#000000] transition-colors appearance-none cursor-pointer" defaultValue="">
                      <option value="" disabled>Select a timeline</option>
                      <option value="asap">ASAP</option>
                      <option value="1-3">1-3 Months</option>
                      <option value="3-6">3-6 Months</option>
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="contact-budget" className="text-sm font-medium text-[#707070] mb-2">Budget range</label>
                    <select id="contact-budget" className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] focus:outline-none focus:border-[#000000] transition-colors appearance-none cursor-pointer" defaultValue="">
                      <option value="" disabled>Select a budget</option>
                      <option value="under-25k">Under $25k</option>
                      <option value="25k-50k">$25k - $50k</option>
                      <option value="50k-plus">$50k+</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="w-full h-14 rounded-full bg-[#000000] text-white text-base font-medium hover:-translate-y-1 transition-transform mt-4 shadow-lg">
                  Send Inquiry
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
