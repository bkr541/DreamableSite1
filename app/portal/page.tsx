'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import SplineBackground from '@/components/SplineBackground';

export default function Portal() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    // Placeholder — wire to your auth provider (NextAuth, Clerk, Supabase Auth, etc.)
    await new Promise((r) => setTimeout(r, 800));
    setError('Portal access is invitation-only. Check your email for your login link.');
    setSubmitting(false);
  };

  return (
    <>
      {/* Background extends behind the navbar */}
      <div className="fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <SplineBackground theme="memorable" />
      </div>

    <div className="relative flex flex-col items-center justify-center w-full min-h-[calc(100vh-80px)]" style={{ zIndex: 10 }}>
      <div className="w-full max-w-[480px] px-6 py-16 flex flex-col items-center">

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="mb-10 text-center"
        >
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-[#1a1a1a]">
            Client Portal
          </h1>
          <p className="text-base text-[#707070] leading-relaxed">
            Track your project&apos;s progress, review deliverables, and stay in sync with our team — all in one place.
          </p>
        </motion.div>

        {/* Login card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
          className="w-full rounded-3xl p-8 bg-white shadow-lg border border-[#F0F0F0]"
        >
          <p className="text-xs font-bold text-[#1a2030] uppercase tracking-widest mb-8">
            Sign in to your account
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col">
              <label htmlFor="email" className="text-sm font-medium text-[#555] mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-purple-200/50 border border-[#D0D0D0] transition-all"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="password" className="text-sm font-medium text-[#555] mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-purple-200/50 border border-[#D0D0D0] transition-all"
              />
              <button
                type="button"
                className="text-xs text-[#AAAAAA] hover:text-[#000000] transition-colors text-right mt-3"
                onClick={() => setError('Password reset is not yet configured.')}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p className="text-sm text-[#888] leading-relaxed">{error}</p>
            )}

            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-12 py-3.5 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {submitting ? 'Signing in…' : 'Sign In'}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-8 px-5 py-3 rounded-full bg-white/70 backdrop-blur-sm border border-white/60 shadow-sm"
        >
          <p className="text-xs text-center text-[#555]">
            Don&apos;t have access?{' '}
            <Link href="/contact" className="font-semibold text-[#1a2030] underline underline-offset-2 hover:text-purple-700 transition-colors">
              Start a project
            </Link>{' '}
            and we&apos;ll set you up.
          </p>
        </motion.div>

      </div>
    </div>
    </>
  );
}
