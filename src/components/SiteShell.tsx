'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LEGAL } from '@/lib/legal';

const NAV: [string, string][] = [
  ['Features', '/#features'], ['Pricing', '/#pricing'], ['Training', '/training'], ['Partners', '/partners'], ['Security', '/security'],
];

/** Header and footer for the public pages (training, partners…), matching the home page. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <header className={`sticky top-0 z-50 transition-colors duration-300 ${scrolled ? 'bg-background/85 backdrop-blur-xl border-b border-border/60' : 'border-b border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" aria-label="SecureVoult home"><Logo size="sm" /></Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            {NAV.map(([l, h]) => <a key={h} href={h} className="hover:text-foreground transition-colors">{l}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <a href="/#/signin" className="hidden sm:inline-flex h-9 items-center px-3 rounded-lg text-sm hover:bg-secondary">Sign in</a>
            <a href="/#/signin" className="inline-flex h-9 items-center px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Get started</a>
            <button type="button" className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-secondary" onClick={() => setMenu((m) => !m)} aria-label="Menu">
              {menu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="md:hidden border-t border-border/60 bg-background px-4 py-3 grid gap-1">
            {NAV.map(([l, h]) => <a key={h} href={h} className="px-3 py-2.5 rounded-lg hover:bg-secondary" onClick={() => setMenu(false)}>{l}</a>)}
          </nav>
        )}
      </header>

      <main>{children}</main>

      <footer className="border-t border-border/60 mt-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-10 sm:grid-cols-2 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <Logo size="sm" />
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">The private password manager from Autisync.</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-3">Product</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/#features" className="hover:text-foreground">Features</a></li>
              <li><a href="/#pricing" className="hover:text-foreground">Pricing</a></li>
              <li><a href="/security" className="hover:text-foreground">Security</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium mb-3">Resources</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/training" className="hover:text-foreground">Training videos</a></li>
              <li><a href="/support" className="hover:text-foreground">Support</a></li>
              <li><a href="/partners" className="hover:text-foreground">Become a partner</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium mb-3">Legal</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/privacy" className="hover:text-foreground">Privacy policy</a></li>
              <li><a href="/terms" className="hover:text-foreground">Terms of service</a></li>
              <li><a href="/dpa" className="hover:text-foreground">Data processing (business)</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60">
          <p className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-xs text-muted-foreground">© {new Date().getFullYear()} {LEGAL.company}. SecureVoult is an Autisync product.</p>
        </div>
      </footer>
    </div>
  );
}
