'use client';

import { useEffect } from 'react';
import type { Theme } from '@/hooks/useVaultPreferences';

const THEME_KEY = 'sv_theme';

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem(THEME_KEY) as Theme) ?? 'dark';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark);
}

/**
 * ThemeProvider — reads the sv_theme preference and applies the correct
 * class to <html>.  Re-applies whenever localStorage changes (including
 * from the Settings panel in the same tab via the synthetic StorageEvent).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply immediately on mount
    applyTheme(getStoredTheme());

    const handler = (e: StorageEvent) => {
      if (e.key === THEME_KEY) {
        applyTheme((e.newValue as Theme) ?? 'dark');
      }
    };

    const mediaHandler = () => {
      if (getStoredTheme() === 'system') applyTheme('system');
    };

    window.addEventListener('storage', handler);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', mediaHandler);
    return () => {
      window.removeEventListener('storage', handler);
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaHandler);
    };
  }, []);

  return <>{children}</>;
}

/** Call this from a plain script tag in <head> to avoid FOUC. */
export const themeScript = `(function(){
  var t=localStorage.getItem('sv_theme')||'dark';
  var d=(t==='dark')||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.classList.toggle('dark',d);
  document.documentElement.classList.toggle('light',!d);
})();`;
