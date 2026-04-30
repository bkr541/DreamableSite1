'use client';

import { useState } from 'react';

interface FormData {
  name: string;
  email: string;
  company: string;
  service: string;
  description: string;
  timeline: string;
  budgetRange: string;
}

const INITIAL_FORM: FormData = {
  name: '',
  email: '',
  company: '',
  service: '',
  description: '',
  timeline: '',
  budgetRange: '',
};

export default function Contact() {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setFieldError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    if (!formData.name.trim()) { setFieldError({ field: 'name', message: 'Name is required.' }); return; }
    if (!formData.email.trim()) { setFieldError({ field: 'email', message: 'Email is required.' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setFieldError({ field: 'email', message: 'Please enter a valid email address.' }); return; }
    if (!formData.service) { setFieldError({ field: 'service', message: 'Please select a project type.' }); return; }
    if (!formData.description.trim()) { setFieldError({ field: 'description', message: 'Please describe your project.' }); return; }

    setSubmitting(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const params = new URLSearchParams(window.location.search);

      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          company: formData.company || undefined,
          service: formData.service,
          description: formData.description,
          budget_range: formData.budgetRange || undefined,
          timeline: formData.timeline || undefined,
          website_hp: honeypot,
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

      setStatus('success');
      setFormData(INITIAL_FORM);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-80px)]">
      <section className="flex-1 flex flex-col lg:flex-row max-w-[1200px] mx-auto w-full">

        {/* Left Side */}
        <div className="w-full lg:w-1/2 px-6 py-24 lg:py-32 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-[#F5F5F5]">
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight mb-8">Start Something Real.</h1>
          <p className="text-xl text-[#707070] leading-relaxed max-w-[480px]">
            We&apos;re ready when you are. Tell us a little about what you&apos;re building, and we&apos;ll get back to you within 24 hours.
          </p>
        </div>

        {/* Right Side (Form) */}
        <div className="w-full lg:w-1/2 px-6 py-24 lg:py-32 flex flex-col justify-center bg-[#F9F9F9] lg:bg-transparent">
          {status === 'success' ? (
            <div className="w-full max-w-[480px] mx-auto lg:mx-0">
              <p className="text-2xl font-semibold mb-3">We got it!</p>
              <p className="text-[#707070]">We&apos;ll be in touch within 24 hours.</p>
              <button
                onClick={() => setStatus('idle')}
                className="mt-8 text-sm underline text-[#707070] hover:text-[#000000] transition-colors"
              >
                Submit another inquiry
              </button>
            </div>
          ) : (
            <form
              className="w-full max-w-[480px] mx-auto lg:mx-0 space-y-10"
              onSubmit={handleSubmit}
              noValidate
            >
              {/* Honeypot — hidden from real users, catches bots */}
              <input
                type="text"
                name="website_hp"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              <div className="flex flex-col">
                <label htmlFor="name" className="text-sm font-medium text-[#707070] mb-2">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full bg-transparent border-b py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none transition-colors ${fieldError?.field === 'name' ? 'border-[#e05252] focus:border-[#e05252]' : 'border-[#E5E5E5] focus:border-[#000000]'}`}
                  placeholder="Jane Doe"
                />
                {fieldError?.field === 'name' && <p className="text-sm text-[#e05252] mt-1.5">{fieldError.message}</p>}
              </div>

              <div className="flex flex-col">
                <label htmlFor="email" className="text-sm font-medium text-[#707070] mb-2">Email</label>
                <input
                  type="text"
                  id="email"
                  name="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full bg-transparent border-b py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none transition-colors ${fieldError?.field === 'email' ? 'border-[#e05252] focus:border-[#e05252]' : 'border-[#E5E5E5] focus:border-[#000000]'}`}
                  placeholder="jane@example.com"
                />
                {fieldError?.field === 'email' && <p className="text-sm text-[#e05252] mt-1.5">{fieldError.message}</p>}
              </div>

              <div className="flex flex-col">
                <label htmlFor="company" className="text-sm font-medium text-[#707070] mb-2">Company</label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#000000] transition-colors"
                  placeholder="Acme Corp"
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="service" className="text-sm font-medium text-[#707070] mb-2">Project Type</label>
                <select
                  id="service"
                  name="service"
                  value={formData.service}
                  onChange={handleChange}
                  className={`w-full bg-transparent border-b py-3 text-[#000000] focus:outline-none transition-colors appearance-none cursor-pointer ${fieldError?.field === 'service' ? 'border-[#e05252] focus:border-[#e05252]' : 'border-[#E5E5E5] focus:border-[#000000]'}`}
                >
                  <option value="" disabled>Select a project type</option>
                  <option value="App or Web Development">App or Web Development</option>
                  <option value="Branding &amp; Logo">Branding &amp; Logo</option>
                  <option value="UI/UX Design">UI/UX Design</option>
                  <option value="Marketing &amp; Ads">Marketing &amp; Ads</option>
                  <option value="Consulting">Consulting</option>
                  <option value="Other">Other</option>
                </select>
                {fieldError?.field === 'service' && <p className="text-sm text-[#e05252] mt-1.5">{fieldError.message}</p>}
              </div>

              <div className="flex flex-col">
                <label htmlFor="description" className="text-sm font-medium text-[#707070] mb-2">What are you building?</label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  maxLength={5000}
                  value={formData.description}
                  onChange={handleChange}
                  className={`w-full bg-transparent border-b py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none transition-colors resize-none ${fieldError?.field === 'description' ? 'border-[#e05252] focus:border-[#e05252]' : 'border-[#E5E5E5] focus:border-[#000000]'}`}
                  placeholder="Tell us about your project..."
                />
                {fieldError?.field === 'description' && <p className="text-sm text-[#e05252] mt-1.5">{fieldError.message}</p>}
              </div>

              <div className="flex flex-col">
                <label htmlFor="timeline" className="text-sm font-medium text-[#707070] mb-2">Timeline</label>
                <select
                  id="timeline"
                  name="timeline"
                  value={formData.timeline}
                  onChange={handleChange}
                  className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] focus:outline-none focus:border-[#000000] transition-colors appearance-none cursor-pointer"
                >
                  <option value="">Select a timeline</option>
                  <option value="ASAP">ASAP</option>
                  <option value="1–3 Months">1–3 Months</option>
                  <option value="3–6 Months">3–6 Months</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label htmlFor="budgetRange" className="text-sm font-medium text-[#707070] mb-2">Budget range</label>
                <select
                  id="budgetRange"
                  name="budgetRange"
                  value={formData.budgetRange}
                  onChange={handleChange}
                  className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] focus:outline-none focus:border-[#000000] transition-colors appearance-none cursor-pointer"
                >
                  <option value="">Select a budget</option>
                  <option value="Under $25k">Under $25k</option>
                  <option value="$25k – $50k">$25k – $50k</option>
                  <option value="$50k+">$50k+</option>
                </select>
              </div>

              <p className="text-sm text-[#AAAAAA]">
                Attachments can be shared after we reply.
              </p>

              {status === 'error' && (
                <p className="text-sm text-red-500">
                  {errorMessage || 'Something went wrong. Please try again.'}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-14 rounded-full bg-[#000000] text-white text-base font-medium hover:-translate-y-1 transition-transform mt-4 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {submitting ? 'Sending…' : 'Send Inquiry'}
              </button>
            </form>
          )}
        </div>

      </section>
    </div>
  );
}
