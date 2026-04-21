'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVault } from '@/contexts/VaultContext';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/Logo';

interface UnlockVaultProps {
  onUnlock: () => void;
  isAdmin?: boolean;
  onAdminPanel?: () => void;
}

export function UnlockVault({ onUnlock, isAdmin, onAdminPanel }: UnlockVaultProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { unlockVault, isLoading, error } = useVault();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    try {
      await unlockVault(password);
      onUnlock();
    } catch {
      // error shown via context
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/8 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-sm space-y-8 animate-fade-up">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold">Unlock your vault</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter your master password to continue</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="master-password" className="text-sm font-medium">Master password</Label>
              <div className="relative">
                <Input
                  id="master-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password"
                  className="h-11 pr-10 bg-secondary/50 border-border/60 focus:border-primary"
                  autoComplete="current-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold"
              disabled={!password.trim() || isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Unlock vault'}
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Your master password is never sent to our servers. It only decrypts your vault locally.
        </p>
        {isAdmin && onAdminPanel && (
          <div className="text-center">
            <button onClick={onAdminPanel} className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline-offset-2 hover:underline transition-colors">
              Open admin panel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}