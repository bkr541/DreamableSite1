'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import SplineBackground from '@/components/SplineBackground';

type TokenStatus = 'validating' | 'valid' | 'expired' | 'invalid';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<TokenStatus>('validating');
  const [tokenEmail, setTokenEmail] = useState('');

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
        <div className="text-center">
          <p className="text-xs font-bold text-[#1a2030] uppercase tracking-widest mb-8">Link verified</p>
          <p className="text-sm text-[#555] leading-relaxed">
            Your reset link for <span className="font-medium text-[#1a1a1a]">{tokenEmail}</span> is valid.
            Password-setting will be available once full authentication is configured.
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
