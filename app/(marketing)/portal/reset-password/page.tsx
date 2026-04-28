'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import SplineBackground from '@/components/SplineBackground';

type TokenStatus = 'validating' | 'valid' | 'expired' | 'invalid' | 'success';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<TokenStatus>('validating');
  const [tokenEmail, setTokenEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }

    fetch('/api/auth/verify-reset-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.expired) { setStatus('expired'); return; }
        if (data.valid) { setTokenEmail(data.email ?? ''); setStatus('valid'); return; }
        setStatus('invalid');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setFieldError('');

    if (password.length < 8) {
      setFieldError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setFieldError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFieldError(data.error || 'Something went wrong.');
        return;
      }
      setStatus('success');
      setTimeout(() => router.push('/portal'), 2000);
    } catch {
      setFieldError('Unable to connect. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
      className="w-full rounded-3xl p-8 bg-white shadow-lg border border-[#F0F0F0]"
    >
      {status === 'validating' && (
        <p className="text-sm text-[#888] text-center py-4">Verifying your link…</p>
      )}

      {status === 'valid' && (
        <div>
          <p className="text-xs font-bold text-[#1a2030] uppercase tracking-widest mb-2">Set your password</p>
          <p className="text-sm text-[#888] mb-8">
            Setting password for <span className="font-medium text-[#1a1a1a]">{tokenEmail}</span>
          </p>

          <form onSubmit={handleSetPassword} className="space-y-6">
            <div className="flex flex-col">
              <label htmlFor="new-password" className="text-sm font-medium text-[#555] mb-2">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-purple-200/50 border border-[#D0D0D0] transition-all"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="confirm-password" className="text-sm font-medium text-[#555] mb-2">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-purple-200/50 border border-[#D0D0D0] transition-all"
              />
            </div>

            {fieldError && (
              <p className="text-sm text-[#888] leading-relaxed">{fieldError}</p>
            )}

            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-12 py-3.5 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {submitting ? 'Saving…' : 'Set Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center">
          <p className="text-xs font-bold text-[#1a2030] uppercase tracking-widest mb-8">Password set</p>
          <p className="text-sm text-[#555] leading-relaxed">
            Your password has been updated. Redirecting you to sign in…
          </p>
        </div>
      )}

      {status === 'expired' && (
        <div className="text-center">
          <p className="text-xs font-bold text-[#1a2030] uppercase tracking-widest mb-8">Link expired</p>
          <p className="text-sm text-[#888] leading-relaxed">
            This reset link has expired. Please request a new one from the sign-in page.
          </p>
          <div className="flex justify-center pt-6">
            <Link
              href="/portal"
              className="px-12 py-3.5 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      )}

      {status === 'invalid' && (
        <div className="text-center">
          <p className="text-xs font-bold text-[#1a2030] uppercase tracking-widest mb-8">Invalid link</p>
          <p className="text-sm text-[#888] leading-relaxed">
            This reset link is not valid. It may have already been used or was malformed.
          </p>
          <div className="flex justify-center pt-6">
            <Link
              href="/portal"
              className="px-12 py-3.5 rounded-full bg-[#1a2030] text-white text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <div className="fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <SplineBackground theme="memorable" />
      </div>

      <div className="relative flex flex-col items-center justify-center w-full min-h-[calc(100vh-80px)]" style={{ zIndex: 10 }}>
        <div className="w-full max-w-[480px] px-6 py-16 flex flex-col items-center">

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="mb-10 text-center"
          >
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-[#1a1a1a]">
              Reset Password
            </h1>
          </motion.div>

          <Suspense fallback={
            <div className="w-full rounded-3xl p-8 bg-white shadow-lg border border-[#F0F0F0]">
              <p className="text-sm text-[#888] text-center py-4">Verifying your link…</p>
            </div>
          }>
            <ResetPasswordContent />
          </Suspense>

        </div>
      </div>
    </>
  );
}
