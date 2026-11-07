/**
 * Plugs the phone's native crypto into the shared vault core:
 * Argon2id from libsodium (C, the reference implementation) and random bytes
 * from the OS (expo-crypto → SecureRandom / SecRandomCopyBytes).
 */
import { getRandomBytes } from 'expo-crypto';
import { crypto_pwhash, crypto_pwhash_ALG_ARGON2ID13, ready } from 'react-native-libsodium';
import { setCryptoProviders } from '../core/vault-crypto';

let done = false;

export function setupCrypto(): void {
  if (done) return;
  done = true;
  setCryptoProviders({
    async argon2id(password, salt, iterations, memoryKiB, parallelism) {
      await ready;
      // libsodium's Argon2id always runs one lane; every SecureVoult vault uses p=1.
      if (parallelism !== 1) throw new Error('This vault uses settings the phone app can\'t open yet. Unlock it once on the web.');
      // Let the "Unlocking…" state paint before the (synchronous) hash blocks the JS thread for a second.
      await new Promise((r) => setTimeout(r, 30));
      return crypto_pwhash(32, password, salt, iterations, memoryKiB * 1024, crypto_pwhash_ALG_ARGON2ID13 ?? 2);
    },
    randomBytes: (n) => getRandomBytes(n),
  });
}
