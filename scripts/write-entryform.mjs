import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const entryForm = `'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { PasswordEntry } from '@/types/vault';
import { CryptoService } from '@/lib/crypto';
import { useVault } from '@/contexts/VaultContext';
import { Eye, EyeOff, RefreshCw, Copy, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface EntryFormProps {
  entry?: PasswordEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_CATEGORIES = ['Social Media', 'Email', 'Banking', 'Shopping', 'Work', 'Entertainment', 'Other'];

const emptyForm = { website: '', url: '', username: '', password: '', notes: '', category: 'Other' };

export function EntryForm({ entry, open, onOpenChange }: EntryFormProps) {
  const [formData, setFormData] = useState({ ...emptyForm });
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { addEntry, updateEntry, getCategories } = useVault();
  const { toast } = useToast();

  const isEditing = !!entry;
  const passwordStrength = CryptoService.checkPasswordStrength(formData.password);
  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...getCategories()])).sort();

  useEffect(() => {
    if (open) {
      setFormData(entry ? {
        website: entry.website,
        url: entry.url || '',
        username: entry.username,
        password: entry.password,
        notes: entry.notes || '',
        category: entry.category,
      } : { ...emptyForm });
      setShowPassword(false);
    }
  }, [open, entry]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.website.trim() || !formData.username.trim() || !formData.password.trim()) {
      toast({ title: 'Missing required fields', description: 'Website, username, and password are required.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      if (isEditing) {
        await updateEntry(entry.id, formData);
        toast({ title: 'Entry updated' });
      } else {
        await addEntry(formData);
        toast({ title: 'Entry added', description: 'Saved to your encrypted vault.' });
      }
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = () => {
    const pw = CryptoService.generatePassword(20, true);
    setFormData(prev => ({ ...prev, password: pw }));
    setShowPassword(true);
  };

  const handleCopy = async () => {
    if (!formData.password) return;
    try {
      await navigator.clipboard.writeText(formData.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Password copied' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden border-border bg-[hsl(222_40%_8%)]">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-lg font-semibold">
            {isEditing ? 'Edit entry' : 'Add new entry'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ef-website" className="text-sm font-medium">Website <span className="text-destructive">*</span></Label>
              <Input
                id="ef-website"
                value={formData.website}
                onChange={set('website')}
                placeholder="Google, GitHub..."
                className="h-10 bg-secondary/50 border-border/60 focus:border-primary"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef-category" className="text-sm font-medium">Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}>
                <SelectTrigger id="ef-category" className="h-10 bg-secondary/50 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ef-url" className="text-sm font-medium">URL <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
            <Input
              id="ef-url"
              type="url"
              value={formData.url}
              onChange={set('url')}
              placeholder="https://example.com"
              className="h-10 bg-secondary/50 border-border/60 focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ef-username" className="text-sm font-medium">Username / Email <span className="text-destructive">*</span></Label>
            <Input
              id="ef-username"
              value={formData.username}
              onChange={set('username')}
              placeholder="your@email.com"
              className="h-10 bg-secondary/50 border-border/60 focus:border-primary"
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ef-password" className="text-sm font-medium">Password <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="ef-password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={set('password')}
                  placeholder="Enter or generate a password"
                  className="h-10 pr-20 bg-secondary/50 border-border/60 focus:border-primary font-mono text-sm"
                  autoComplete="new-password"
                  required
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!formData.password}
                    className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                    title="Copy password"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                    title={showPassword ? 'Hide' : 'Show'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 px-3 border-border/60 hover:border-primary hover:text-primary"
                onClick={handleGenerate}
                title="Generate password"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Generate
              </Button>
            </div>
            {formData.password && <PasswordStrengthIndicator result={passwordStrength} />}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ef-notes" className="text-sm font-medium">Notes <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
            <Textarea
              id="ef-notes"
              value={formData.notes}
              onChange={set('notes')}
              placeholder="Security questions, backup codes, notes..."
              rows={2}
              className="bg-secondary/50 border-border/60 focus:border-primary text-sm resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 bg-primary hover:bg-primary/90 font-semibold min-w-[120px]"
              disabled={isLoading}
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : isEditing ? 'Save changes' : 'Add entry'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
`;

writeFileSync(join(root, 'src/components/EntryForm.tsx'), entryForm, 'utf8');
console.log('EntryForm written:', entryForm.split('\n').length, 'lines');
