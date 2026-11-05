/**
 * Where you are in the app, kept in the address bar (#/vault/settings,
 * #/admin/health …) so a reload brings you back to the same place.
 */
export function readRoute(): string[] {
  if (typeof window === 'undefined') return [];
  const h = window.location.hash;
  if (!h.startsWith('#/')) return [];
  return h.slice(2).split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
}

export function writeRoute(parts: string[]): void {
  if (typeof window === 'undefined') return;
  const h = '#/' + parts.filter(Boolean).map(encodeURIComponent).join('/');
  if (window.location.hash !== h) window.history.replaceState(window.history.state, '', h);
}
