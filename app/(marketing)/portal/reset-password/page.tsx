'use client';

import { PASSWORD_HINT, passwordProblem } from '@/lib/passwordPolicy';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import SplineBackground from '@/components/SplineBackground';
import PasswordInput from '@/components/PasswordInput';

type TokenStatus = 'validating' | 'valid' | 'expired' | 'invalid' | 'success';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<TokenStatus>('validating');
  const [invite, setInvite] = useState(false); // an invitation (first-time setup) rather than a password reset
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
        if (data.valid) { setInvite(data.purpose === 'invite'); setStatus('valid'); return; }
        setStatus('invalid');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setFieldError('');

    const weak = passwordProblem(password);
    if (weak) {
      setFieldError(weak);
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
          <p className="text-xs font-bold text-[#1a2030] uppercase tracking-widest mb-2">{invite ? 'Set up your account' : 'Set your password'}</p>
          <p className="text-sm text-[#888] mb-8">
            {invite ? 'Welcome to your client portal. Choose a password to finish setting up your account.' : 'Choose a new password for your account.'} This link can only be used once. {PASSWORD_HINT}
          </p>

          <form onSubmit={handleSetPassword} className="space-y-6" noValidate>
            <div className="flex flex-col">
              <label htmlFor="new-password" className="text-sm font-medium text-[#555] mb-2">
                New Password
              </label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldError(''); }}
                placeholder="••••••••"
                className={`bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-purple-200/50 border transition-all ${fieldError ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`}
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="confirm-password" className="text-sm font-medium text-[#555] mb-2">
                Confirm Password
              </label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setFieldError(''); }}
                placeholder="••••••••"
                className={`bg-white/60 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:ring-2 focus:ring-purple-200/50 border transition-all ${fieldError ? 'border-[#e05252]' : 'border-[#D0D0D0]'}`}
              />
              {fieldError && (
                <p className="text-sm text-[#e05252] mt-1.5 leading-relaxed">{fieldError}</p>
              )}
            </div>

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
            {invite ? 'Your account is ready.' : 'Your password has been updated.'} Redirecting you to sign in…
          </p>
        </div>
      )}

      {status === 'expired' && (
        <div className="text-center">
          <p className="text-xs font-bold text-[#1a2030] uppercase tracking-widest mb-8">Link expired</p>
          <p className="text-sm text-[#888] leading-relaxed">
            This link has expired. If it was an invitation, ask Dreamable.studio to send a new one; if you were resetting your password, request a new link from the sign-in page.
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
            This link is not valid. It may have already been used, been replaced by a newer one, or been malformed.
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
