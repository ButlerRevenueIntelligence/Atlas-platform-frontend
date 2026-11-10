import { useEffect, useRef } from 'react';

// Keep keyboard navigation inside an open administration dialog and restore focus.
export default function useAdminDialog(onClose, enabled = true, busy = false) {
  const ref = useRef(null);
  const state = useRef({ onClose, busy });
  state.current = { onClose, busy };
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(node => node.getClientRects().length);
    (controls()[0] || dialog).focus();
    function handleKey(event) {
      if (event.key === 'Escape' && !state.current.busy) {
        event.preventDefault();
        state.current.onClose();
      }
      if (event.key !== 'Tab') return;
      const items = controls();
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
    dialog.addEventListener('keydown', handleKey);
    return () => {
      dialog.removeEventListener('keydown', handleKey);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [enabled]);
  return ref;
}
