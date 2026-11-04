'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVault } from '@/contexts/VaultContext';
import { useToast } from '@/components/ui/use-toast';
import { CryptoService } from '@/lib/crypto';
import { getVaultPreference } from '@/hooks/useVaultPreferences';
import type { PasswordEntry } from '@/types/vault';
import { Check, Copy, ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react';

export type FixReason = 'breached' | 'weak' | 'reused' | 'old';

const WHY: Record<FixReason, string> = {
  breached: 'This password appears in leaked password lists, so attackers try it first.',
  weak: 'This password is easy to guess.',
  reused: 'This password is used on other sites too. One leak would open all of them.',
  old: 'This password hasn’t changed in a long time.',
};

/** Where the site lets you change the password: the standard /.well-known/change-password address. */
function changePasswordUrl(entry: PasswordEntry): string | null {
  const raw = entry.url || entry.urls?.[0];
  if (!raw) return null;
  try { return new URL('/.well-known/change-password', /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`).href; } catch { return null; }
}

/**
 * Step by step: 1 make a new password, 2 change it on the site, 3 save it here.
 * The old password goes into the item's history, so nothing is lost if the
 * site change didn't go through.
 */
export function FixPasswordDialog({ entry, reason, onClose }: { entry: PasswordEntry | null; reason: FixReason; onClose: () => void }) {
  const { updateEntry } = useVault();
  const { toast } = useToast();
  const [pw, setPw] = useState('');
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);

  const generate = () => setPw(CryptoService.generatePassword(Math.max(16, getVaultPreference('defaultPasswordLength') ?? 20), true, true, true));
  useEffect(() => { if (entry) { generate(); setCopied(false); setOpened(false); } }, [entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!entry) return null;
  const site = changePasswordUrl(entry);

  const copy = async () => {
    try { await navigator.clipboard.writeText(pw); setCopied(true); } catch { /* select it manually */ }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateEntry(entry.id, { password: pw });
      toast({ title: `${entry.website} updated`, description: 'The old password is kept in the item’s history.' });
      onClose();
    } catch {
      toast({ title: 'Could not save', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const step = (n: number, done: boolean, title: string, body: React.ReactNode) => (
    <li className="flex gap-3">
      <span className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold transition-colors ${done ? 'bg-green-500 text-white' : 'bg-secondary text-muted-foreground'}`}>
        {done ? <Check className="w-3.5 h-3.5" /> : n}
      </span>
      <div className="flex-1 min-w-0 space-y-2 pb-1">
        <p className="text-sm font-medium">{title}</p>
        {body}
      </div>
    </li>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[calc(100vw-24px)] sm:max-w-[480px] max-h-[calc(100dvh-24px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-red-400" />Fix {entry.website}</DialogTitle>
          <DialogDescription>{WHY[reason]}</DialogDescription>
        </DialogHeader>
        <ol className="space-y-4 mt-1">
          {step(1, copied, 'Copy a new password', (
            <div className="flex gap-2">
              <Input value={pw} onChange={(e) => { setPw(e.target.value); setCopied(false); }} className="h-9 font-mono text-sm bg-secondary/50" aria-label="New password" />
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => { generate(); setCopied(false); }} title="Another one"><RefreshCw className="w-3.5 h-3.5" /></Button>
              <Button type="button" size="sm" className="h-9 flex-shrink-0" onClick={copy}>{copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}Copy</Button>
            </div>
          ))}
          {step(2, opened, `Change it on ${entry.website}`, (
            <>
              <p className="text-xs text-muted-foreground">Sign in, open the security or password settings, and paste the new password.{entry.username ? ` Your username there: ${entry.username}.` : ''}</p>
              {site ? (
                <a href={site} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                  Open the change-password page <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <p className="text-xs text-amber-400">This item has no web address; go to the site yourself.</p>
              )}
            </>
          ))}
          {step(3, false, 'Save the new password here', (
            <>
              <p className="text-xs text-muted-foreground">Only after the site accepted it. Your old password stays in this item’s history just in case.</p>
              <Button type="button" className="w-full" onClick={save} disabled={!pw || saving}>Save new password</Button>
            </>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
