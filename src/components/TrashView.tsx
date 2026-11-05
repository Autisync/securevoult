'use client';

import { useState } from 'react';
import { Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useVault } from '@/contexts/VaultContext';
import { useToast } from '@/components/ui/use-toast';
import { ITEM_TYPE, typeOf } from '@/lib/item-types';
import { KEEP_TRASH_MS } from '@/lib/vault-merge';

/** Deleted items: restore them, or delete them for good. */
export function TrashView() {
  const { vault, restoreEntry, purgeEntries } = useVault();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ ids: string[]; label: string } | null>(null);

  const trash = [...(vault?.trash ?? [])].sort((a, b) => new Date(b.trashedAt).getTime() - new Date(a.trashedAt).getTime());
  const daysLeft = (at: string) => Math.max(0, Math.ceil((new Date(at).getTime() + KEEP_TRASH_MS - Date.now()) / 86400000));

  const restore = async (id: string, name: string) => {
    setBusy(id);
    try { await restoreEntry(id); toast({ title: `${name} restored` }); }
    catch { toast({ title: 'Restore failed', variant: 'destructive' }); }
    setBusy(null);
  };

  const purge = async (ids: string[]) => {
    setBusy(ids.length > 1 ? 'all' : ids[0]);
    try { await purgeEntries(ids); toast({ title: ids.length > 1 ? 'Trash emptied' : 'Deleted for good' }); }
    catch { toast({ title: 'Delete failed', variant: 'destructive' }); }
    setBusy(null);
    setConfirm(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
          <p className="text-sm text-muted-foreground mt-1">Deleted items stay here for 30 days, on all your devices. Restore one, or delete it for good.</p>
        </div>
        {trash.length > 0 && (
          <Button variant="outline" className="h-10 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirm({ ids: trash.map((t) => t.entry.id), label: `all ${trash.length} items` })} disabled={!!busy}>
            <Trash2 className="w-4 h-4 mr-2" />Empty Trash
          </Button>
        )}
      </div>

      {trash.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Trash2 className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="mt-3 font-medium">Trash is empty</p>
          <p className="text-sm text-muted-foreground mt-1">Items you delete appear here for 30 days.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden">
          {trash.map(({ entry, trashedAt }) => {
            const info = ITEM_TYPE[typeOf(entry)];
            const Icon = info.icon;
            const left = daysLeft(trashedAt);
            return (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 ${info.color}`}><Icon className="w-5 h-5" /></span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{entry.website || 'Untitled'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {info.label}{entry.username ? ` · ${entry.username}` : ''} · deleted {new Date(trashedAt).toLocaleDateString()} · {left === 0 ? 'goes today' : `${left} day${left === 1 ? '' : 's'} left`}
                  </p>
                </div>
                <Button size="sm" variant="secondary" className="h-9" disabled={!!busy} onClick={() => restore(entry.id, entry.website || 'Item')}>
                  {busy === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4 mr-1.5" />Restore</>}
                </Button>
                <Button size="sm" variant="ghost" className="h-9 text-muted-foreground hover:text-destructive" disabled={!!busy}
                  onClick={() => setConfirm({ ids: [entry.id], label: entry.website || 'this item' })} aria-label={`Delete ${entry.website} for good`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete for good?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes <strong>{confirm?.label}</strong> and any attached files on all your devices. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => confirm && purge(confirm.ids)}>Delete for good</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
