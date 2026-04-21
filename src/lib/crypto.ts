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

    let password = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }

    return password;
  }

  // Check password strength
  static checkPasswordStrength(password: string): PasswordStrengthResult {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 12) score += 2;
    else if (password.length >= 8) score += 1;
    else feedback.push('Use at least 8 characters');

    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Include uppercase letters');

    if (/\d/.test(password)) score += 1;
    else feedback.push('Include numbers');

    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else feedback.push('Include special characters');

    // Common patterns check
    if (!/(.)\1{2,}/.test(password)) score += 1;
    else feedback.push('Avoid repeating characters');

    let strength: PasswordStrength;
    if (score >= 6) strength = 'strong';
    else if (score >= 4) strength = 'good';
    else if (score >= 2) strength = 'fair';
    else strength = 'weak';

    return { strength, score, feedback };
  }
}