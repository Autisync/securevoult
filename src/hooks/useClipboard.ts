'use client';

import { useState, useRef, useCallback } from 'react';

const TIMEOUT_KEY = 'sv_clipboard_timeout';

function getClipboardTimeout(): number {
  if (typeof window === 'undefined') return 30;
  return parseInt(localStorage.getItem(TIMEOUT_KEY) ?? '30', 10);
}

/**
 * useClipboard — copies text to clipboard and optionally auto-clears it after
 * the user-configured timeout (sv_clipboard_timeout localStorage key, seconds).
 *
 * Returns `{ copied, copy }` where `copied` is the key of the last copied item
 * (cleared after 2 s for UI feedback) and `copy(text, key)` performs the copy.
 */
export function useClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (text: string, key: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return false;
    }

    // UI feedback for 2 s
    setCopied(key);
    setTimeout(() => setCopied(prev => prev === key ? null : prev), 2000);

    // Auto-clear clipboard after timeout
    const seconds = getClipboardTimeout();
    if (seconds > 0) {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(async () => {
        try {
          // Only clear if the clipboard still contains this exact value
          const current = await navigator.clipboard.readText();
          if (current === text) {
            await navigator.clipboard.writeText('');
          }
        } catch {
          // Clipboard API may not be available in all contexts
        }
      }, seconds * 1000);
    }

    return true;
  }, []);

  return { copied, copy };
}
