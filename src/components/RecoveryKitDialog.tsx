'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useVault } from '@/contexts/VaultContext';
import { useAuth } from '@/contexts/AuthContext';
import { generateRecoveryKit } from '@/lib/recovery-kit';
import { Check, Copy, Download, KeyRound } from 'lucide-react';

/** Shows a newly made recovery key once; it can't be shown again afterwards. */
export function RecoveryKitDialog() {
  const { newRecoveryKey, dismissRecoveryKey } = useVault();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  if (!newRecoveryKey) return null;

  const download = () => {
    const html = generateRecoveryKit({ email: user?.email, displayName: user?.displayName, recoveryKey: newRecoveryKey });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `SecureVoult-Recovery-Kit-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(newRecoveryKey); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* select manually */ }
  };

  const done = () => { setSaved(false); setDownloaded(false); dismissRecoveryKey(); };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) done(); }}>
      <DialogContent className="w-[calc(100vw-24px)] sm:max-w-[520px] max-h-[calc(100dvh-24px)] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-2 animate-in zoom-in-50 duration-300">
            <KeyRound className="w-5 h-5" />
          </div>
          <DialogTitle>Save your recovery key</DialogTitle>
          <DialogDescription>
            If you ever forget your master password, this key is the only way back into your vault.
            It is shown once. Autisync can&apos;t see it or send it to you again.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 min-[420px]:grid-cols-4 gap-2 my-2" aria-label="Recovery key">
          {newRecoveryKey.split('-').map((g, i) => (
            <span key={i} style={{ animationDelay: `${i * 40}ms` }}
              className="font-mono font-bold tracking-[0.18em] text-center text-base py-2.5 rounded-lg bg-secondary/70 border border-border/60 animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300 select-all">
              {g}
            </span>
          ))}
        </div>

        <div className="flex flex-col min-[420px]:flex-row gap-2">
          <Button type="button" className="flex-1" onClick={download}>
            {downloaded ? <Check className="w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}Download Recovery Kit
          </Button>
          <Button type="button" variant="outline" onClick={copy}>
            {copied ? <Check className="w-4 h-4 mr-2 text-green-400" /> : <Copy className="w-4 h-4 mr-2" />}Copy
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Print the kit, or keep the file somewhere offline. Don&apos;t save it inside this vault.</p>

        <label className="flex items-center gap-2.5 text-sm cursor-pointer mt-1">
          <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
          I&apos;ve saved my recovery key somewhere safe
        </label>
        <Button type="button" onClick={done} disabled={!saved} variant={saved ? 'default' : 'secondary'}>Done</Button>
        <p className="text-[11px] text-muted-foreground text-center">Closed it too soon? Make a new kit any time: Settings → Security → Recovery Kit.</p>
      </DialogContent>
    </Dialog>
  );
}
