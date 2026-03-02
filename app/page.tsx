'use client';

import { useState } from 'react';

import Link from 'next/link';
import { motion } from 'motion/react';
import SplineBackground from '@/components/SplineBackground';
import InteractiveElement from '@/components/InteractiveElement';
import HeroRibbons from '@/components/HeroRibbons';
import CubePuzzle from '@/components/CubePuzzle';
import HeroCarousel from '@/components/HeroCarousel';

export default function Home() {
  const [formData, setFormData] = useState({
    name: '', email: '', projectType: 'App or Web Development', budgetRange: '< $500', timeline: '1 - 2 weeks', message: '',
  });
  const [attachment, setAttachment] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent('Dreamable: New Project Inquiry');
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\nProject Type: ${formData.projectType}\nBudget: ${formData.budgetRange}\nTimeline: ${formData.timeline}\n\nMessage:\n${formData.message}`
    );
    window.location.href = `mailto:bkr_92_02@yahoo.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex flex-col w-full">
      {/* SECTION 1 – HERO */}
      <section className="relative min-h-[calc(100vh-80px)] flex items-center px-8 md:px-16 py-24 overflow-hidden">
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

          {/* Right – 3D Cube Puzzle */}
          <div className="hidden md:flex items-center justify-center h-[400px]">
            <CubePuzzle />
          </div>
        </div>
      </section>

      <div id="principles" className="w-full">
        <section className="relative px-6 py-24 border-t border-[#F5F5F5] overflow-hidden">
          <div className="max-w-[1200px] mx-auto w-full">
            {/* Section header */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="text-center mb-20"
            >
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">Our Principles</h2>
              <p className="text-lg text-[#707070] max-w-[500px] mx-auto">The five pillars that guide every project from concept to launch and beyond.</p>
            </motion.div>

            {/* Timeline */}
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-6 md:left-1/2 md:-translate-x-px top-0 bottom-0 w-[2px] bg-gradient-to-b from-cyan-300 via-purple-300 via-orange-300 via-pink-300 to-teal-300 opacity-30" />

              {[
                {
                  step: '01', prefix: 'Dream', theme: 'dreamable' as const,
                  subtitle: 'Ideas deserve structure.',
                  desc: 'Every great product starts as a vague ambition. We bring the rigor to define it—moving from abstract concepts to concrete strategies with clear positioning and direction.',
                  gradient: 'from-cyan-400 via-purple-400 to-orange-400',
                  dotColor: 'bg-cyan-400',
                },
                {
                  step: '02', prefix: 'Build', theme: 'buildable' as const,
                  subtitle: 'Designed to be executed.',
                  desc: 'Design is only as good as its implementation. Whether it\'s a native iOS app or a complex web platform, our code is clean, our systems are logical, and our architecture is ready for the real world.',
                  gradient: 'from-indigo-400 via-blue-400 to-cyan-400',
                  dotColor: 'bg-indigo-400',
                },
                {
                  step: '03', prefix: 'Launch', theme: 'launchable' as const,
                  subtitle: 'Finished means shipped.',
                  desc: 'We specialize in the final 10%. From rigorous QA to rollout kits, when we say it\'s done, it\'s ready for your first thousand users.',
                  gradient: 'from-amber-400 via-orange-400 to-red-400',
                  dotColor: 'bg-amber-400',
                },
                {
                  step: '04', prefix: 'Memor', theme: 'memorable' as const,
                  subtitle: 'Clarity is what lasts.',
                  desc: 'In a world of noise, clarity is the only thing that sticks. We create visual languages that feel inevitable—cohesive branding, intentional typography, and product UI that users remember.',
                  gradient: 'from-purple-400 via-pink-400 to-rose-400',
                  dotColor: 'bg-purple-400',
                },
                {
                  step: '05', prefix: 'Evolv', theme: 'evolvable' as const,
                  subtitle: 'Built to adapt.',
                  desc: 'A product that can\'t change is already dying. We build modular systems and lightweight AI automations that grow with your team, designed for scale and long-term maintainability.',
                  gradient: 'from-teal-400 via-emerald-400 to-cyan-400',
                  dotColor: 'bg-teal-400',
                },
              ].map((item, i) => {
                const isEven = i % 2 === 0;
                return (
                  <div key={item.step} className="relative mb-24 last:mb-0">
                    {/* Timeline dot */}
                    <motion.div
                      className={`absolute left-6 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full ${item.dotColor} ring-4 ring-white z-10`}
                      style={{ top: '40px' }}
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.1 }}
                    />

                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center pl-16 md:pl-0`}>
                      {/* Text content */}
                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-80px" }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className={`flex flex-col ${isEven ? 'md:pr-16 md:text-right md:items-end' : 'md:pl-16 md:order-2'}`}
                      >
                        <div className="text-xs font-mono text-[#bbb] tracking-widest uppercase mb-3">Step {item.step}</div>
                        <h3 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
                          <span className={`text-transparent bg-clip-text bg-gradient-to-r ${item.gradient}`}>{item.prefix}</span>
                          <span className="font-light">able.</span>
                        </h3>
                        <p className="text-xl md:text-2xl font-medium tracking-tight text-gray-700 mb-4">{item.subtitle}</p>
                        <p className="text-base text-gray-500 leading-relaxed max-w-[480px]">{item.desc}</p>
                      </motion.div>

                      {/* Interactive element */}
                      <motion.div
                        initial={{ opacity: 0, x: isEven ? 30 : -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-80px" }}
                        transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
                        className={`relative h-[300px] md:h-[380px] ${isEven ? '' : 'md:order-1'}`}
                      >
                        <InteractiveElement theme={item.theme} />
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
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
                    <label htmlFor="contact-budget" className="text-sm font-medium text-[#555] mb-2">Project Budget</label>
                    <select
                      id="contact-budget"
                      value={formData.budgetRange}
                      onChange={(e) => setFormData({ ...formData, budgetRange: e.target.value })}
                      className="w-full bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 border border-white/40 transition-all appearance-none cursor-pointer"
                    >
                      <option value="< $500">&lt; $500</option>
                      <option value="$500 - $1k">$500 - $1k</option>
                      <option value="$1k - $5k">$1k - $5k</option>
                      <option value="$5k+">$5k+</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Timeline */}
                <div className="flex flex-col">
                  <label htmlFor="contact-timeline" className="text-sm font-medium text-[#555] mb-2">Timeline</label>
                  <select
                    id="contact-timeline"
                    value={formData.timeline}
                    onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                    className="w-full bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 border border-white/40 transition-all appearance-none cursor-pointer"
                  >
                    <option value="1 - 2 weeks">1 - 2 weeks</option>
                    <option value="1 month">1 month</option>
                    <option value="2 - 3 months">2 - 3 months</option>
                    <option value="3 - 6 months">3 - 6 months</option>
                    <option value="6+ months">6+ months</option>
                    <option value="Not sure">Not sure</option>
                  </select>
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

                {/* Row 4: Attachment */}
                <div className="flex flex-col">
                  <label htmlFor="contact-attachment" className="text-sm font-medium text-[#555] mb-2">Attachment <span className="text-[#aaa] font-normal">(optional)</span></label>
                  <label
                    htmlFor="contact-attachment"
                    className="w-full bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] focus-within:ring-2 focus-within:ring-cyan-200/50 border border-white/40 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#999] shrink-0"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 01-2.83-2.83l8.49-8.49" /></svg>
                    <span className={`text-sm truncate ${attachment ? 'text-[#1a1a1a]' : 'text-[#bbb]'}`}>
                      {attachment ? attachment.name : 'PDF, image, or doc'}
                    </span>
                    <input
                      type="file"
                      id="contact-attachment"
                      className="sr-only"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.svg,.sketch,.fig,.xd"
                      onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                    />
                  </label>
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
