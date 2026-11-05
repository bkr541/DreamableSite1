'use client';

import { useLayoutEffect, useRef } from 'react';
import { useDialogFocus } from '@/hooks/use-dialog-focus';

/**
 * Drop this inside any element with role="dialog" / "alertdialog" to give it proper keyboard behaviour: focus moves in
 * when it opens, Tab stays inside, Escape closes (if `onClose` is given — leave it out where the dialog already handles
 * Escape itself), and focus returns to what opened it. It renders nothing visible.
 */
export default function DialogFocus({ onClose }: { onClose?: () => void }) {
  const marker = useRef<HTMLSpanElement>(null);
  const dialog = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = marker.current?.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]') ?? null;
    if (el && !el.hasAttribute('tabindex')) { el.tabIndex = -1; el.style.outline = 'none'; }
    dialog.current = el;
  }, []);
  useDialogFocus(dialog, onClose);
  return <span ref={marker} hidden />;
}
