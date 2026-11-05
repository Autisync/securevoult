'use client';

import { useEffect, useRef, useState } from 'react';
import { useVault } from '@/contexts/VaultContext';
import { useToast } from '@/components/ui/use-toast';
import type { Attachment, PasswordEntry } from '@/types/vault';
import { Download, Eye, FileText, FileImage, File as FileIcon, Loader2, Paperclip, Trash2, Upload, X } from 'lucide-react';

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

const isImage = (a: Attachment) => /^image\/(png|jpe?g|gif|webp|avif|bmp)$/i.test(a.type);
const isPdf = (a: Attachment) => a.type === 'application/pdf';
const iconFor = (a: Attachment) => (isImage(a) ? FileImage : isPdf(a) || a.type.startsWith('text/') ? FileText : FileIcon);

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Files kept with an item: encrypted in this browser before upload. */
export function AttachmentList({ entry, large }: { entry: PasswordEntry; large?: boolean }) {
  const { addAttachment, openAttachment, removeAttachment } = useVault();
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<{ att: Attachment; url: string } | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const files = entry.attachments ?? [];

  // Thumbnails for pictures in the large view (decrypted here, never cached on disk).
  useEffect(() => {
    if (!large) return;
    let cancelled = false;
    const made: string[] = [];
    (async () => {
      for (const f of files.filter(isImage).filter((f) => f.size < 8 * 1024 * 1024)) {
        if (thumbs[f.id]) continue;
        try {
          const url = URL.createObjectURL(await openAttachment(f));
          made.push(url);
          if (cancelled) return;
          setThumbs((t) => ({ ...t, [f.id]: url }));
        } catch { /* shown as an icon instead */ }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [large, files.map((f) => f.id).join()]);

  useEffect(() => () => { Object.values(thumbs).forEach(URL.revokeObjectURL); }, [thumbs]);

  const upload = async (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      setUploading((u) => [...u, file.name]);
      try {
        await addAttachment(entry.id, file);
        toast({ title: `${file.name} added`, description: 'Encrypted on this device before upload.' });
      } catch (e) {
        toast({ title: `Couldn't add ${file.name}`, description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
  };

  const run = async (att: Attachment, what: 'view' | 'save') => {
    setBusy((b) => ({ ...b, [att.id]: true }));
    try {
      const blob = await openAttachment(att);
      if (what === 'save' || !(isImage(att) || isPdf(att))) saveBlob(blob, att.name);
      else setPreview({ att, url: URL.createObjectURL(blob) });
    } catch (e) {
      toast({ title: "Couldn't open the file", description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setBusy((b) => ({ ...b, [att.id]: false }));
    }
  };

  const remove = async (att: Attachment) => {
    setBusy((b) => ({ ...b, [att.id]: true }));
    try { await removeAttachment(entry.id, att.id); toast({ title: `${att.name} removed` }); }
    catch { toast({ title: 'Remove failed', variant: 'destructive' }); setBusy((b) => ({ ...b, [att.id]: false })); }
  };

  const closePreview = () => { if (preview) URL.revokeObjectURL(preview.url); setPreview(null); };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1">
        <Paperclip className="w-3 h-3" />Files{files.length > 0 && <span className="normal-case tracking-normal font-normal">· {files.length}</span>}
      </p>

      <div className={large && files.some(isImage) ? 'grid grid-cols-2 gap-2' : 'space-y-1.5'}>
        {files.map((f) => {
          const Icon = iconFor(f);
          if (large && thumbs[f.id]) {
            return (
              <div key={f.id} className="group relative rounded-xl overflow-hidden border border-border/60 bg-secondary/30 aspect-[4/3] animate-in fade-in zoom-in-95 duration-300">
                <button type="button" onClick={() => run(f, 'view')} className="absolute inset-0" aria-label={`View ${f.name}`}>
                  <img src={thumbs[f.id]} alt={f.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </button>
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent px-2 pt-6 pb-1.5">
                  <span className="flex-1 truncate text-xs text-white">{f.name}</span>
                  <button type="button" onClick={() => run(f, 'save')} className="w-6 h-6 rounded-md text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center" title="Download"><Download className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => remove(f)} className="w-6 h-6 rounded-md text-white/80 hover:text-red-300 hover:bg-white/10 flex items-center justify-center" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          }
          return (
            <div key={f.id} className={`flex items-center gap-2.5 bg-secondary/30 rounded-lg px-3 py-2 animate-in fade-in slide-in-from-bottom-1 duration-200 ${large && files.some(isImage) ? 'col-span-full' : ''}`}>
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatBytes(f.size)}</p>
              </div>
              {busy[f.id] ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
                <>
                  {(isImage(f) || isPdf(f)) && (
                    <button type="button" onClick={() => run(f, 'view')} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80" title="View"><Eye className="w-3.5 h-3.5" /></button>
                  )}
                  <button type="button" onClick={() => run(f, 'save')} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80" title="Download"><Download className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => remove(f)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {uploading.map((n) => (
        <div key={n} className="flex items-center gap-2.5 rounded-lg px-3 py-2 border border-dashed border-primary/40 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" /><span className="truncate">Encrypting and uploading {n}…</span>
        </div>
      ))}

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}
        className={`w-full flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 ${large ? 'py-5' : 'py-2.5'} text-sm transition-colors ${
          dragging ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/50'}`}
      >
        <Upload className="w-4 h-4" />{dragging ? 'Drop to add' : large ? 'Add files or drop them here' : 'Add a file'}
      </button>
      <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ''; }} />
      <p className="text-[11px] text-muted-foreground/70">Up to 25 MB each. Encrypted on this device; Autisync can&apos;t open them.</p>

      {preview && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex flex-col animate-in fade-in duration-200" onClick={closePreview}>
          <div className="flex items-center gap-2 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="flex-1 truncate text-sm">{preview.att.name}</span>
            <a href={preview.url} download={preview.att.name} className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center" title="Download"><Download className="w-4 h-4" /></a>
            <button type="button" onClick={closePreview} className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center" aria-label="Close preview"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            {isPdf(preview.att)
              ? <iframe src={preview.url} title={preview.att.name} className="w-full h-full max-w-4xl rounded-lg bg-white" />
              : <img src={preview.url} alt={preview.att.name} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" />}
          </div>
        </div>
      )}
    </div>
  );
}
