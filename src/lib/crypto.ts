import { PasswordStrength, PasswordStrengthResult } from '@/types/vault';

export class CryptoService {
  private static encoder = new TextEncoder();
  private static decoder = new TextDecoder();

  // Generate a random salt
  static generateSalt(): string {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(salt, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Generate a random IV
  static generateIV(): string {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return Array.from(iv, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Derive key from password using PBKDF2
  static async deriveKey(password: string, salt: string): Promise<CryptoKey> {
    const passwordBuffer = this.encoder.encode(password);
    const saltBuffer = new Uint8Array(salt.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt data
  static async encrypt(data: string, password: string): Promise<{ encrypted: string; salt: string; iv: string }> {
    const salt = this.generateSalt();
    const iv = this.generateIV();
    const key = await this.deriveKey(password, salt);

    const dataBuffer = this.encoder.encode(data);
    const ivBuffer = new Uint8Array(iv.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      key,
      dataBuffer
    );

    const encrypted = Array.from(new Uint8Array(encryptedBuffer), byte => 
      byte.toString(16).padStart(2, '0')
    ).join('');

    return { encrypted, salt, iv };
  }

  // Decrypt data
  static async decrypt(encrypted: string, salt: string, iv: string, password: string): Promise<string> {
    const key = await this.deriveKey(password, salt);
    
    const encryptedBuffer = new Uint8Array(encrypted.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
    const ivBuffer = new Uint8Array(iv.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      key,
      encryptedBuffer
    );

    return this.decoder.decode(decryptedBuffer);
  }

  // Generate secure password
  static generatePassword(
    length: number = 16,
    includeUppercase: boolean = true,
    includeNumbers: boolean = true,
    includeSymbols: boolean = true,
  ): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let charset = lowercase;
    if (includeUppercase) charset += uppercase;
    if (includeNumbers) charset += numbers;
    if (includeSymbols) charset += symbols;
    // Fallback so charset is never empty
    if (charset.length === 0) charset = lowercase + numbers;

    // Unbiased: draw 32-bit values and reject the top slice that would favour
    // early characters. Every chosen character class appears at least once.
    const randInt = (max: number): number => {
      const limit = Math.floor(0x100000000 / max) * max;
      const buf = new Uint32Array(1);
      for (;;) {
        crypto.getRandomValues(buf);
        if (buf[0] < limit) return buf[0] % max;
      }
    };
    const pick = (set: string): string => set[randInt(set.length)];
    const required = [lowercase, includeUppercase && uppercase, includeNumbers && numbers, includeSymbols && symbols]
      .filter((x): x is string => !!x);
    const n = Math.max(length, required.length);
    const chars = Array.from({ length: n }, (_, i) => (i < required.length ? pick(required[i]) : pick(charset)));
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  /**
   * Password strength. Length and variety earn points; the patterns people
   * really use (a word plus a year or "!", keyboard runs, common passwords,
   * repeats) cap it, so "Password1!" counts as weak, as other managers rate it.
   */
  static checkPasswordStrength(password: string): PasswordStrengthResult {
    const feedback: string[] = [];
    let score = 0;
    const pw = password ?? '';
    const lower = pw.toLowerCase();

    if (pw.length >= 16) score += 3;
    else if (pw.length >= 12) score += 2;
    else if (pw.length >= 8) score += 1;
    else feedback.push('Use at least 12 characters');

    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length;
    score += classes;
    if (!/[A-Z]/.test(pw)) feedback.push('Include uppercase letters');
    if (!/\d/.test(pw)) feedback.push('Include numbers');
    if (!/[^a-zA-Z0-9]/.test(pw)) feedback.push('Include special characters');

    // Patterns that make a password easy to guess, whatever its length.
    const common = COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(lower.replace(/[\d!@#$%^&*?._-]+$/, ''));
    const wordThenDigits = /^[a-z]{3,12}[\d!@#$%^&*?._-]{0,6}$/i.test(pw) && pw.length < 14;
    const sequence = /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|qwer|wert|asdf|sdfg|zxcv|1qaz|qazw)/i.test(pw);
    const repeats = /(.)\1{2,}/.test(pw);
    const fewUnique = new Set(pw).size < Math.min(6, Math.ceil(pw.length / 2));
    if (repeats) { score -= 1; feedback.push('Avoid repeating characters'); }
    if (sequence) { score -= 1; feedback.push('Avoid runs like 1234 or qwerty'); }

    let strength: PasswordStrength;
    if (score >= 7 && pw.length >= 14) strength = 'strong';
    else if (score >= 5 && pw.length >= 10) strength = 'good';
    else if (score >= 3 && pw.length >= 8) strength = 'fair';
    else strength = 'weak';

    // Hard caps.
    if (pw.length < 8 || common || fewUnique) {
      strength = 'weak';
      if (common) feedback.unshift('This is a commonly used password');
    } else if (wordThenDigits && strength !== 'weak') {
      strength = 'weak';
      feedback.unshift('A word plus numbers is easy to guess');
    }

    return { strength, score: Math.max(0, score), feedback };
  }
}
/** The most common passwords and base words (lower case). */
const COMMON_PASSWORDS = new Set([
  'password', 'passw0rd', 'p@ssword', 'p@ssw0rd', 'pass', 'welcome', 'letmein', 'qwerty', 'qwertyuiop', 'asdfgh', 'zxcvbn', 'admin', 'administrator',
  'login', 'iloveyou', 'monkey', 'dragon', 'football', 'baseball', 'sunshine', 'princess', 'shadow', 'master', 'superman', 'batman', 'trustno1',
  'abc123', '123456', '1234567', '12345678', '123456789', '1234567890', '111111', '000000', '123123', '654321', 'secret', 'changeme', 'default',
  'hello', 'freedom', 'whatever', 'charlie', 'michael', 'jennifer', 'jordan', 'hunter', 'buster', 'soccer', 'harley', 'ranger', 'summer', 'winter',
  'autumn', 'spring', 'london', 'liverpool', 'chelsea', 'arsenal', 'benfica', 'porto', 'sporting', 'angola', 'luanda', 'lisboa', 'portugal',
  'computer', 'internet', 'samsung', 'google', 'facebook', 'instagram', 'linkedin', 'company', 'business', 'office', 'welcome1', 'test', 'guest',
]);
