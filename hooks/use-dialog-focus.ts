'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusables = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');

/**
 * Keyboard behaviour every modal dialog needs:
 *  - on open, focus moves into the dialog (the first field/button, or the dialog box itself);
 *  - Tab and Shift+Tab stay inside it instead of walking out to the page behind;
 *  - Escape closes it (when `onClose` is given);
 *  - on close, focus returns to whatever opened it.
 * Put `ref` on the element with role="dialog" and give it tabIndex={-1}.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, onClose?: () => void, active = true) {
  // Always call the caller's latest onClose (it may close over state such as "busy") without re-running the effect below.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const dialog = ref.current;
    if (!active || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Wait a tick so a field that autofocuses itself (autoFocus) wins, and entrance animations don't hide the target.
    const t = setTimeout(() => {
      if (dialog.contains(document.activeElement)) return;
      (focusables(dialog)[0] ?? dialog).focus({ preventScroll: true });
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeRef.current && !e.defaultPrevented) {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables(dialog);
      if (items.length === 0) { e.preventDefault(); dialog.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || current === dialog || !dialog.contains(current))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (current === last || !dialog.contains(current))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
