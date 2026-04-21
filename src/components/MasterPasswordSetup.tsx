'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { CryptoService } from '@/lib/crypto';
import { useVault } from '@/contexts/VaultContext';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Logo } from '@/components/Logo';

interface MasterPasswordSetupProps {
  onComplete: () => void;
}

export function MasterPasswordSetup({ onComplete }: MasterPasswordSetupProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { createVault } = useVault();
  const { toast } = useToast();

  const passwordStrength = CryptoService.checkPasswordStrength(password);
  const isPasswordValid = passwordStrength.strength === 'good' || passwordStrength.strength === 'strong';
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      setError('Please choose a stronger master password.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      // Create an empty encrypted vault using the provided master password.
      // Account identity is already established via Firebase Auth — no fake
      // email addresses are created here.
      await createVault(password);

      toast({
        title: 'Vault created',
        description: 'Your encrypted vault is ready. Keep your master password safe — it cannot be recovered.',
      });

      onComplete();
    } catch (err) {
      console.error('Vault creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create vault. Please try again.');

      toast({
        title: 'Vault creation failed',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-violet-600/8 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-md space-y-8 animate-fade-up">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold">Set your master password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This password encrypts your vault. It never leaves your device.
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Master password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a strong master password"
                  className="h-11 pr-10 bg-secondary/50 border-border/60 focus:border-primary"
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide' : 'Show'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && <PasswordStrengthIndicator result={passwordStrength} />}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your master password"
                  className="h-11 pr-10 bg-secondary/50 border-border/60 focus:border-primary"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirmPassword ? 'Hide' : 'Show'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && (
                <div className={`flex items-center gap-2 text-sm ${
                  passwordsMatch ? 'text-green-400' : 'text-destructive'
                }`}>
                  {passwordsMatch
                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : <AlertCircle className="w-3.5 h-3.5" />}
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-start gap-3 text-sm text-amber-400/80 bg-amber-500/8 border border-amber-500/15 rounded-xl px-3 py-3">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong className="text-amber-400">Cannot be recovered.</strong> If you forget your master password, your vault data is permanently lost. Store it somewhere safe.
              </span>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold"
              disabled={!isPasswordValid || !passwordsMatch || isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create my vault'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
