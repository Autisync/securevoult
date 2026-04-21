'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Fingerprint, Plus, Trash2, Loader2, ShieldCheck, AlertTriangle,
  Smartphone, Monitor,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  registerPasskey, deletePasskey, listPasskeys, isPasskeyAvailable,
  type StoredPasskey,
} from '@/lib/passkey';
import { formatDistanceToNow } from 'date-fns';

interface PasskeySettingsProps {
  /** Whether passkeys are allowed for this plan */
  planAllows: boolean;
  onUpgrade?: () => void;
}

function deviceIcon(transports: string[]): React.ElementType {
  if (transports.includes('internal')) return Fingerprint;
  if (transports.includes('hybrid') || transports.includes('ble')) return Smartphone;
  return Monitor;
}

export function PasskeySettings({ planAllows, onUpgrade }: PasskeySettingsProps) {
  const [passkeys, setPasskeys]       = useState<StoredPasskey[]>([]);
  const [loading, setLoading]         = useState(true);
  const [registering, setRegistering] = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [deviceName, setDeviceName]   = useState('');
  const [supported, setSupported]     = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    isPasskeyAvailable().then(setSupported);
    if (planAllows) load();
    else setLoading(false);
  }, [planAllows]);

  const load = async () => {
    try {
      setLoading(true);
      setPasskeys(await listPasskeys());
    } catch {
      toast({ title: 'Failed to load passkeys', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!planAllows) { onUpgrade?.(); return; }
    if (!supported) {
      toast({ title: 'Passkeys not supported', description: 'Your device/browser does not support passkeys.', variant: 'destructive' });
      return;
    }
    try {
      setRegistering(true);
      const result = await registerPasskey({ deviceName: deviceName.trim() || undefined });
      toast({ title: 'Passkey registered', description: `${result.deviceName} has been added.` });
      setDeviceName('');
      await load();
    } catch (err) {
      toast({
        title: 'Registration failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (credentialId: string) => {
    try {
      setDeletingId(credentialId);
      await deletePasskey(credentialId);
      toast({ title: 'Passkey removed' });
      setPasskeys(prev => prev.filter(p => p.credentialId !== credentialId));
    } catch (err) {
      toast({
        title: 'Failed to remove passkey',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Fingerprint className="w-4 h-4 text-primary" />Passkeys
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Sign in and unlock your vault with biometrics or a hardware key — no password needed.
        </p>
      </div>

      {!planAllows ? (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-center space-y-3">
          <Fingerprint className="w-8 h-8 text-primary mx-auto opacity-50" />
          <div>
            <p className="text-sm font-medium">Passkeys require Pro</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upgrade to Pro to enable biometric sign-in.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={onUpgrade}>
            Upgrade to Pro
          </Button>
        </div>
      ) : supported === false ? (
        <div className="flex items-start gap-2.5 p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Passkeys not available</p>
            <p className="opacity-80 mt-0.5">
              Your browser or device doesn&apos;t support passkeys. Try Chrome 108+, Safari 16+, or Edge 108+.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Register new passkey */}
          <div className="bg-secondary/30 border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Add a new passkey</p>
            <div className="flex gap-2">
              <Input
                placeholder="Device name (optional)"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
                className="h-9 bg-secondary/50 border-border/60 text-sm flex-1"
                onKeyDown={e => { if (e.key === 'Enter') handleRegister(); }}
              />
              <Button
                size="sm"
                className="h-9 gap-1.5"
                onClick={handleRegister}
                disabled={registering}
              >
                {registering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {registering ? 'Registering…' : 'Add passkey'}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              You&apos;ll be prompted by your browser or device to complete the registration.
            </p>
          </div>

          {/* Existing passkeys */}
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />Loading…
            </div>
          ) : passkeys.length === 0 ? (
            <div className="flex items-center gap-2.5 p-3 bg-secondary/30 border border-border rounded-xl text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              No passkeys registered yet. Add one above to get started.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Registered passkeys ({passkeys.length})</p>
              {passkeys.map(pk => {
                const Icon = deviceIcon(pk.transports);
                return (
                  <div
                    key={pk.credentialId}
                    className="flex items-center justify-between bg-secondary/30 border border-border rounded-xl p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{pk.deviceName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {pk.transports.map(t => (
                            <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-border/60">
                              {t}
                            </Badge>
                          ))}
                          <span className="text-[10px] text-muted-foreground">
                            Added {formatDistanceToNow(new Date(pk.createdAt), { addSuffix: true })}
                          </span>
                          {pk.lastUsedAt && (
                            <span className="text-[10px] text-muted-foreground">
                              · Last used {formatDistanceToNow(new Date(pk.lastUsedAt), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      onClick={() => handleDelete(pk.credentialId)}
                      disabled={deletingId === pk.credentialId}
                    >
                      {deletingId === pk.credentialId
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
