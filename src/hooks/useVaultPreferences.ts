'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'system';
export type DefaultSort = 'updated' | 'alpha' | 'newest' | 'weakest';
export type DefaultEntryType = 'login' | 'note' | 'card' | 'identity' | 'wifi' | 'bank';

export interface VaultPreferences {
  autoLockMinutes: number;
  clipboardTimeoutSeconds: number;
  defaultPasswordLength: number;
  defaultUppercase: boolean;
  defaultNumbers: boolean;
  defaultSymbols: boolean;
  compactView: boolean;
  theme: Theme;
  defaultSort: DefaultSort;
  defaultEntryType: DefaultEntryType;
  /** Stay unlocked on this device across reloads for this many days (0 = off). */
  rememberDays: number;
}

const DEFAULTS: VaultPreferences = {
  autoLockMinutes: 15,
  clipboardTimeoutSeconds: 30,
  defaultPasswordLength: 20,
  defaultUppercase: true,
  defaultNumbers: true,
  defaultSymbols: true,
  compactView: false,
  theme: 'dark',
  defaultSort: 'updated',
  defaultEntryType: 'login',
  rememberDays: 0,
};

const KEYS: Record<keyof VaultPreferences, string> = {
  autoLockMinutes:         'sv_autolock_minutes',
  clipboardTimeoutSeconds: 'sv_clipboard_timeout',
  defaultPasswordLength:   'sv_pw_length',
  defaultUppercase:        'sv_pw_upper',
  defaultNumbers:          'sv_pw_numbers',
  defaultSymbols:          'sv_pw_symbols',
  compactView:             'sv_compact_view',
  theme:                   'sv_theme',
  defaultSort:             'sv_default_sort',
  defaultEntryType:        'sv_default_type',
  rememberDays:            'sv_remember_days',
};

function readPref<K extends keyof VaultPreferences>(key: K): VaultPreferences[K] {
  if (typeof window === 'undefined') return DEFAULTS[key];
  const raw = localStorage.getItem(KEYS[key]);
  if (raw === null) return DEFAULTS[key];
  const def = DEFAULTS[key];
  if (typeof def === 'boolean') return (raw !== 'false') as VaultPreferences[K];
  if (typeof def === 'number')  return parseInt(raw, 10) as VaultPreferences[K];
  // string enum — return as-is (already stored as string)
  return raw as unknown as VaultPreferences[K];
}

function writePref<K extends keyof VaultPreferences>(key: K, value: VaultPreferences[K]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS[key], String(value));
  // Broadcast to other hook instances in the same tab
  window.dispatchEvent(new StorageEvent('storage', { key: KEYS[key], newValue: String(value) }));
}

function readAll(): VaultPreferences {
  return Object.fromEntries(
    (Object.keys(DEFAULTS) as (keyof VaultPreferences)[]).map(k => [k, readPref(k)])
  ) as unknown as VaultPreferences;
}

/**
 * useVaultPreferences — reads/writes user vault preferences backed by localStorage.
 * Multiple hook instances in the same tab stay in sync via a synthetic StorageEvent.
 */
export function useVaultPreferences() {
  const [prefs, setPrefs] = useState<VaultPreferences>(() =>
    typeof window !== 'undefined' ? readAll() : { ...DEFAULTS }
  );

  // Re-read when localStorage changes (cross-tab or same-tab synthetic event)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      const isOurs = Object.values(KEYS).includes(e.key ?? '');
      if (isOurs) setPrefs(readAll());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setPref = useCallback(<K extends keyof VaultPreferences>(key: K, value: VaultPreferences[K]) => {
    writePref(key, value);
    setPrefs(prev => ({ ...prev, [key]: value }));
  }, []);

  return { prefs, setPref, DEFAULTS };
}

/** Lightweight read-only access — no re-renders, just a snapshot. */
export function getVaultPreference<K extends keyof VaultPreferences>(key: K): VaultPreferences[K] {
  return readPref(key);
}
