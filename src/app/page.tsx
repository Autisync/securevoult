'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getVaultPreference } from '@/hooks/useVaultPreferences';
import { deviceSession, enableRememberIfChosen } from '@/lib/device-session';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { VaultProvider, useVault } from '@/contexts/VaultContext';
import { AuthForm } from '@/components/AuthForm';
import { MasterPasswordSetup } from '@/components/MasterPasswordSetup';
import { UnlockVault } from '@/components/UnlockVault';
import { VaultInterface } from '@/components/VaultInterface';
import { LandingPage } from '@/components/LandingPage';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/toaster';
import { AdminPanel } from '@/components/AdminPanel';
import { Button } from '@/components/ui/button';
import { AuthService } from '@/lib/auth';
import { RecoveryKitDialog } from '@/components/RecoveryKitDialog';
import { readRoute, writeRoute } from '@/lib/route';

type AppView = 'landing' | 'auth' | 'setup' | 'unlock' | 'vault' | 'admin' | 'landing_preview';

function Home() {
  const { user, isLoading } = useAuth();
  const { hasVault, isUnlocked } = useVault();
  // Where you were before a reload (#/admin/…, #/vault/…, #/signin, #/site).
  const [wanted] = useState(() => readRoute()[0] ?? '');
  const [currentView, setCurrentView] = useState<AppView>(() => (wanted === 'signin' ? 'auth' : 'landing'));
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // A team invite opened before signing in: join the team once signed in.
  useEffect(() => {
    if (!user) return;
    let token = '';
    try { token = localStorage.getItem('sv_invite_token') ?? ''; } catch { /* blocked */ }
    if (!token) return;
    (async () => {
      try {
        const idToken = await AuthService.getIdToken();
        const res = await fetch('/api/invites/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ token }) });
        const data = await res.json().catch(() => ({}));
        try { localStorage.removeItem('sv_invite_token'); } catch { /* blocked */ }
        const { toast } = await import('@/components/ui/use-toast');
        toast(res.ok
          ? { title: `You've joined ${data.companyName ?? 'your team'}`, description: 'Shared items from your team will appear in your vault.' }
          : { title: "Couldn't accept the invite", description: data.message ?? data.error ?? 'Ask your admin for a new invite.', variant: 'destructive' });
      } catch { /* try again next load */ }
    })();
  }, [user]);

  // Keep the address in step with the screen (the vault and admin screens add their own detail).
  useEffect(() => {
    if (currentView === 'auth') writeRoute(['signin']);
    else if (currentView === 'landing_preview') writeRoute(['site']);
    else if (currentView === 'landing' && !user && readRoute()[0] === 'signin') window.history.replaceState(null, '', window.location.pathname);
  }, [currentView, user]);

  // The screen to return to after unlocking: the last one you used, or the one in the address after a reload.
  const returnTo = useRef(wanted);
  useEffect(() => {
    if (currentView === 'vault') returnTo.current = 'vault';
    if (currentView === 'admin') returnTo.current = 'admin';
    if (currentView === 'landing_preview') returnTo.current = 'site';
  }, [currentView]);
  const afterUnlock = (): AppView => (returnTo.current === 'admin' && user?.role === 'admin' ? 'admin' : returnTo.current === 'site' ? 'landing_preview' : 'vault');
  useEffect(() => {
    if (isUnlocked && (currentView === 'unlock' || currentView === 'setup')) setCurrentView(afterUnlock());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, currentView]);

  useEffect(() => {
    if (!user) return;
    hasVault().then((exists) => {
      setCurrentView(exists ? 'unlock' : 'setup');
    });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    if (currentView === 'auth') {
      return <AuthForm />;
    }
    return (
      <LandingPage
        onGetStarted={() => setCurrentView('auth')}
        onSignIn={() => setCurrentView('auth')}
      />
    );
  }

  const isAdmin = user.role === 'admin';

  // Landing page preview — accessible to authenticated users
  if (currentView === 'landing_preview') {
    return (
      <div className="relative">
        {/* Preview banner */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary/95 text-primary-foreground px-4 py-2 flex items-center justify-between text-sm font-medium shadow-lg">
          <span>👁 Public site preview — this is what visitors see</span>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setCurrentView(isAdmin ? 'admin' : 'vault')}
          >
            ← Back to {isAdmin ? 'admin' : 'vault'}
          </Button>
        </div>
        <div className="pt-10">
          <LandingPage
            onGetStarted={() => setCurrentView(isAdmin ? 'admin' : 'vault')}
            onSignIn={() => setCurrentView(isAdmin ? 'admin' : 'vault')}
          />
        </div>
      </div>
    );
  }

  // Admin view
  if (currentView === 'admin' && isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <AdminPanel
          onBackToVault={() => setCurrentView('vault')}
          onViewPublicSite={() => setCurrentView('landing_preview')}
        />
      </div>
    );
  }

  // Unlocked by "keep me unlocked" while another screen is wanted: wait a beat for the switch.
  if (isUnlocked && (currentView === 'unlock' || currentView === 'setup') && afterUnlock() !== 'vault') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Vault view
  if (isUnlocked && (currentView === 'vault' || currentView === 'unlock' || currentView === 'setup')) {
    return (
      <VaultInterface
        onViewPublicSite={() => setCurrentView('landing_preview')}
        onOpenAdmin={isAdmin ? () => setCurrentView('admin') : undefined}
      />
    );
  }

  // Master password setup
  if (currentView === 'setup') {
    return <MasterPasswordSetup onComplete={() => setCurrentView('unlock')} />;
  }

  // Unlock
  return (
    <UnlockVault
      onUnlock={() => { setIsVaultUnlocked(true); setCurrentView(afterUnlock()); }}
      isAdmin={isAdmin}
      onAdminPanel={isAdmin ? () => setCurrentView('admin') : undefined}
    />
  );
}

export default function Page() {
  // "Keep me unlocked on this device" (Settings → Security). Read once per page load.
  const session = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    enableRememberIfChosen(getVaultPreference('rememberDays'));
    return deviceSession(() => getVaultPreference('rememberDays'), () => AuthService.currentUid());
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <VaultProvider session={session}>
          <Home />
          <RecoveryKitDialog />
          <Toaster />
        </VaultProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
