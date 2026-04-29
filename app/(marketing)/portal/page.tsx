'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import SplineBackground from '@/components/SplineBackground';
import PasswordInput from '@/components/PasswordInput';

export default function Portal() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Forgot-password modal state
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }

      router.push(data.admin ? '/admin' : '/dashboard');
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openReset = () => {
    setResetEmail(email);
    setResetStatus('idle');
    setResetError('');
    setShowReset(true);
  };

  const closeReset = () => {
    setShowReset(false);
    setResetStatus('idle');
    setResetError('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (!newPassword || !confirmPassword) {
      setResetError('Both password fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters.');
      return;
    }

    setResetSubmitting(true);
    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setResetStatus('success');
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Something went wrong.');
      setResetStatus('error');
    } finally {
      setResetSubmitting(false);
    }
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
                <PasswordInput
                  id="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-purple-200/50 border border-[#D0D0D0] transition-all"
                />
                <button
                  type="button"
                  className="text-xs text-[#AAAAAA] hover:text-[#000000] transition-colors text-right mt-3"
                  onClick={openReset}
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

      {/* Forgot-password modal */}
      <AnimatePresence>
        {showReset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={closeReset}
            />

            {/* Modal card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-[440px] rounded-3xl p-8 bg-white shadow-xl border border-[#F0F0F0]"
            >
              <p className="text-xs font-bold text-[#1a2030] uppercase tracking-widest mb-8">
                Reset your password
              </p>

              {resetStatus === 'success' ? (
                <div className="space-y-6">
                  <p className="text-sm text-[#555] leading-relaxed">
                    Password updated successfully for <span className="font-medium text-[#1a1a1a]">{resetEmail}</span>. You can now sign in.
                  </p>
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={closeReset}
                      className="px-12 py-3.5 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-6">
                  <div className="flex flex-col">
                    <label htmlFor="reset-email" className="text-sm font-medium text-[#555] mb-2">
                      Email
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-purple-200/50 border border-[#D0D0D0] transition-all"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label htmlFor="new-password" className="text-sm font-medium text-[#555] mb-2">
                      New Password
                    </label>
                    <PasswordInput
                      id="new-password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-purple-200/50 border border-[#D0D0D0] transition-all"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label htmlFor="confirm-password" className="text-sm font-medium text-[#555] mb-2">
                      Confirm Password
                    </label>
                    <PasswordInput
                      id="confirm-password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-purple-200/50 border border-[#D0D0D0] transition-all"
                    />
                  </div>

                  {resetError && (
                    <p className="text-sm text-[#888] leading-relaxed">{resetError}</p>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={closeReset}
                      className="text-sm text-[#AAAAAA] hover:text-[#000000] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetSubmitting}
                      className="px-10 py-3.5 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    >
                      {resetSubmitting ? 'Updating…' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
