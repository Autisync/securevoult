'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * useAutoLock — fires onLock() after `minutes` minutes of inactivity.
 * Resets on any user interaction event.
 * Pass minutes=0 to disable.
 */
export function useAutoLock(minutes: number, onLock: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (minutes > 0) {
      timerRef.current = setTimeout(() => {
        onLockRef.current();
      }, minutes * 60 * 1000);
    }
  }, [minutes]);

  useEffect(() => {
    if (minutes <= 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));

    reset(); // start immediately

    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [minutes, reset]);
}
