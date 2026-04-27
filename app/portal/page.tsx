'use client';

import { useState } from 'react';
import Link from 'next/link';

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
    <div className="flex flex-col items-center justify-center w-full min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-[480px] px-6 py-16 flex flex-col">

        {/* Heading block */}
        <div className="mb-14">
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight mb-5">
            Client Portal.
          </h1>
          <p className="text-lg text-[#707070] leading-relaxed">
            Track your project&apos;s progress, review deliverables, and stay in sync with our team — all in one place.
          </p>
        </div>

        {/* Login form */}
        <div className="w-full">
          <p className="text-xs font-medium text-[#AAAAAA] uppercase tracking-widest mb-10">
            Sign in to your account
          </p>

          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="flex flex-col">
              <label htmlFor="email" className="text-sm font-medium text-[#707070] mb-2">
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
                className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#000000] transition-colors"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="password" className="text-sm font-medium text-[#707070] mb-2">
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
                className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#000000] transition-colors"
              />
              <button
                type="button"
                className="text-xs text-[#AAAAAA] hover:text-[#000000] transition-colors text-left mt-3"
                onClick={() => setError('Password reset is not yet configured.')}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p className="text-sm text-[#888] leading-relaxed">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-14 rounded-full bg-[#1a2030] text-white text-base font-medium hover:-translate-y-1 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-16 text-xs text-[#BBBBBB]">
          Don&apos;t have access?{' '}
          <Link href="/contact" className="underline hover:text-[#555] transition-colors">
            Start a project
          </Link>{' '}
          and we&apos;ll set you up.
        </p>

      </div>
    </div>
  );
}
