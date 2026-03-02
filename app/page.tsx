'use client';

import { useState } from 'react';

import Link from 'next/link';
import { motion } from 'motion/react';
import SplineBackground from '@/components/SplineBackground';
import InteractiveElement from '@/components/InteractiveElement';
import HeroRibbons from '@/components/HeroRibbons';
import HeroCarousel from '@/components/HeroCarousel';

export default function Home() {
  const [formData, setFormData] = useState({
    name: '', email: '', projectType: 'App or Web Development', message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent('Dreamable: New Project Inquiry');
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\nProject Type: ${formData.projectType}\n\nMessage:\n${formData.message}`
    );
    window.location.href = `mailto:bkr_92_02@yahoo.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex flex-col w-full">
      {/* SECTION 1 – HERO */}
      <section className="relative min-h-[calc(100vh-80px)] flex items-center px-6 py-24 overflow-hidden">
        <HeroRibbons />
        <div className="relative z-10 max-w-[1200px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left – Text */}
          <div className="flex flex-col items-start">
            <h1 className="font-semibold tracking-tight leading-[1.1] mb-6 text-left">
              <span className="text-5xl md:text-6xl lg:text-[68px] text-[#1a1a1a] animate-gradient-sweep">Dreamable.<motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
                className="inline-block"
              >studio</motion.span></span>
            </h1>
            <p className="text-base md:text-lg text-[#707070] max-w-[440px] mb-8 leading-relaxed text-left">
              We design, engineer, and launch digital products for teams that want to move fast without sacrificing craft.
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <Link href="#contact" className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all">
                Start a project
              </Link>
              <a href="#principles" className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-[#F0F0F0] text-[#1a1a1a] text-sm font-medium hover:bg-[#E5E5E5] transition-colors border border-[#e0e0e0]">
                See our work
              </a>
            </div>
          </div>

          {/* Right – Cascading stacked images (horizontal) */}
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
                  width: 210, height: 210,
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
        </div>
      </section>

      <div id="principles" className="w-full">
        {/* SECTION 2 – DREAMABLE (text left, element right) */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <SplineBackground theme="dreamable" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-start text-gray-900"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Dream</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-gray-700">Ideas deserve structure.</p>
              <p className="text-lg text-gray-600 leading-relaxed">
                Every great product starts as a vague ambition. We bring the rigor required to define it. We move from abstract concepts to concrete strategies, ensuring your idea has the positioning and direction needed to survive the market.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="relative h-[400px] md:h-[500px]"
            >
              <InteractiveElement theme="dreamable" />
            </motion.div>
          </div>
        </section>

        {/* SECTION 3 – BUILDABLE (text left, element right) */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <SplineBackground theme="buildable" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-start text-gray-900"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Build</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-gray-700">Designed to be executed.</p>
              <p className="text-lg text-gray-600 leading-relaxed">
                Design is only as good as its implementation. We build with the end in mind. Whether it&apos;s a native iOS app or a complex web platform, our code is clean, our systems are logical, and our architecture is ready for the real world.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="relative h-[400px] md:h-[500px]"
            >
              <InteractiveElement theme="buildable" />
            </motion.div>
          </div>
        </section>

        {/* SECTION 4 – LAUNCHABLE (element left, text right) */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <SplineBackground theme="launchable" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="relative h-[400px] md:h-[500px] order-2 md:order-1"
            >
              <InteractiveElement theme="launchable" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-start text-gray-900 order-1 md:order-2"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Launch</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-gray-700">Finished means shipped.</p>
              <p className="text-lg text-gray-600 leading-relaxed">
                The most dangerous state for a product is &quot;almost finished.&quot; We specialize in the final 10%. From rigorous QA to rollout kits, we ensure that when we say it&apos;s done, it&apos;s ready for your first thousand users.
              </p>
            </motion.div>
          </div>
        </section>

        {/* SECTION 5 – MEMORABLE (text left, element right) */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <SplineBackground theme="memorable" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-start text-gray-900"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Memor</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-gray-700">Clarity is what lasts.</p>
              <p className="text-lg text-gray-600 leading-relaxed">
                In a world of noise, clarity is the only thing that sticks. We create visual languages that feel inevitable. Cohesive branding, intentional typography, and product UI that users don&apos;t just use—they remember.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="relative h-[400px] md:h-[500px]"
            >
              <InteractiveElement theme="memorable" />
            </motion.div>
          </div>
        </section>

        {/* SECTION 6 – EVOLVABLE (element left, text right) */}
        <section className="relative min-h-screen flex items-center px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
          <SplineBackground theme="evolvable" />
          <div className="relative z-10 max-w-[1200px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="relative h-[400px] md:h-[500px] order-2 md:order-1"
            >
              <InteractiveElement theme="evolvable" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-start text-gray-900 order-1 md:order-2"
            >
              <h2 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6"><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400">Evolv</span><span className="font-light">able.</span></h2>
              <p className="text-2xl md:text-3xl mb-8 font-medium tracking-tight text-gray-700">Built to adapt.</p>
              <p className="text-lg text-gray-600 leading-relaxed">
                A product that can&apos;t change is a product that&apos;s already dying. We build modular systems and lightweight AI automations that grow with your team. Custom digital products across web and native platforms, designed for scale and long-term maintainability.
              </p>
            </motion.div>
          </div>
        </section>
      </div>

      {/* SECTION 7 – CONTACT */}
      <section id="contact" className="relative px-6 py-32 border-t border-[#F5F5F5] overflow-hidden">
        <SplineBackground theme="buildable" />
        <div className="relative z-10 max-w-[800px] mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            {/* Heading */}
            <h2 className="text-4xl md:text-6xl font-semibold tracking-tight mb-4 text-center text-[#1a1a1a]">Start a project</h2>
            <p className="text-base md:text-lg text-[#707070] mb-12 text-center max-w-[520px]">
              Tell us what you&apos;re building. We&apos;ll reply with next steps and a clear plan.
            </p>

            {/* Glassmorphic form card */}
            <div
              className="w-full rounded-3xl p-8 md:p-10"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.45), rgba(220,240,240,0.25))',
                border: '1px solid rgba(255,255,255,0.5)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.04)',
              }}
            >
              <form className="w-full space-y-6" onSubmit={handleSubmit}>
                {/* Row 1: Name + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="flex flex-col">
                    <label htmlFor="contact-name" className="text-sm font-medium text-[#555] mb-2">Name</label>
                    <input
                      type="text"
                      id="contact-name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 border border-white/40 transition-all"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="contact-email" className="text-sm font-medium text-[#555] mb-2">Email</label>
                    <input
                      type="email"
                      id="contact-email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 border border-white/40 transition-all"
                      placeholder="jane@example.com"
                    />
                  </div>
                </div>

                {/* Row 2: Project Type + Budget Range */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="flex flex-col">
                    <label htmlFor="contact-project" className="text-sm font-medium text-[#555] mb-2">Project Type</label>
                    <select
                      id="contact-project"
                      value={formData.projectType}
                      onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                      className="w-full bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 border border-white/40 transition-all appearance-none cursor-pointer"
                    >
                      <option value="App or Web Development">App or Web Development</option>
                      <option value="Branding & Identity">Branding &amp; Identity</option>
                      <option value="UI/UX Design">UI/UX Design</option>
                      <option value="Consulting">Consulting</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Message */}
                <div className="flex flex-col">
                  <label htmlFor="contact-message" className="text-sm font-medium text-[#555] mb-2">Message</label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 border border-white/40 transition-all resize-none"
                    placeholder="Tell us about your project..."
                  />
                </div>

                {/* Send button */}
                <div className="flex justify-center pt-2">
                  <button
                    type="submit"
                    className="px-12 py-3.5 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
