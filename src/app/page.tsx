'use client';

import { useEffect, useState } from 'react';
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

type AppView = 'landing' | 'auth' | 'setup' | 'unlock' | 'vault' | 'admin' | 'landing_preview';

function Home() {
  const { user, isLoading } = useAuth();
  const { hasVault, isUnlocked } = useVault();
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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
      onUnlock={() => { setIsVaultUnlocked(true); setCurrentView('vault'); }}
      isAdmin={isAdmin}
      onAdminPanel={isAdmin ? () => setCurrentView('admin') : undefined}
    />
  );
}

export default function Page() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <VaultProvider>
          <Home />
          <RecoveryKitDialog />
          <Toaster />
        </VaultProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
