'use client';

import { useState } from 'react';

import Link from 'next/link';
import { motion } from 'motion/react';
import SplineBackground from '@/components/SplineBackground';
import InteractiveElement from '@/components/InteractiveElement';
import HeroCarousel from '@/components/HeroCarousel';

export default function Home() {
  const [formData, setFormData] = useState({
    name: '', email: '', projectType: 'App or Web Development', budgetRange: '$5k - $10k', message: '',
  });
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed');
      setFormStatus('sent');
      setFormData({ name: '', email: '', projectType: 'App or Web Development', budgetRange: '$5k - $10k', message: '' });
    } catch {
      setFormStatus('error');
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* SECTION 1 – HERO */}
      <section className="relative min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6 py-32 text-center overflow-hidden">
        <HeroCarousel />
        <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col items-center">
          <h1 className="font-semibold tracking-tight leading-[1.1] mb-8">
            <span className="text-3xl md:text-5xl lg:text-6xl text-[#707070]">Evolvable. Buildable.<br className="hidden md:block" /> Launchable. Memorable.<br className="hidden md:block" /> </span>
            <span className="text-5xl md:text-7xl lg:text-[80px] text-[#000000] animate-gradient-sweep">Dreamable.<motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
              className="inline-block"
            >studio</motion.span></span>
          </h1>
          <p className="text-lg md:text-xl text-[#707070] max-w-[600px] mb-12 leading-relaxed">
            A digital product and creative studio that helps take raw concepts and transform them into finished digital products and polished brands with personality.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link href="#contact" className="w-full sm:w-auto inline-flex items-center justify-center h-14 px-8 rounded-full bg-[#000000] text-white text-base font-medium hover:-translate-y-1 transition-transform">
              Start a Project
            </Link>
            <a href="#principles" className="w-full sm:w-auto inline-flex items-center justify-center h-14 px-8 rounded-full bg-[#F5F5F5] text-[#000000] text-base font-medium hover:bg-[#E5E5E5] transition-colors">
              Explore Principles
            </a>
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
                  <div className="flex flex-col">
                    <label htmlFor="contact-budget" className="text-sm font-medium text-[#555] mb-2">Budget Range</label>
                    <select
                      id="contact-budget"
                      value={formData.budgetRange}
                      onChange={(e) => setFormData({ ...formData, budgetRange: e.target.value })}
                      className="w-full bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 border border-white/40 transition-all appearance-none cursor-pointer"
                    >
                      <option value="$5k - $10k">$5k - $10k</option>
                      <option value="$10k - $25k">$10k - $25k</option>
                      <option value="$25k - $50k">$25k - $50k</option>
                      <option value="$50k+">$50k+</option>
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
                {/* Status messages */}
                {formStatus === 'sent' && (
                  <div className="text-center text-green-600 text-sm font-medium py-2 bg-green-50/60 rounded-xl">✓ Message sent! We&apos;ll get back to you soon.</div>
                )}
                {formStatus === 'error' && (
                  <div className="text-center text-red-500 text-sm font-medium py-2 bg-red-50/60 rounded-xl">Failed to send. Please try again.</div>
                )}

                {/* Send button */}
                <div className="flex justify-center pt-2">
                  <button
                    type="submit"
                    disabled={formStatus === 'sending'}
                    className="px-12 py-3.5 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {formStatus === 'sending' ? 'Sending...' : 'Send'}
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
