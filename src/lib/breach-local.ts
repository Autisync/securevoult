/**
 * Free breach monitoring — heuristic and local analysis.
 *
 * Works without any paid API keys. Provides:
 *  - Weak password detection (strength scoring)
 *  - Password reuse detection across vault entries
 *  - Common/dictionary password matching
 *  - Predictable pattern detection
 *  - Risky email domain detection (disposable / known-breached)
 *
 * Naming guidance: never claim "dark web search" for heuristics.
 * Use "Exposure Intelligence" / "Security Insights" wording instead.
 */

// ── Password strength ────────────────────────────────────────────────────────

export type StrengthLevel = 'critical' | 'weak' | 'fair' | 'strong' | 'very_strong';

export interface PasswordStrengthResult {
  score: number;          // 0–100
  level: StrengthLevel;
  issues: string[];
  suggestions: string[];
}

export function analysePasswordStrength(password: string): PasswordStrengthResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  if (!password) return { score: 0, level: 'critical', issues: ['No password set'], suggestions: [] };

  // Length scoring
  const len = password.length;
  if (len < 8)       { issues.push('Too short (minimum 8 characters)'); suggestions.push('Use at least 12 characters'); }
  else if (len < 12) { score += 20; suggestions.push('Increase to 16+ characters for better security'); }
  else if (len < 16) { score += 35; }
  else if (len < 20) { score += 45; }
  else               { score += 55; }

  // Character set scoring
  const hasLower  = /[a-z]/.test(password);
  const hasUpper  = /[A-Z]/.test(password);
  const hasDigit  = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  if (!hasLower)  { issues.push('No lowercase letters'); }    else { score += 8; }
  if (!hasUpper)  { issues.push('No uppercase letters'); suggestions.push('Add uppercase letters'); } else { score += 8; }
  if (!hasDigit)  { issues.push('No numbers'); suggestions.push('Include numbers'); }              else { score += 8; }
  if (!hasSymbol) { suggestions.push('Add symbols (!@#$...) for extra strength'); }               else { score += 12; }

  // Penalty for common patterns
  if (isCommonPassword(password)) {
    score = Math.min(score, 15);
    issues.push('This is a commonly used password');
  }
  if (isPredictablePattern(password)) {
    score = Math.max(0, score - 20);
    issues.push('Contains predictable pattern (e.g. abc123, qwerty)');
    suggestions.push('Avoid keyboard patterns and sequences');
  }
  if (hasDictionaryWord(password)) {
    score = Math.max(0, score - 10);
    issues.push('Contains common dictionary word');
    suggestions.push('Avoid real words or use a passphrase with random words');
  }

  // Entropy bonus for uniqueness
  const uniqueChars = new Set(password).size;
  const entropyBonus = Math.min(9, Math.floor((uniqueChars / len) * 15));
  score = Math.min(100, score + entropyBonus);

  let level: StrengthLevel;
  if (score < 20)      level = 'critical';
  else if (score < 40) level = 'weak';
  else if (score < 60) level = 'fair';
  else if (score < 80) level = 'strong';
  else                 level = 'very_strong';

  return { score, level, issues, suggestions };
}

// ── Reuse detection ──────────────────────────────────────────────────────────

export interface ReuseGroup {
  /** SHA-256 prefix (first 8 chars) — never the full hash */
  hashPrefix: string;
  /** Entry IDs that share this password */
  entryIds: string[];
  /** Entry labels for display */
  labels: string[];
}

export async function detectPasswordReuse(
  entries: Array<{ id: string; label: string; password: string }>
): Promise<ReuseGroup[]> {
  const hashMap = new Map<string, { entryIds: string[]; labels: string[] }>();

  for (const entry of entries) {
    if (!entry.password) continue;
    const hash = await sha256Hex(entry.password);
    const key = hash; // full hash used only locally, never sent externally
    if (!hashMap.has(key)) hashMap.set(key, { entryIds: [], labels: [] });
    hashMap.get(key)!.entryIds.push(entry.id);
    hashMap.get(key)!.labels.push(entry.label);
  }

  const groups: ReuseGroup[] = [];
  Array.from(hashMap.entries()).forEach(([hash, group]) => {
    if (group.entryIds.length > 1) {
      groups.push({
        hashPrefix: hash.slice(0, 8),
        entryIds:   group.entryIds,
        labels:     group.labels,
      });
    }
  });
  return groups;
}

// ── Email risk heuristics ────────────────────────────────────────────────────

export interface EmailRiskResult {
  email: string;
  isDisposable: boolean;
  isHighRiskDomain: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  dataSource: 'local_heuristic';
}

/** Check an email address for risk signals using local heuristics only. */
export function analyseEmailRisk(email: string): EmailRiskResult {
  const reasons: string[] = [];
  const lower = email.toLowerCase();
  const domain = lower.split('@')[1] ?? '';

  const isDisposable = DISPOSABLE_DOMAINS.has(domain);
  const isHighRisk   = HIGH_RISK_DOMAINS.has(domain);

  if (isDisposable) reasons.push('Disposable/temporary email provider');
  if (isHighRisk)   reasons.push('Domain associated with credential exposure');

  // Generic suspicious patterns
  if (/^\d+@/.test(lower))           reasons.push('Username is all numbers (common spam pattern)');
  if (email.length > 100)             reasons.push('Unusually long email address');
  if (/[+].*@/.test(lower))           reasons.push('Contains plus-addressing (may indicate alias)');

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (isDisposable || isHighRisk)    riskLevel = 'high';
  else if (reasons.length > 0)       riskLevel = 'medium';

  return { email, isDisposable, isHighRiskDomain: isHighRisk, riskLevel, reasons, dataSource: 'local_heuristic' };
}

// ── Comprehensive vault security report ──────────────────────────────────────

export interface VaultSecurityFinding {
  entryId: string;
  entryLabel: string;
  type: 'weak_password' | 'reused_password' | 'predictable_pattern' | 'common_password' | 'risky_email';
  severity: 'critical' | 'high' | 'medium' | 'low';
  detail: string;
  score: number;
  dataSource: 'local_analysis' | 'local_heuristic' | 'hibp_kanonymity';
  confidence: 'high' | 'medium' | 'low';
}

export interface VaultSecurityReport {
  generatedAt: Date;
  totalEntries: number;
  findings: VaultSecurityFinding[];
  reuseGroups: ReuseGroup[];
  overallScore: number; // 0–100 (higher = safer)
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    reuseCount: number;
    weakCount: number;
    risky: number;
  };
}

export async function generateLocalSecurityReport(
  entries: Array<{ id: string; label: string; password?: string; username?: string }>
): Promise<VaultSecurityReport> {
  const findings: VaultSecurityFinding[] = [];

  // Password analysis
  const passwordEntries = entries.filter(e => e.password);

  for (const entry of passwordEntries) {
    const strength = analysePasswordStrength(entry.password!);

    if (strength.level === 'critical' || strength.level === 'weak') {
      findings.push({
        entryId:    entry.id,
        entryLabel: entry.label,
        type:       'weak_password',
        severity:   strength.level === 'critical' ? 'critical' : 'high',
        detail:     strength.issues.join('; '),
        score:      strength.score,
        dataSource: 'local_analysis',
        confidence: 'high',
      });
    } else if (strength.level === 'fair') {
      findings.push({
        entryId:    entry.id,
        entryLabel: entry.label,
        type:       'weak_password',
        severity:   'medium',
        detail:     `Fair strength (score ${strength.score}/100). ${strength.suggestions[0] ?? ''}`,
        score:      strength.score,
        dataSource: 'local_analysis',
        confidence: 'high',
      });
    }

    if (isCommonPassword(entry.password!)) {
      findings.push({
        entryId:    entry.id,
        entryLabel: entry.label,
        type:       'common_password',
        severity:   'critical',
        detail:     'This password appears on commonly used passwords lists and is trivially guessable.',
        score:      0,
        dataSource: 'local_analysis',
        confidence: 'high',
      });
    }

    if (isPredictablePattern(entry.password!)) {
      findings.push({
        entryId:    entry.id,
        entryLabel: entry.label,
        type:       'predictable_pattern',
        severity:   'high',
        detail:     'Contains a predictable keyboard pattern or sequence (e.g. qwerty, abc123, 12345678).',
        score:      10,
        dataSource: 'local_analysis',
        confidence: 'medium',
      });
    }
  }

  // Reuse detection
  const reuseGroups = await detectPasswordReuse(
    passwordEntries.map(e => ({ id: e.id, label: e.label, password: e.password! }))
  );
  for (const group of reuseGroups) {
    for (let i = 0; i < group.entryIds.length; i++) {
      findings.push({
        entryId:    group.entryIds[i],
        entryLabel: group.labels[i],
        type:       'reused_password',
        severity:   'high',
        detail:     `Password reused across ${group.entryIds.length} accounts: ${group.labels.join(', ')}`,
        score:      20,
        dataSource: 'local_analysis',
        confidence: 'high',
      });
    }
  }

  const summary = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high:     findings.filter(f => f.severity === 'high').length,
    medium:   findings.filter(f => f.severity === 'medium').length,
    low:      findings.filter(f => f.severity === 'low').length,
    reuseCount: reuseGroups.length,
    weakCount:  findings.filter(f => f.type === 'weak_password').length,
    risky:      findings.filter(f => f.type === 'risky_email').length,
  };

  // Overall score: start at 100, deduct for findings
  let overallScore = 100;
  overallScore -= summary.critical * 20;
  overallScore -= summary.high * 10;
  overallScore -= summary.medium * 5;
  overallScore -= summary.low * 2;
  overallScore -= reuseGroups.length * 8;
  overallScore = Math.max(0, Math.min(100, overallScore));

  return {
    generatedAt: new Date(),
    totalEntries: entries.length,
    findings,
    reuseGroups,
    overallScore,
    summary,
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

function isPredictablePattern(password: string): boolean {
  const p = password.toLowerCase();
  // Keyboard rows
  if (/qwerty|asdf|zxcv|qazwsx|1qaz|2wsx/.test(p)) return true;
  // Sequences
  if (/0123456|1234567|2345678|3456789|abcdef|fedcba/.test(p)) return true;
  // Repeated chars
  if (/(.)\1{4,}/.test(p)) return true;
  // Year patterns
  if (/19[0-9]{2}|20[0-2][0-9]/.test(p) && password.length <= 8) return true;
  return false;
}

function hasDictionaryWord(password: string): boolean {
  const p = password.toLowerCase().replace(/[^a-z]/g, '');
  return DICTIONARY_WORDS.some(word => p.includes(word) && word.length >= 4);
}

// ── Common passwords list (top 200) ─────────────────────────────────────────
const COMMON_PASSWORDS = new Set([
  'password','123456','password1','12345678','qwerty','abc123','monkey',
  'master','dragon','111111','baseball','iloveyou','trustno1','sunshine',
  'princess','welcome','shadow','superman','michael','football','password123',
  'letmein','696969','charlie','donald','password2','qwerty123','1q2w3e4r',
  '1234','123456789','0987654321','starwars','passw0rd','hello123','admin',
  'login','welcome1','solo','access','batman','master1','pass','hello',
  'nicole','daniel','jessica','ashley','monkey1','hunter','ranger',
  'jordan','harley','password12','robert','thomas','liverpool','chelsea',
  'arsenal','google','internet','iphone','secret','aaaaaa','qwertyuiop',
  'mustang','maverick','cookie','buster','thunder','ranger1','hockey',
  'dallas','yankees','joshua','maggie','parrot','samantha','purple',
  'tigger','cheese','matrix','yankee1','gateway','peanut','change',
  'sparky','marina','cheese1','firefly','happy1','lucky1','summer1',
  'asdfgh','zxcvbn','testing','123qwe','abc1234','pass123','test1234',
]);

// ── Dictionary words commonly in passwords ────────────────────────────────
const DICTIONARY_WORDS = [
  'love','hate','life','game','blue','fire','rock','fish','bird','wolf',
  'bear','lion','star','moon','dark','light','time','name','home','play',
  'work','help','keep','free','fall','walk','girl','boys','king','queen',
  'cool','baby','sexy','cute','dead','kill','evil','good','best','last',
];

// ── Disposable / temporary email domains ─────────────────────────────────────
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','10minutemail.com','tempmail.com',
  'throwam.com','fakeinbox.com','dispostable.com','mailnull.com',
  'spam4.me','trashmail.com','sharklasers.com','guerrillamailblock.com',
  'grr.la','guerrillamail.info','guerrillamail.biz','guerrillamail.de',
  'guerrillamail.net','guerrillamail.org','spam.la','yopmail.com',
  'yopmail.fr','cool.fr.nf','jetable.fr.nf','nospam.ze.tc','nomail.xl.cx',
  'mega.zik.dj','speed.1s.fr','courriel.fr.nf','moncourrier.fr.nf',
  'monemail.fr.nf','monmail.fr.nf','maildrop.cc','mailnesia.com',
  'trashmail.at','trashmail.io','trashmail.me','trashmail.net','trashmail.xyz',
  'mohmal.com','emltmp.com','discard.email','tempr.email','nwytg.com',
  'tmailinator.com','throwam.com',
]);

// ── High-risk domains (known exposure history) ────────────────────────────────
const HIGH_RISK_DOMAINS = new Set([
  'yahoo.com', // large historical breaches
  'aol.com',
  'myspace.com',
  'adobe.com', // 2013 breach
  'linkedin.com', // 2012/2016 breaches
]);
