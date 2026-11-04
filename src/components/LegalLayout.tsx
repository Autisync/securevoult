'use client';

import Link from 'next/link';
import { Shield, ChevronRight, ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface LegalSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

interface LegalLayoutProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  effectiveDate: string;
  badge?: string;
  badgeColor?: string;
  sections: LegalSection[];
  children?: React.ReactNode;
}

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} className={`reveal ${inView ? 'visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function LegalLayout({
  title,
  subtitle,
  lastUpdated,
  effectiveDate,
  badge = 'Legal',
  badgeColor = 'bg-primary/10 text-primary border-primary/20',
  sections,
}: LegalLayoutProps) {
  const [activeSection, setActiveSection] = useState('');
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setNavScrolled(window.scrollY > 20);
      // Update active TOC entry
      const headings = sections.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
      const scrollY = window.scrollY + 120;
      let active = '';
      for (const el of headings) {
        if (el.offsetTop <= scrollY) active = el.id;
      }
      setActiveSection(active);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className={`sticky top-0 z-50 border-b transition-all duration-300 ${navScrolled ? 'border-border/60 bg-background/95 backdrop-blur-xl shadow-lg shadow-black/10' : 'border-border/30 bg-background/70 backdrop-blur-md'}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight">SecureVoult</span>
          </Link>
          <div className="hidden md:flex items-center gap-5 text-xs text-muted-foreground">
            <Link href="/privacy"   className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms"     className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/cookies"   className="hover:text-foreground transition-colors">Cookies</Link>
            <Link href="/dpa"       className="hover:text-foreground transition-colors">DPA</Link>
            <Link href="/security"  className="hover:text-foreground transition-colors">Security</Link>
          </div>
          <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to app
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/6 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center animate-fade-up">
          <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border mb-5 ${badgeColor}`}>
            {badge}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{title}</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">{subtitle}</p>
          <div className="flex items-center justify-center gap-6 mt-6 text-xs text-muted-foreground/60">
            <span>Effective: <span className="text-muted-foreground font-medium">{effectiveDate}</span></span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <span>Last updated: <span className="text-muted-foreground font-medium">{lastUpdated}</span></span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 pb-24 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-12">
        {/* Sticky TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3">Contents</p>
            <nav className="space-y-1">
              {sections.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`flex items-center gap-2 text-xs py-1.5 px-2.5 rounded-lg transition-all duration-200 ${
                    activeSection === s.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  {activeSection === s.id && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                  <span className={activeSection === s.id ? '' : 'ml-5'}>{s.title}</span>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <article className="min-w-0">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-10 animate-fade-up">
            <p className="text-xs text-amber-400/80 leading-relaxed">
              <strong className="text-amber-400">Plain language notice:</strong> We have written these documents to be readable, not just legally complete. If anything is unclear, email us at <a href="mailto:legal@securevoult.co.uk" className="underline underline-offset-2 hover:opacity-80">legal@securevoult.co.uk</a>.
            </p>
          </div>

          {sections.map((section, i) => (
            <Reveal key={section.id} delay={i * 50}>
              <section
                id={section.id}
                className="mb-12 scroll-mt-28 bg-card border border-border rounded-2xl p-8 hover:border-border/80 transition-colors duration-300"
              >
                <h2 className="text-xl font-bold mb-5 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {i + 1}
                  </span>
                  {section.title}
                </h2>
                <div className="prose-legal">{section.content}</div>
              </section>
            </Reveal>
          ))}

          {/* Contact card */}
          <Reveal>
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-lg mb-2">Questions about this document?</h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                Our team is happy to answer any questions. We respond to all legal enquiries within 5 business days.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap text-xs">
                <a href="mailto:legal@securevoult.co.uk" className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium">
                  legal@securevoult.co.uk
                </a>
                <a href="mailto:privacy@securevoult.co.uk" className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                  privacy@securevoult.co.uk
                </a>
              </div>
            </div>
          </Reveal>
        </article>
      </div>

      {/* Mini footer */}
      <footer className="border-t border-border/40 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground/50">© {new Date().getFullYear()} SecureVoult Ltd.</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground/50">
            {[
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms',          href: '/terms' },
              { label: 'Cookies',        href: '/cookies' },
              { label: 'DPA',            href: '/dpa' },
              { label: 'Security',       href: '/security' },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="hover:text-muted-foreground transition-colors">{label}</Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Shared prose helpers ──────────────────────────────────────────────────────

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-4 last:mb-0">{children}</p>;
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold mb-2 mt-6 first:mt-0">{children}</h3>;
}

export function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-1.5 mb-4 last:mb-0">{children}</ul>;
}

export function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-2 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}

export function InfoBox({ children, color = 'blue' }: { children: React.ReactNode; color?: 'blue' | 'green' | 'amber' | 'red' }) {
  const styles = {
    blue:  'bg-blue-500/5 border-blue-500/20 text-blue-400/80',
    green: 'bg-green-500/5 border-green-500/20 text-green-400/80',
    amber: 'bg-amber-500/5 border-amber-500/20 text-amber-400/80',
    red:   'bg-red-500/5 border-red-500/20 text-red-400/80',
  };
  return (
    <div className={`border rounded-xl p-4 mb-4 last:mb-0 ${styles[color]}`}>
      <div className="text-xs leading-relaxed">{children}</div>
    </div>
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto mb-4 last:mb-0">
      <table className="w-full text-xs border border-border rounded-xl overflow-hidden">
        <thead>
          <tr className="bg-secondary/50">
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground border-b border-border">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-muted-foreground align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
