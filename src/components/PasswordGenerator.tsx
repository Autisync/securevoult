'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { CryptoService } from '@/lib/crypto';
import { useToast } from '@/components/ui/use-toast';
import { Copy, RefreshCw, Check, Wand2 } from 'lucide-react';
import { getVaultPreference } from '@/hooks/useVaultPreferences';

// ── Random password ───────────────────────────────────────────────────────────

interface GenOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

function buildPassword(opts: GenOptions): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const nums = '0123456789';
  const syms = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let charset = '';
  const required: string[] = [];
  if (opts.uppercase) { charset += upper; required.push(upper[Math.floor(Math.random() * upper.length)]); }
  if (opts.lowercase) { charset += lower; required.push(lower[Math.floor(Math.random() * lower.length)]); }
  if (opts.numbers) { charset += nums; required.push(nums[Math.floor(Math.random() * nums.length)]); }
  if (opts.symbols) { charset += syms; required.push(syms[Math.floor(Math.random() * syms.length)]); }
  if (!charset) return '';

  const arr = new Uint32Array(opts.length);
  crypto.getRandomValues(arr);
  const chars = Array.from(arr).map(n => charset[n % charset.length]);
  required.forEach((ch, i) => { chars[i] = ch; });
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// ── Passphrase ────────────────────────────────────────────────────────────────

// ~200-word EFF-inspired word list
const WORDS = [
  'apple','beach','cabin','daisy','eagle','fable','ghost','haven',
  'ivory','jewel','kayak','lemon','maple','noble','ocean','piano',
  'queen','river','stone','tiger','ultra','vapor','wheat','xenon',
  'yacht','zebra','amber','blade','cloud','delta','ember','frost',
  'grace','husky','ideal','joker','kneel','lunar','mango','north',
  'olive','pixel','quest','radar','solar','totem','unite','valor',
  'waltz','xylem','yearn','zonal','aloft','brave','crisp','depth',
  'elite','flare','glyph','hedge','input','joust','knack','light',
  'mirth','noted','orbit','prism','quill','realm','solid','thorn',
  'unify','vivid','wedge','x-ray','yield','zippy','acorn','brisk',
  'chuck','dingo','elfin','flint','grail','hatch','infer','jumbo',
  'knelt','llama','magma','nerve','onset','plank','quirk','roast',
  'snowy','tally','umbra','visor','woken','xenon','yodel','zesty',
  'atlas','blunt','coral','drape','epoch','finch','globe','hippo',
  'igloo','jelly','koala','lodge','mirth','notch','opera','petal',
  'quiet','relay','scout','thick','usher','visit','walrus','xeric',
  'yummy','zippo','alley','boxer','crimp','dunce','extra','fudge',
  'guard','holly','intro','jazzy','knoll','llama','mimic','nudge',
  'onion','pluck','quota','resin','slope','twill','urban','venom',
  'whelp','xylol','yawl','zappy','album','botch','curry','dimly',
  'enact','fizzy','groan','hydra','index','jolly','kilts','lapel',
  'minty','nippy','ozone','plaid','quaff','risky','swamp','tramp',
  'umbra','vogue','wring','xylem','yeoman','zipper',
];

interface PassphraseOptions {
  wordCount: number;
  separator: string;
  capitalize: boolean;
  appendNumber: boolean;
}

function buildPassphrase(opts: PassphraseOptions): string {
  const arr = new Uint32Array(opts.wordCount);
  crypto.getRandomValues(arr);
  let words = Array.from(arr).map(n => {
    const w = WORDS[n % WORDS.length];
    return opts.capitalize ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  });
  let phrase = words.join(opts.separator);
  if (opts.appendNumber) {
    const numArr = new Uint32Array(1);
    crypto.getRandomValues(numArr);
    phrase += opts.separator + (numArr[0] % 90 + 10);
  }
  return phrase;
}

// ── Component ─────────────────────────────────────────────────────────────────

const DEFAULT_PHRASE: PassphraseOptions = { wordCount: 4, separator: '-', capitalize: true, appendNumber: true };

function getDefaultGenOpts(): GenOptions {
  return {
    length:    getVaultPreference('defaultPasswordLength'),
    uppercase: getVaultPreference('defaultUppercase'),
    lowercase: true,
    numbers:   getVaultPreference('defaultNumbers'),
    symbols:   getVaultPreference('defaultSymbols'),
  };
}

export function PasswordGenerator() {
  const [mode, setMode] = useState<'password' | 'passphrase'>('password');
  const [opts, setOpts] = useState<GenOptions>(() => getDefaultGenOpts());
  const [phraseOpts, setPhraseOpts] = useState<PassphraseOptions>(DEFAULT_PHRASE);
  const [password, setPassword] = useState(() => buildPassword(getDefaultGenOpts()));
  const [passphrase, setPassphrase] = useState(() => buildPassphrase(DEFAULT_PHRASE));
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const active = mode === 'password' ? password : passphrase;
  const strength = CryptoService.checkPasswordStrength(active);

  const regenPassword = useCallback((o?: GenOptions) => setPassword(buildPassword(o ?? opts)), [opts]);
  const regenPhrase = useCallback((o?: PassphraseOptions) => setPassphrase(buildPassphrase(o ?? phraseOpts)), [phraseOpts]);

  const updateOpts = (patch: Partial<GenOptions>) => {
    const n = { ...opts, ...patch }; setOpts(n); regenPassword(n);
  };
  const updatePhraseOpts = (patch: Partial<PassphraseOptions>) => {
    const n = { ...phraseOpts, ...patch }; setPhraseOpts(n); regenPhrase(n);
  };

  const handleCopy = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied to clipboard' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-lg space-y-6 animate-fade-up">
      <div>
        <h2 className="text-lg font-semibold">Password generator</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Create strong, unique passwords instantly.</p>
      </div>

      <Tabs value={mode} onValueChange={v => setMode(v as 'password' | 'passphrase')}>
        <TabsList className="bg-secondary/50 h-9">
          <TabsTrigger value="password" className="text-xs h-7">Random password</TabsTrigger>
          <TabsTrigger value="passphrase" className="text-xs h-7">Passphrase</TabsTrigger>
        </TabsList>

        {/* ── Generated output ── */}
        <div className="mt-4 bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className={`text-base break-all select-all text-foreground ${mode === 'password' ? 'font-mono tracking-widest' : 'font-semibold'}`}>
                {active || <span className="text-muted-foreground italic text-sm">Enable at least one option</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => mode === 'password' ? regenPassword() : regenPhrase()} title="Regenerate">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button size="sm" className="h-9 bg-primary hover:bg-primary/90" onClick={handleCopy} disabled={!active}>
                {copied ? <Check className="w-4 h-4 mr-1.5 text-green-300" /> : <Copy className="w-4 h-4 mr-1.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
          {active && <PasswordStrengthIndicator result={strength} />}
        </div>

        {/* ── Password options ── */}
        <TabsContent value="password" className="mt-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Length</Label>
                <span className="text-sm font-mono bg-secondary/60 px-2 py-0.5 rounded">{opts.length}</span>
              </div>
              <Slider min={8} max={64} step={1} value={[opts.length]} onValueChange={([v]) => updateOpts({ length: v })} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>8</span><span>64</span></div>
            </div>
            <div className="h-px bg-border/50" />
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'uppercase', label: 'Uppercase', desc: 'A–Z' },
                { key: 'lowercase', label: 'Lowercase', desc: 'a–z' },
                { key: 'numbers',   label: 'Numbers',   desc: '0–9' },
                { key: 'symbols',   label: 'Symbols',   desc: '!@#$%' },
              ] as const).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between bg-secondary/30 rounded-xl px-3 py-2.5">
                  <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={opts[key]} onCheckedChange={v => updateOpts({ [key]: v })} />
                </div>
              ))}
            </div>
          </div>
          <Button className="w-full h-11 mt-4 bg-primary hover:bg-primary/90 font-semibold" onClick={() => regenPassword()} disabled={!password}>
            <Wand2 className="w-4 h-4 mr-2" />Generate new password
          </Button>
        </TabsContent>

        {/* ── Passphrase options ── */}
        <TabsContent value="passphrase" className="mt-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Passphrases combine random words to create memorable but strong secrets. 4+ words with a number is very strong.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Word count</Label>
                <span className="text-sm font-mono bg-secondary/60 px-2 py-0.5 rounded">{phraseOpts.wordCount}</span>
              </div>
              <Slider min={3} max={8} step={1} value={[phraseOpts.wordCount]} onValueChange={([v]) => updatePhraseOpts({ wordCount: v })} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>3 words</span><span>8 words</span></div>
            </div>
            <div className="h-px bg-border/50" />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Separator</Label>
                <Select value={phraseOpts.separator} onValueChange={v => updatePhraseOpts({ separator: v })}>
                  <SelectTrigger className="h-9 bg-secondary/50 border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-">Hyphen  —  word-word</SelectItem>
                    <SelectItem value=".">Dot  —  word.word</SelectItem>
                    <SelectItem value=" ">Space  —  word word</SelectItem>
                    <SelectItem value="_">Underscore  —  word_word</SelectItem>
                    <SelectItem value="">None  —  wordword</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between bg-secondary/30 rounded-xl px-3 py-2.5">
                <div><p className="text-sm font-medium">Capitalize words</p><p className="text-xs text-muted-foreground">First letter uppercase</p></div>
                <Switch checked={phraseOpts.capitalize} onCheckedChange={v => updatePhraseOpts({ capitalize: v })} />
              </div>
              <div className="flex items-center justify-between bg-secondary/30 rounded-xl px-3 py-2.5">
                <div><p className="text-sm font-medium">Append number</p><p className="text-xs text-muted-foreground">Adds a 2-digit number</p></div>
                <Switch checked={phraseOpts.appendNumber} onCheckedChange={v => updatePhraseOpts({ appendNumber: v })} />
              </div>
            </div>
          </div>
          <Button className="w-full h-11 mt-4 bg-primary hover:bg-primary/90 font-semibold" onClick={() => regenPhrase()}>
            <Wand2 className="w-4 h-4 mr-2" />Generate new passphrase
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
