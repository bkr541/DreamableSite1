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
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitStatus('idle');
    setSubmitError('');

    try {
      // Read UTM params from URL
      const params = new URLSearchParams(window.location.search);

      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          service: formData.projectType,
          description: formData.message,
          budget_range: formData.budgetRange,
          timeline: formData.timeline,
          website_hp: honeypot, // honeypot
          utm_source: params.get('utm_source') || undefined,
          utm_medium: params.get('utm_medium') || undefined,
          utm_campaign: params.get('utm_campaign') || undefined,
          utm_term: params.get('utm_term') || undefined,
          utm_content: params.get('utm_content') || undefined,
          referrer: document.referrer || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || 'Something went wrong.');
      }

      setSubmitStatus('success');
      setFormData({ name: '', email: '', projectType: 'App or Web Development', budgetRange: '< $500', timeline: '1 - 2 weeks', message: '' });
      setAttachment(null);
    } catch (err) {
      setSubmitStatus('error');
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* SECTION 1 – HERO */}
      <section className="relative min-h-[calc(100vh-80px)] flex items-center px-8 md:px-16 py-24 overflow-hidden snap-start scroll-mt-0">
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
            <div className="flex flex-row flex-wrap items-center gap-3">
              <Link href="#contact" className="inline-flex items-center justify-center h-12 px-5 sm:px-7 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all">
                Start a project
              </Link>
              <a href="#principles" className="inline-flex items-center justify-center h-12 px-5 sm:px-7 rounded-full bg-[#F0F0F0] text-[#1a1a1a] text-sm font-medium hover:bg-[#E5E5E5] transition-colors border border-[#e0e0e0]">
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

      <div id="principles" className="w-full snap-start scroll-mt-24 pt-4">
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
                  subtitle: <>Where ideas take <i>shape.</i></>,
                  desc: 'Every great outcome starts as something unfinished. A concept. A direction. A feeling. We help you define what it really is and what it needs to become.\n\nWe clarify the vision, refine the positioning, and turn instinct into a focused plan. This is where imagination becomes intention.',
                  gradient: 'from-cyan-400 via-purple-400 to-orange-400',
                  dotColor: 'bg-cyan-400',
                },
                {
                  step: '02', prefix: 'Build', theme: 'buildable' as const,
                  subtitle: <>Designed to become <i>real.</i></>,
                  desc: 'Once the direction is clear, we make it tangible. Whether it’s a digital product, captivating visual elements, or building your brand identity, we translate ideas into something concrete and executable.\n\nEvery decision connects. Every component has a reason.\nThe foundation is solid long before anyone sees it.',
                  gradient: 'from-indigo-400 via-blue-400 to-cyan-400',
                  dotColor: 'bg-indigo-400',
                },
                {
                  step: '03', prefix: 'Launch', theme: 'launchable' as const,
                  subtitle: <>Built to <i>debut.</i></>,
                  desc: 'Going live should feel composed, not chaotic. We bring everything into alignment so what you’ve created is ready to be introduced with confidence.\n\nPolished presentation. Cohesive experience. Thoughtful execution. When it’s time to reveal it, it feels prepared and complete.',
                  gradient: 'from-amber-400 via-orange-400 to-red-400',
                  dotColor: 'bg-amber-400',
                },
                {
                  step: '04', prefix: 'Memor', theme: 'memorable' as const,
                  subtitle: <>Designed to be <i>recognized.</i></>,
                  desc: 'Clarity creates impact. We shape the personality behind the work so it’s not just functional, it’s distinct.\n\nVisual language, typography, tone, and interaction all work together to create something people remember and trust.',
                  gradient: 'from-purple-400 via-pink-400 to-rose-400',
                  dotColor: 'bg-purple-400',
                },
                {
                  step: '05', prefix: 'Evolv', theme: 'evolvable' as const,
                  subtitle: <>Made to grow with <i>you.</i></>,
                  desc: 'Strong ideas don’t stay static. We create foundations that allow your brand or product to expand, adapt, and mature without losing what makes it recognizable.\n\nAs your business evolves, your work evolves with it, naturally and confidently.',
                  gradient: 'from-teal-400 via-emerald-400 to-cyan-400',
                  dotColor: 'bg-teal-400',
                },
              ].map((item, i) => {
                const isEven = i % 2 === 0;
                return (
                  <div key={item.step} className="relative mb-20 last:mb-16 snap-center scroll-m-24 py-4">
                    {/* Timeline dot */}
                    <motion.div
                      className={`absolute left-6 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full ${item.dotColor} ring-4 ring-white z-10`}
                      style={{ top: '24px' }}
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.1 }}
                    />

                    <div className={`relative grid md:grid-cols-2 items-center pl-16 md:pl-0`}>
                      {/* Text content */}
                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-80px" }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className={`relative z-10 w-full flex flex-col py-6 md:py-0 ${isEven ? 'md:pr-16 md:text-right md:items-end' : 'md:pl-16 md:order-2'}`}
                      >
                        <div className="text-xs font-mono text-[#bbb] tracking-widest uppercase mb-3">Step {item.step}</div>
                        <h3 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3 drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]">
                          <span className={`text-transparent bg-clip-text bg-gradient-to-r ${item.gradient}`}>{item.prefix}</span>
                          <span className="font-light text-gray-900">able.</span>
                        </h3>
                        <p className="text-xl md:text-2xl font-medium tracking-tight text-gray-900 mb-4">{item.subtitle}</p>
                        <p className="text-base text-gray-800 leading-relaxed max-w-[480px] whitespace-pre-wrap">{item.desc}</p>
                      </motion.div>

                      {/* Interactive element */}
                      <motion.div
                        initial={{ opacity: 0, x: isEven ? 30 : -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-80px" }}
                        transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
                        className={`absolute inset-0 md:relative md:inset-auto z-0 h-full md:h-[320px] w-full flex items-center justify-center opacity-30 md:opacity-100 pointer-events-none md:pointer-events-auto overflow-hidden md:overflow-visible ${isEven ? '' : 'md:order-1'}`}
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
      <section id="contact" className="relative px-6 py-32 border-t border-[#F5F5F5] overflow-hidden snap-start scroll-mt-0">
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

                {/* Row 3: Timeline + Attachment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                </div>

                {/* Row 4: Message */}
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

                {/* Honeypot – hidden from real users */}
                <div className="absolute opacity-0 -z-10" aria-hidden="true" tabIndex={-1}>
                  <input
                    type="text"
                    name="website_hp"
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                {/* Send button */}
                <div className="flex flex-col items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-12 py-3.5 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    {submitting ? 'Sending…' : 'Send'}
                  </button>
                  {submitStatus === 'success' && (
                    <p className="text-sm text-emerald-600 font-medium">Your inquiry has been submitted! We'll be in touch soon.</p>
                  )}
                  {submitStatus === 'error' && (
                    <p className="text-sm text-red-500 font-medium">{submitError}</p>
                  )}
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
