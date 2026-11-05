'use client';

import { useCallback, useEffect, useState } from 'react';
import { VenetianMask, Loader2, Copy, Check, Trash2, Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api-client';

interface Mask { id: string; address: string; forwardTo: string; usedFor: string; enabled: boolean; createdAt: string }
interface MaskData { configured: boolean; domain: string | null; forwardTo: string; max: number; masks: Mask[] }

/** Email masks: addresses you give to sites instead of your real one; mail is forwarded to you. */
export function EmailMasking() {
  const { toast } = useToast();
  const [data, setData] = useState<MaskData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [usedFor, setUsedFor] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Mask | null>(null);

  const load = useCallback(async () => {
    try { setData(await api<MaskData>('/api/masks')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (key: string, body: Record<string, unknown>, done: (r: { mask?: Mask }) => void) => {
    setBusy(key);
    try { done(await api<{ mask?: Mask }>('/api/masks', body)); }
    catch (e) { toast({ title: e instanceof Error ? e.message : 'That didn\'t work', variant: 'destructive' }); }
    setBusy(null);
  };
  const put = (m: Mask) => setData((d) => d && ({ ...d, masks: d.masks.some((x) => x.id === m.id) ? d.masks.map((x) => (x.id === m.id ? m : x)) : [m, ...d.masks] }));

  const copy = async (m: Mask) => {
    try { await navigator.clipboard.writeText(m.address); setCopied(m.id); setTimeout(() => setCopied(null), 1500); }
    catch { toast({ title: 'Copy failed', variant: 'destructive' }); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2.5"><VenetianMask className="w-6 h-6 text-primary" />Email masking</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Sign up to sites with a mask instead of your real address. Mail sent to the mask reaches you; if a site leaks it or sends spam, switch the mask off.
          </p>
          {data && <p className="text-sm mt-2">Forwarding address: <span className="font-medium">{data.forwardTo}</span></p>}
        </div>
      </div>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {!data && !error && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>}

      {data && !data.configured && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 px-5 py-4 text-sm">
          <p className="font-medium text-amber-200">Email masking isn&apos;t switched on for this server yet.</p>
          <p className="text-muted-foreground mt-1">An administrator needs to add the mask domain to the mail server and set MAILCOW_URL, MAILCOW_API_KEY and MASK_DOMAIN. Your masks will appear here once it&apos;s on.</p>
        </div>
      )}

      {data?.configured && (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void run('create', { action: 'create', usedFor }, (r) => { if (r.mask) { put(r.mask); setUsedFor(''); void copy(r.mask); toast({ title: 'Mask created and copied', description: r.mask.address }); } }); }}>
          <Input value={usedFor} onChange={(e) => setUsedFor(e.target.value)} placeholder="What it's for (optional), e.g. Newsletter sign-ups" className="h-11 flex-1 min-w-[220px]" maxLength={120} />
          <Button type="submit" className="h-11 px-5" disabled={!!busy || data.masks.length >= data.max}>
            {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1.5" />Create mask</>}
          </Button>
        </form>
      )}

      {data && data.masks.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_auto] gap-4 px-4 py-2.5 text-xs font-medium text-muted-foreground border-b border-border/60">
            <span>Email mask</span><span>Used for</span><span className="w-[148px] text-right">On / off</span>
          </div>
          <ul className="divide-y divide-border/50">
            {data.masks.map((m) => (
              <li key={m.id} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 sm:gap-4 items-center px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${m.enabled ? 'bg-lime-400/15 text-lime-300' : 'bg-secondary text-muted-foreground'}`}><VenetianMask className="w-[18px] h-[18px]" /></span>
                  <span className={`truncate font-medium ${m.enabled ? '' : 'text-muted-foreground line-through'}`}>{m.address}</span>
                </div>
                <div className="min-w-0">
                  {editing === m.id ? (
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(`edit:${m.id}`, { action: 'update', id: m.id, usedFor: editText }, (r) => { if (r.mask) put(r.mask); setEditing(null); }); }}>
                      <Input value={editText} onChange={(e) => setEditText(e.target.value)} className="h-9" autoFocus maxLength={120} />
                      <Button type="submit" size="sm" className="h-9">Save</Button>
                    </form>
                  ) : (
                    <button className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground max-w-full" onClick={() => { setEditing(m.id); setEditText(m.usedFor); }}>
                      <span className="truncate">{m.usedFor || 'Not set'}</span><Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 sm:justify-end">
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => copy(m)} aria-label={`Copy ${m.address}`}>
                    {copied === m.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Switch checked={m.enabled} disabled={!!busy} aria-label={m.enabled ? 'Switch mask off' : 'Switch mask on'}
                    onCheckedChange={(on) => run(`tog:${m.id}`, { action: 'update', id: m.id, enabled: on }, (r) => { if (r.mask) put(r.mask); toast({ title: on ? 'Mask on: mail is forwarded again' : 'Mask off: mail to it is refused' }); })} />
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive" onClick={() => setRemoving(m)} aria-label={`Delete ${m.address}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data?.configured && data.masks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <VenetianMask className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="mt-3 font-medium">No masks yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create one and use it the next time a site asks for your email.</p>
        </div>
      )}

      <AlertDialog open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this mask?</AlertDialogTitle>
            <AlertDialogDescription>Mail sent to <strong>{removing?.address}</strong> will no longer reach you, and the address can&apos;t be brought back. To pause it instead, switch it off.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => removing && run(`del:${removing.id}`, { action: 'delete', id: removing.id }, () => { setData((d) => d && ({ ...d, masks: d.masks.filter((x) => x.id !== removing.id) })); setRemoving(null); })}>Delete mask</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
