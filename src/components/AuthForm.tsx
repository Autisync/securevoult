'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, ShieldCheck, Zap, Lock, Fingerprint } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Logo } from '@/components/Logo';
import { loginWithPasskey, isPasskeyAvailable } from '@/lib/passkey';
import { TrustSignals } from '@/components/TrustSignals';

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    isPasskeyAvailable().then(setPasskeyAvailable);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: 'Please make sure your passwords match.', variant: 'destructive' });
      return;
    }
    if (!isLogin && password.length < 8) {
      toast({ title: 'Password too short', description: 'Password must be at least 8 characters.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      if (isLogin) {
        await signIn({ email, password });
        toast({ title: 'Welcome back', description: 'Loading your vault...' });
      } else {
        await signUp({ email, password, displayName: displayName || undefined });
        toast({ title: 'Account created', description: 'Your account is ready.' });
      }
    } catch (error) {
      toast({
        title: isLogin ? 'Sign in failed' : 'Registration failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      toast({
        title: 'Google sign in failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setPasskeyLoading(true);
    try {
      await loginWithPasskey({ email: email || undefined });
      toast({ title: 'Signed in with passkey', description: 'Loading your vault…' });
    } catch (error) {
      toast({
        title: 'Passkey sign in failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12 bg-gradient-to-br from-[hsl(var(--card))] to-[hsl(var(--card))]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-amber-700/10 rounded-full blur-3xl pointer-events-none" />
        <Logo size="lg" />
        <div className="relative space-y-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight mb-4">
              Your passwords,{' '}
              <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
                encrypted
              </span>
              <br />end-to-end.
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Military-grade AES-256-GCM encryption. Your master password never leaves your device.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { icon: Lock,        text: 'Zero-knowledge architecture — we never see your data' },
              { icon: ShieldCheck, text: 'AES-256-GCM encryption with Argon2id key derivation' },
              { icon: Zap,         text: 'Instant autofill across browser and mobile' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center">
                  <Icon className="w-3 h-3 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground leading-relaxed">{text}</span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <TrustSignals max={3} compact />
          </div>
        </div>
        <p className="text-xs text-muted-foreground/50">
          Copyright {new Date().getFullYear()} SecureVoult. Built for security, designed for humans.
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8 animate-fade-up">
          <div className="lg:hidden">
            <Logo size="md" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">{isLogin ? 'Welcome back' : 'Create account'}</h2>
            <p className="mt-2 text-muted-foreground">
              {isLogin ? 'Sign in to access your encrypted vault.' : 'Set up your zero-knowledge password vault.'}
            </p>
          </div>
          {isLogin && passkeyAvailable && (
            <Button
              variant="outline"
              className="w-full h-11 border-primary/30 hover:border-primary/60 hover:bg-primary/5 text-primary"
              onClick={handlePasskeySignIn}
              disabled={isLoading || passkeyLoading}
            >
              {passkeyLoading
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Fingerprint className="w-4 h-4 mr-2" />}
              Sign in with a passkey
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full h-11 border-border/60 hover:border-border hover:bg-secondary/50"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground">or continue with email</span>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-sm font-medium">Name (optional)</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-11 bg-secondary/50 border-border/60 focus:border-primary"
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-secondary/50 border-border/60 focus:border-primary"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isLogin ? 'Your password' : 'Choose a strong password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10 bg-secondary/50 border-border/60 focus:border-primary"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
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
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 bg-secondary/50 border-border/60 focus:border-primary"
                  autoComplete="new-password"
                />
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLogin ? (
                'Sign in'
              ) : (
                'Create account'
              )}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
