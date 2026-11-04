'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastApi {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>.');
  return ctx;
}

const STYLE: Record<ToastKind, { icon: typeof CheckmarkCircle02Icon; bubble: string }> = {
  success: { icon: CheckmarkCircle02Icon, bubble: 'bg-green-50 text-green-600' },
  error: { icon: Alert02Icon, bubble: 'bg-red-50 text-[#e05252]' },
  info: { icon: InformationCircleIcon, bubble: 'bg-blue-50 text-blue-600' },
};

const DURATION: Record<ToastKind, number> = { success: 5000, info: 5000, error: 8000 };

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(DURATION[toast.kind]);
  const startedAt = useRef(0);

  // Auto-dismiss, pausing while the pointer is over the toast.
  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, toast.id, onDismiss]);

  const { icon, bubble } = STYLE[toast.kind];

  return (
    <motion.div
      layout
      role={toast.kind === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, x: 40, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.97 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto flex w-[360px] max-w-[calc(100vw-32px)] items-start gap-3 rounded-2xl bg-white border border-[#E8E8EC] p-4 shadow-xl"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${bubble}`}>
        <HugeiconsIcon icon={icon} size={20} color="currentColor" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#1a1a1a]">{toast.title}</p>
        {toast.message && <p className="mt-0.5 text-sm leading-snug text-[#666] break-words">{toast.message}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 text-[#AAA] hover:text-[#333] transition-colors"
      >
        <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((kind: ToastKind, title: string, message?: string) => {
    setToasts((t) => [...t.slice(-3), { id: nextId.current++, kind, title, message }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, message) => push('success', title, message),
      error: (title, message) => push('error', title, message),
      info: (title, message) => push('info', title, message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-6 right-6 z-[300] flex flex-col items-end gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
