'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVault } from '@/contexts/VaultContext';
import { Eye, EyeOff, Loader2, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { SecondFactorStep } from '@/components/SecondFactorStep';
import { normaliseRecoveryKey } from '@/lib/vault-crypto';
import { Checkbox } from '@/components/ui/checkbox';
import { useVaultPreferences } from '@/hooks/useVaultPreferences';
import { enableRememberIfChosen, forgetDevice } from '@/lib/device-session';

interface UnlockVaultProps {
  onUnlock: () => void;
  isAdmin?: boolean;
  onAdminPanel?: () => void;
}

export function UnlockVault({ onUnlock, isAdmin, onAdminPanel }: UnlockVaultProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'unlock' | 'recover'>('unlock');
  const { unlockVault, isLoading, error, secondFactor } = useVault();
  const { prefs, setPref } = useVaultPreferences();
  const [keepUnlocked, setKeepUnlocked] = useState(prefs.rememberDays > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    // "Keep me unlocked on this device": takes effect with this unlock.
    if (keepUnlocked && prefs.rememberDays <= 0) {
      setPref('rememberDays', 30);
      setPref('autoLockMinutes', 0);
      enableRememberIfChosen(30);
    } else if (keepUnlocked) {
      enableRememberIfChosen(prefs.rememberDays);
    } else if (!keepUnlocked && prefs.rememberDays > 0) {
      setPref('rememberDays', 0);
      void forgetDevice();
    }
    await unlockVault(password);
    onUnlock();
  };

  const title = secondFactor === 'required' ? 'Confirm it’s you' : mode === 'recover' ? 'Recover your vault' : 'Unlock your vault';
  const subtitle = secondFactor === 'required'
    ? 'Your account has two-step sign-in on.'
    : mode === 'recover' ? 'Use the recovery key from your Recovery Kit.' : 'Enter your master password to continue';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/8 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-sm space-y-8 animate-fade-up">
        <div className="flex justify-center"><Logo size="lg" /></div>
        <div className="text-center">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div key={`${secondFactor}-${mode}`} className="bg-card border border-border rounded-2xl p-6 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {secondFactor === 'required' ? (
            <SecondFactorStep />
          ) : mode === 'recover' ? (
            <RecoverForm onBack={() => setMode('unlock')} onDone={onUnlock} />
          ) : (
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
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
                </div>
              )}
              <label className="flex items-start gap-2.5 text-sm cursor-pointer select-none">
                <Checkbox checked={keepUnlocked} onCheckedChange={(v) => setKeepUnlocked(v === true)} className="mt-0.5" />
                <span>
                  Keep me unlocked on this device
                  <span className="block text-xs text-muted-foreground">For {prefs.rememberDays > 0 ? prefs.rememberDays : 30} days. Only on your own computer.</span>
                </span>
              </label>
              <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold" disabled={!password.trim() || isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Unlock vault'}
              </Button>
              <button type="button" onClick={() => setMode('recover')} className="w-full text-xs text-muted-foreground hover:text-foreground">
                Forgot master password?
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Your master password is never sent to our servers. It only decrypts your vault on this device.
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

function RecoverForm({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { recoverVault, isLoading } = useVault();
  const [key, setKey] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');

  const keyOk = normaliseRecoveryKey(key).length === 32;
  const pwOk = pw.length >= 12 && pw === pw2;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyOk || !pwOk) return;
    setError('');
    try {
      await recoverVault(key, pw);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not recover the vault.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="rk" className="text-sm font-medium flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" />Recovery key</Label>
        <Input id="rk" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} autoComplete="off" spellCheck={false} autoFocus
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" className="h-11 font-mono text-sm bg-secondary/50" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="np" className="text-sm font-medium">New master password</Label>
        <Input id="np" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password"
          placeholder="At least 12 characters" className="h-11 bg-secondary/50" />
        <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" aria-label="New master password again"
          placeholder="Again" className="h-11 bg-secondary/50" />
        {pw2 && pw !== pw2 && <p className="text-xs text-destructive">The two passwords differ.</p>}
      </div>
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
        </div>
      )}
      <Button type="submit" className="w-full h-11 font-semibold" disabled={!keyOk || !pwOk || isLoading}>
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Recover vault'}
      </Button>
      <button type="button" onClick={onBack} className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
        <ArrowLeft className="w-3 h-3" />Back to unlock
      </button>
    </form>
  );
}
