/**
 * WebAuthn / Passkey utilities — server-side helpers.
 *
 * This implementation uses the browser's Web Authentication API (WebAuthn)
 * with the SimpleWebAuthn-style manual CBOR/COSE approach — no third-party
 * library dependency required for the core crypto.
 *
 * Security:
 *  - Challenges are single-use (deleted after verification).
 *  - Counter validation detects credential cloning.
 *  - Origin and rpId are validated against known values.
 *  - All crypto uses Node.js built-in `crypto` module.
 */

import crypto from 'crypto';

// ── Configuration ────────────────────────────────────────────────────────────

export function getRpId(): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    return new URL(origin).hostname;
  } catch {
    return 'localhost';
  }
}

export function getRpName(): string {
  return 'SecureVoult';
}

export function getAllowedOrigins(): string[] {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const origins = [base];
  // Also allow localhost variants during development
  if (base.includes('localhost')) {
    origins.push('http://localhost:3000', 'https://localhost:3000');
  }
  return Array.from(new Set(origins));
}

// ── Challenge helpers ────────────────────────────────────────────────────────

/** Generate a cryptographically-random base64url challenge (32 bytes). */
export function generateChallenge(): string {
  return base64url(crypto.randomBytes(32));
}

/** Generate a random userId bytes value for new passkey registrations. */
export function generateUserIdBytes(): string {
  return base64url(crypto.randomBytes(16));
}

// ── Encoding helpers ─────────────────────────────────────────────────────────

export function base64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function fromBase64url(s: string): Buffer {
  // Pad to multiple of 4
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padding), 'base64');
}

// ── Minimal CBOR decoder (subset needed for authenticatorData) ───────────────

/** Very small CBOR map decoder for the attestedCredentialData COSE key. */
export function decodeCBORMap(buf: Buffer): Map<number, unknown> {
  const map = new Map<number, unknown>();
  let offset = 0;

  function readByte(): number {
    return buf[offset++];
  }

  function readUint(additionalInfo: number): number {
    if (additionalInfo < 24) return additionalInfo;
    if (additionalInfo === 24) return readByte();
    if (additionalInfo === 25) {
      const v = buf.readUInt16BE(offset); offset += 2; return v;
    }
    if (additionalInfo === 26) {
      const v = buf.readUInt32BE(offset); offset += 4; return v;
    }
    throw new Error(`Unsupported CBOR uint size: ${additionalInfo}`);
  }

  function readValue(): unknown {
    const initialByte = readByte();
    const majorType = (initialByte >> 5) & 0x07;
    const additionalInfo = initialByte & 0x1f;

    switch (majorType) {
      case 0: // unsigned int
        return readUint(additionalInfo);
      case 1: // negative int
        return -1 - readUint(additionalInfo);
      case 2: { // byte string
        const len = readUint(additionalInfo);
        const bytes = buf.slice(offset, offset + len); offset += len;
        return bytes;
      }
      case 3: { // text string
        const len = readUint(additionalInfo);
        const text = buf.slice(offset, offset + len).toString('utf8'); offset += len;
        return text;
      }
      case 5: { // map
        const count = readUint(additionalInfo);
        const m = new Map<number, unknown>();
        for (let i = 0; i < count; i++) {
          const k = readValue() as number;
          const v = readValue();
          m.set(k, v);
        }
        return m;
      }
      default:
        throw new Error(`Unsupported CBOR major type: ${majorType}`);
    }
  }

  const initial = readByte();
  const majorType = (initial >> 5) & 0x07;
  const additionalInfo = initial & 0x1f;

  if (majorType !== 5) throw new Error('Expected CBOR map at root');
  const count = readUint(additionalInfo);
  for (let i = 0; i < count; i++) {
    const k = readValue() as number;
    const v = readValue();
    map.set(k, v);
  }

  return map;
}

// ── authenticatorData parser ─────────────────────────────────────────────────

export interface ParsedAuthData {
  rpIdHash: Buffer;
  flags: {
    userPresent: boolean;
    userVerified: boolean;
    attestedCredentialData: boolean;
    extensionData: boolean;
  };
  counter: number;
  credentialId?: Buffer;
  credentialPublicKey?: Buffer;
}

export function parseAuthenticatorData(buf: Buffer): ParsedAuthData {
  let offset = 0;

  const rpIdHash = buf.slice(offset, offset + 32); offset += 32;
  const flagsByte = buf[offset++];
  const counter = buf.readUInt32BE(offset); offset += 4;

  const flags = {
    userPresent:              !!(flagsByte & 0x01),
    userVerified:             !!(flagsByte & 0x04),
    attestedCredentialData:   !!(flagsByte & 0x40),
    extensionData:            !!(flagsByte & 0x80),
  };

  let credentialId: Buffer | undefined;
  let credentialPublicKey: Buffer | undefined;

  if (flags.attestedCredentialData) {
    // aaguid (16 bytes)
    offset += 16;
    const credIdLen = buf.readUInt16BE(offset); offset += 2;
    credentialId = buf.slice(offset, offset + credIdLen); offset += credIdLen;
    credentialPublicKey = buf.slice(offset); // rest is CBOR public key
  }

  return { rpIdHash, flags, counter, credentialId, credentialPublicKey };
}

// ── COSE public-key → SubjectPublicKeyInfo (for Node crypto.verify) ──────────

/** Extract EC P-256 public key from COSE map and return as a Node.js KeyObject. */
export function cosePublicKeyToKeyObject(coseKey: Buffer): crypto.KeyObject {
  const map = decodeCBORMap(coseKey);
  // kty=2 (EC), alg=-7 (ES256), crv=1 (P-256), x=key, y=key
  const x = map.get(-2) as Buffer;
  const y = map.get(-3) as Buffer;

  // Build uncompressed EC point
  const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y]);

  return crypto.createPublicKey({
    key: Buffer.concat([
      // DER header for EC P-256 SubjectPublicKeyInfo
      Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex'),
      uncompressed,
    ]),
    format: 'der',
    type: 'spki',
  });
}

// ── Registration verification ────────────────────────────────────────────────

export interface RegistrationVerificationInput {
  /** base64url-encoded clientDataJSON from the browser */
  clientDataJSON: string;
  /** base64url-encoded attestationObject from the browser */
  attestationObject: string;
  /** The challenge we issued, as stored in DB */
  expectedChallenge: string;
  /** RP ID (e.g. "localhost") */
  rpId: string;
  /** Allowed origins (e.g. "http://localhost:3000") */
  allowedOrigins: string[];
  /** Whether to require UV flag */
  requireUserVerification?: boolean;
}

export interface RegistrationVerificationResult {
  credentialId: string;  // base64url
  publicKey: string;     // base64url (raw COSE bytes)
  counter: number;
  transports: string[];
}

export async function verifyRegistration(
  input: RegistrationVerificationInput
): Promise<RegistrationVerificationResult> {
  const {
    clientDataJSON, attestationObject, expectedChallenge,
    rpId, allowedOrigins, requireUserVerification = false,
  } = input;

  // 1. Parse clientDataJSON
  const clientData = JSON.parse(fromBase64url(clientDataJSON).toString('utf8'));
  if (clientData.type !== 'webauthn.create') {
    throw new Error('Invalid clientData type — expected webauthn.create');
  }
  if (clientData.challenge !== expectedChallenge) {
    throw new Error('Challenge mismatch — possible replay attack');
  }
  if (!allowedOrigins.includes(clientData.origin)) {
    throw new Error(`Origin "${clientData.origin}" not allowed`);
  }

  // 2. Parse attestationObject (minimal: only none/packed fmt needed)
  const attObjBuf = fromBase64url(attestationObject);
  // Decode outer CBOR map manually
  const attObj = decodeCBORTopLevel(attObjBuf);
  const authDataBuf = attObj.get('authData') as Buffer;

  // 3. Parse authenticatorData
  const authData = parseAuthenticatorData(authDataBuf);

  // 4. Verify rpIdHash
  const expectedRpIdHash = crypto.createHash('sha256').update(rpId).digest();
  if (!authData.rpIdHash.equals(expectedRpIdHash)) {
    throw new Error('RP ID hash mismatch');
  }

  // 5. Verify UP flag
  if (!authData.flags.userPresent) {
    throw new Error('User presence flag not set');
  }

  // 6. Optional UV flag
  if (requireUserVerification && !authData.flags.userVerified) {
    throw new Error('User verification required but not performed');
  }

  // 7. Extract credential
  if (!authData.credentialId || !authData.credentialPublicKey) {
    throw new Error('No attested credential data in authenticatorData');
  }

  return {
    credentialId:  base64url(authData.credentialId),
    publicKey:     base64url(authData.credentialPublicKey),
    counter:       authData.counter,
    transports:    [], // filled in by caller from transport hints
  };
}

// ── Authentication verification ──────────────────────────────────────────────

export interface AuthenticationVerificationInput {
  credentialId: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
  /** Raw COSE public key bytes (base64url) as stored in DB */
  storedPublicKey: string;
  storedCounter: number;
  expectedChallenge: string;
  rpId: string;
  allowedOrigins: string[];
  requireUserVerification?: boolean;
}

export interface AuthenticationVerificationResult {
  newCounter: number;
}

export async function verifyAuthentication(
  input: AuthenticationVerificationInput
): Promise<AuthenticationVerificationResult> {
  const {
    clientDataJSON, authenticatorData, signature,
    storedPublicKey, storedCounter,
    expectedChallenge, rpId, allowedOrigins,
    requireUserVerification = false,
  } = input;

  // 1. Parse clientDataJSON
  const clientData = JSON.parse(fromBase64url(clientDataJSON).toString('utf8'));
  if (clientData.type !== 'webauthn.get') {
    throw new Error('Invalid clientData type — expected webauthn.get');
  }
  if (clientData.challenge !== expectedChallenge) {
    throw new Error('Challenge mismatch — possible replay attack');
  }
  if (!allowedOrigins.includes(clientData.origin)) {
    throw new Error(`Origin "${clientData.origin}" not allowed`);
  }

  // 2. Parse authenticatorData
  const authDataBuf = fromBase64url(authenticatorData);
  const authData = parseAuthenticatorData(authDataBuf);

  // 3. Verify rpIdHash
  const expectedRpIdHash = crypto.createHash('sha256').update(rpId).digest();
  if (!authData.rpIdHash.equals(expectedRpIdHash)) {
    throw new Error('RP ID hash mismatch');
  }

  // 4. Verify flags
  if (!authData.flags.userPresent) throw new Error('User presence flag not set');
  if (requireUserVerification && !authData.flags.userVerified) {
    throw new Error('User verification required but not performed');
  }

  // 5. Verify counter (prevent credential cloning)
  if (storedCounter !== 0 && authData.counter !== 0 && authData.counter <= storedCounter) {
    throw new Error('Authenticator counter did not increase — possible credential cloning');
  }

  // 6. Verify signature
  const clientDataHash = crypto.createHash('sha256').update(fromBase64url(clientDataJSON)).digest();
  const verificationData = Buffer.concat([authDataBuf, clientDataHash]);

  const publicKey = cosePublicKeyToKeyObject(fromBase64url(storedPublicKey));
  const sigBuf = fromBase64url(signature);

  const valid = crypto.verify('SHA256', verificationData, publicKey, sigBuf);
  if (!valid) throw new Error('Signature verification failed');

  return { newCounter: authData.counter };
}

// ── Minimal CBOR top-level map decoder (for attestationObject) ───────────────

function decodeCBORTopLevel(buf: Buffer): Map<string, unknown> {
  const map = new Map<string, unknown>();
  let offset = 0;

  function readByte(): number { return buf[offset++]; }

  function readUint(ai: number): number {
    if (ai < 24) return ai;
    if (ai === 24) return readByte();
    if (ai === 25) { const v = buf.readUInt16BE(offset); offset += 2; return v; }
    if (ai === 26) { const v = buf.readUInt32BE(offset); offset += 4; return v; }
    throw new Error(`CBOR uint too large: ${ai}`);
  }

  function readValue(): unknown {
    const b = readByte();
    const mt = (b >> 5) & 7;
    const ai = b & 0x1f;
    switch (mt) {
      case 0: return readUint(ai);
      case 1: return -1 - readUint(ai);
      case 2: { const n = readUint(ai); const s = buf.slice(offset, offset + n); offset += n; return s; }
      case 3: { const n = readUint(ai); const s = buf.slice(offset, offset + n).toString('utf8'); offset += n; return s; }
      case 5: {
        const n = readUint(ai);
        const m = new Map<string, unknown>();
        for (let i = 0; i < n; i++) { const k = readValue() as string; m.set(k, readValue()); }
        return m;
      }
      default: throw new Error(`CBOR unsupported major type: ${mt}`);
    }
  }

  const b = readByte();
  const mt = (b >> 5) & 7;
  const ai = b & 0x1f;
  if (mt !== 5) throw new Error('Expected CBOR map');
  const count = readUint(ai);
  for (let i = 0; i < count; i++) {
    const k = readValue() as string;
    map.set(k, readValue());
  }
  return map;
}
