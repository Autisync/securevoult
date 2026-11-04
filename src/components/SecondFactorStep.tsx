'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVault } from '@/contexts/VaultContext';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

/** The authenticator-code step after signing in, before the master password. */
export function SecondFactorStep({ compact }: { compact?: boolean }) {
  const { verifySecondFactor } = useVault();
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = useBackup ? code.replace(/[^a-z0-9]/gi, '').length >= 10 : /^\d{6}$/.test(code.replace(/\s/g, ''));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await verifySecondFactor(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code is not right.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">Two-step sign-in</p>
          <p className="text-xs text-muted-foreground">
            {useBackup ? 'Type one of your backup codes.' : 'Enter the 6-digit code from your authenticator app.'}
          </p>
        </div>
      </div>
      <Input
        value={code}
        onChange={(e) => setCode(useBackup ? e.target.value.toUpperCase() : e.target.value.replace(/[^\d\s]/g, '').slice(0, 7))}
        inputMode={useBackup ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        placeholder={useBackup ? 'XXXXX-XXXXX' : '123 456'}
        aria-label={useBackup ? 'Backup code' : 'Authenticator code'}
        className="h-12 text-center font-mono text-xl tracking-[0.35em] bg-secondary/50"
        autoFocus
      />
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
        </div>
      )}
      <Button type="submit" className="w-full h-11 font-semibold" disabled={!ready || busy}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
      </Button>
      <button type="button" onClick={() => { setUseBackup((v) => !v); setCode(''); setError(''); }}
        className="w-full text-xs text-muted-foreground hover:text-foreground">
        {useBackup ? 'Use the authenticator app instead' : 'Lost your phone? Use a backup code'}
      </button>
    </form>
  );
}
