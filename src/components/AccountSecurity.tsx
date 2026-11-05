'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useVault } from '@/contexts/VaultContext';
import { mfaApi } from '@/lib/mfa-client';
import { useAuth } from '@/contexts/AuthContext';
import { deviceUnlockInfo, deviceUnlockSupported, removeDeviceUnlock, setUpDeviceUnlock } from '@/lib/biometric';
import { Check, Copy, Download, Fingerprint, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';

const card = 'bg-card border border-border rounded-xl p-4 space-y-3';

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <p className="text-xs text-muted-foreground">
        Backup codes: each works once if you lose your phone. Shown only now. Keep them with your Recovery Kit, not in this vault.
      </p>
      <div className="grid grid-cols-2 gap-1.5 font-mono text-sm">
        {codes.map((c) => <span key={c} className="bg-secondary/60 rounded-md px-2 py-1 text-center select-all">{c}</span>)}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => downloadText('SecureVoult-backup-codes.txt', `SecureVoult backup codes (each works once)\n\n${codes.join('\n')}\n`)}>
          <Download className="w-3.5 h-3.5 mr-1.5" />Download
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={async () => { await navigator.clipboard.writeText(codes.join('\n')).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}Copy
        </Button>
      </div>
    </div>
  );
}

/** Settings → Security: authenticator app at sign-in. */
export function TwoStepSettings() {
  const { refreshSecondFactor } = useVault();
  const { toast } = useToast();
  const [status, setStatus] = useState<{ enabled: boolean; backupCodesLeft: number } | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauth: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<'idle' | 'disable' | 'regen'>('idle');

  const load = () => mfaApi.status().then((s) => setStatus({ enabled: s.enabled, backupCodesLeft: s.backupCodesLeft })).catch(() => setStatus({ enabled: false, backupCodesLeft: 0 }));
  useEffect(() => { void load(); }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast({ title: e instanceof Error ? e.message : 'Something went wrong', variant: 'destructive' }); }
    finally { setBusy(false); setCode(''); }
  };

  const start = () => run(async () => {
    const s = await mfaApi.setup();
    const qr = await QRCode.toDataURL(s.otpauth, { margin: 1, width: 200, color: { dark: '#0b1222', light: '#ffffff' } });
    setSetup({ ...s, qr });
  });

  const enable = () => run(async () => {
    const r = await mfaApi.enable(code);
    setSetup(null);
    setCodes(r.backupCodes);
    await load();
    await refreshSecondFactor();
    toast({ title: 'Two-step sign-in is on', description: 'New sign-ins will ask for a code from your app.' });
  });

  const disable = () => run(async () => {
    await mfaApi.disable(code);
    setMode('idle'); setCodes(null);
    await load();
    await refreshSecondFactor();
    toast({ title: 'Two-step sign-in is off' });
  });

  const regen = () => run(async () => {
    const r = await mfaApi.newBackupCodes(code);
    setMode('idle'); setCodes(r.backupCodes);
    await load();
  });

  if (!status) return <div className={card}><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;

  return (
    <div className={card}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${status.enabled ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
          {status.enabled ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Two-step sign-in {status.enabled ? 'is on' : 'is off'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {status.enabled
              ? `Each new sign-in asks for a code from your authenticator app. ${status.backupCodesLeft} backup code${status.backupCodesLeft === 1 ? '' : 's'} left.`
              : 'Ask for a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) when someone signs in to this account.'}
          </p>
        </div>
      </div>

      {!status.enabled && !setup && (
        <Button size="sm" className="h-8 text-xs" onClick={start} disabled={busy}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Turn on'}
        </Button>
      )}

      {setup && (
        <div className="grid sm:grid-cols-[auto,1fr] gap-4 items-start animate-in fade-in slide-in-from-bottom-1 duration-300">
          <img src={setup.qr} alt="QR code for your authenticator app" width={160} height={160} className="rounded-lg bg-white p-1.5" />
          <div className="space-y-2 min-w-0">
            <p className="text-xs text-muted-foreground">1. Scan this with your authenticator app. Can&apos;t scan? Type this key:</p>
            <code className="block text-xs font-mono break-all bg-secondary/60 rounded-md px-2 py-1.5 select-all">{setup.secret.match(/.{1,4}/g)!.join(' ')}</code>
            <p className="text-xs text-muted-foreground">2. Enter the 6-digit code it shows:</p>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code"
                placeholder="123456" aria-label="Code from your app" className="h-9 w-32 font-mono tracking-widest bg-secondary/50" />
              <Button size="sm" className="h-9 text-xs" onClick={enable} disabled={code.length !== 6 || busy}>
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
              </Button>
              <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => setSetup(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {codes && <BackupCodes codes={codes} />}

      {status.enabled && mode === 'idle' && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setMode('regen')}>New backup codes</Button>
          <Button size="sm" variant="outline" className="h-8 text-xs hover:text-destructive" onClick={() => setMode('disable')}>Turn off</Button>
        </div>
      )}
      {status.enabled && mode !== 'idle' && (
        <div className="flex gap-2 items-center animate-in fade-in duration-200">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={mode === 'disable' ? 'Code or backup code' : 'Code from your app'} aria-label="Confirmation code"
            className="h-9 w-48 font-mono bg-secondary/50" autoFocus />
          <Button size="sm" className="h-9 text-xs" variant={mode === 'disable' ? 'destructive' : 'default'} onClick={mode === 'disable' ? disable : regen} disabled={!code || busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : mode === 'disable' ? 'Turn off' : 'Make new codes'}
          </Button>
          <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => { setMode('idle'); setCode(''); }}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

/** Settings → Security: make or replace the Recovery Kit. */
export function RecoveryKitSettings() {
  const { hasRecoveryKit, createRecoveryKit } = useVault();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  const make = async () => {
    setBusy(true);
    try {
      await createRecoveryKit(pw);
      setOpen(false); setPw('');
    } catch (e) {
      const wrong = e instanceof Error && e.name === 'WrongPasswordError';
      toast({ title: wrong ? 'That master password is not right' : 'Could not make the Recovery Kit', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <div className={card}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${hasRecoveryKit ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
          <KeyRound className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Recovery Kit {hasRecoveryKit ? 'is set up' : 'is not set up'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasRecoveryKit
              ? 'If you forget your master password, its recovery key gets you back in. Lost the kit? Make a new one: the old key stops working.'
              : 'Without it, a forgotten master password means the vault is gone for good. Make one now and keep it offline.'}
          </p>
        </div>
      </div>
      {open ? (
        <div className="flex gap-2 items-center animate-in fade-in duration-200">
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Master password" aria-label="Master password"
            autoComplete="current-password" className="h-9 flex-1 bg-secondary/50" autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && pw) void make(); }} />
          <Button size="sm" className="h-9 text-xs" onClick={make} disabled={!pw || busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : hasRecoveryKit ? 'Make new kit' : 'Make kit'}
          </Button>
          <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => { setOpen(false); setPw(''); }}>Cancel</Button>
        </div>
      ) : (
        <Button size="sm" variant={hasRecoveryKit ? 'outline' : 'default'} className="h-8 text-xs" onClick={() => setOpen(true)}>
          {hasRecoveryKit ? 'Replace Recovery Kit' : 'Make my Recovery Kit'}
        </Button>
      )}
    </div>
  );
}

/** Settings → Security: Windows Hello / Touch ID / fingerprint on this device. */
export function DeviceUnlockSettings() {
  const { getKeyHeader } = useVault();
  const { user } = useAuth();
  const { toast } = useToast();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [info, setInfo] = useState(() => (typeof window !== 'undefined' ? deviceUnlockInfo(user?.id ?? null) : null));
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { void deviceUnlockSupported().then(setSupported); }, []);

  const enable = async () => {
    const header = getKeyHeader();
    if (!header || !user) return;
    setBusy(true);
    try {
      const label = await setUpDeviceUnlock({ uid: user.id, email: user.email, password: pw, header });
      setInfo(deviceUnlockInfo(user.id));
      setOpen(false); setPw('');
      toast({ title: `${label} is set up`, description: 'Next time, unlock with one touch instead of typing.' });
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      toast({
        title: name === 'WrongPasswordError' ? 'That master password is not right' : name === 'NotAllowedError' ? 'Cancelled' : 'Could not set it up',
        description: name === 'WrongPasswordError' || name === 'NotAllowedError' ? undefined : e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally { setBusy(false); }
  };

  return (
    <div className={card}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${info ? 'bg-green-500/15 text-green-400' : 'bg-primary/15 text-primary'}`}>
          <Fingerprint className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{info ? `Unlock with ${info.label} is on` : 'Unlock with Windows Hello or fingerprint'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {info
              ? 'On this device you can unlock with your PIN, fingerprint or face instead of the master password.'
              : supported === false
                ? 'This browser or device has no Windows Hello, Touch ID or fingerprint available.'
                : 'Use your Windows PIN, fingerprint or face to unlock on this device. Your master password still works everywhere.'}
          </p>
        </div>
      </div>
      {info ? (
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { removeDeviceUnlock(); setInfo(null); toast({ title: 'Removed from this device' }); }}>Remove from this device</Button>
      ) : supported !== false && (open ? (
        <div className="flex gap-2 items-center animate-in fade-in duration-200">
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Master password" aria-label="Master password"
            autoComplete="current-password" className="h-9 flex-1 bg-secondary/50" autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && pw) void enable(); }} />
          <Button size="sm" className="h-9 text-xs" onClick={enable} disabled={!pw || busy}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Set up'}</Button>
          <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => { setOpen(false); setPw(''); }}>Cancel</Button>
        </div>
      ) : (
        <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(true)} disabled={supported === null}>Set up</Button>
      ))}
    </div>
  );
}

// ── Recent security activity ────────────────────────────────────────────────

interface ActivityRow { id: string; at: string; type: string; label: string; severity: string; ip?: string; country?: string; device?: string }

/** Your last sign-ins and security changes, so you can spot anything you didn't do. */
export function SecurityActivity() {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const { AuthService } = await import('@/lib/auth');
        const token = await AuthService.getIdToken();
        const res = await fetch('/api/account/security-events', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not load');
        setRows(data.events ?? []);
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not load'); }
    })();
  }, []);
  if (error) return <p className="text-sm text-muted-foreground">Recent activity isn&apos;t available right now.</p>;
  if (!rows) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>;
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nothing yet. Sign-ins and security changes will show here.</p>;
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
        {rows.slice(0, 12).map((r) => (
          <li key={r.id} className="flex items-start gap-3 px-3.5 py-2.5 bg-secondary/20">
            <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${r.severity === 'critical' ? 'bg-red-400' : r.severity === 'warning' ? 'bg-amber-300' : 'bg-emerald-400'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{r.label}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{new Date(r.at).toLocaleString()} · {r.device ?? 'Unknown device'} · {r.ip ?? '—'}{r.country ? ` (${r.country})` : ''}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Don&apos;t recognise something? Sign out other devices under Devices and change your account password. You&apos;re emailed when a new device signs in.</p>
    </div>
  );
}
