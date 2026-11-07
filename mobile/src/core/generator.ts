/** Password and passphrase generator, using the vault core's secure random source. */
import { randomBytes } from './vault-crypto';

export interface GeneratorOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  /** Leave out characters that are easy to confuse: 0 O o 1 l I. */
  avoidAmbiguous: boolean;
}

export const DEFAULT_GENERATOR: GeneratorOptions = {
  length: 20, upper: true, lower: true, digits: true, symbols: true, avoidAmbiguous: true,
};

const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
};
const AMBIGUOUS = /[0Oo1lI]/g;

/** Uniform index below `max` (rejection sampling, no modulo bias). */
function randomIndex(max: number): number {
  const limit = 256 - (256 % max);
  for (;;) {
    const b = randomBytes(1)[0];
    if (b < limit) return b % max;
  }
}

export function generatePassword(opts: GeneratorOptions): string {
  const groups = (['upper', 'lower', 'digits', 'symbols'] as const)
    .filter((k) => opts[k])
    .map((k) => (opts.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]));
  if (!groups.length) groups.push(SETS.lower);
  const all = groups.join('');
  const length = Math.max(groups.length, Math.min(128, Math.round(opts.length)));
  // One from each chosen group, the rest from all of them, then shuffled.
  const chars = groups.map((g) => g[randomIndex(g.length)]);
  while (chars.length < length) chars.push(all[randomIndex(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export type Strength = 'weak' | 'fair' | 'good' | 'strong';

/** Rough strength from length and character variety (same bands as the web app's indicator). */
export function strengthOf(pw: string): { strength: Strength; score: number } {
  if (!pw) return { strength: 'weak', score: 0 };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw)) pool += 30;
  const bits = pw.length * Math.log2(Math.max(pool, 2));
  const repeats = /(.)\1{2,}/.test(pw) || /^(?:password|123456|qwerty)/i.test(pw);
  const effective = repeats ? bits * 0.6 : bits;
  const strength: Strength = effective >= 90 ? 'strong' : effective >= 65 ? 'good' : effective >= 45 ? 'fair' : 'weak';
  return { strength, score: Math.min(100, Math.round((effective / 100) * 100)) };
}
