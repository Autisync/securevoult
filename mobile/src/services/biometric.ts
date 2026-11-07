/**
 * Fingerprint / face unlock.
 *
 * After an unlock with the master password, the vault key (32 random bytes,
 * not the password) is put in the phone's secure hardware (Android Keystore /
 * iOS Keychain) behind a biometric check. Adding a new fingerprint to the
 * phone invalidates it, so the master password is needed again.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { fromB64, toB64 } from '../core/bytes';

const keyName = (uid: string) => `sv_vk_${uid.replace(/[^A-Za-z0-9._-]/g, '')}`;

export async function biometricAvailable(): Promise<{ ok: boolean; label: string }> {
  const [hasHw, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  return { ok: hasHw && enrolled, label: face ? 'face unlock' : 'fingerprint' };
}

export async function saveBiometricKey(uid: string, raw: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(keyName(uid), toB64(raw), {
    requireAuthentication: true,
    authenticationPrompt: 'Turn on fingerprint unlock',
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  });
}

/** The vault key after a biometric check, or null when cancelled / no longer valid. */
export async function readBiometricKey(uid: string): Promise<Uint8Array | null> {
  try {
    const b64 = await SecureStore.getItemAsync(keyName(uid), {
      requireAuthentication: true,
      authenticationPrompt: 'Unlock SecureVoult',
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
    return b64 ? fromB64(b64) : null;
  } catch {
    return null;
  }
}

export async function hasBiometricKey(uid: string): Promise<boolean> {
  // Reading would prompt; this only checks the entry exists.
  return SecureStore.canUseBiometricAuthentication() && (await SecureStore.getItemAsync(`${keyName(uid)}_on`)) === '1';
}

export async function markBiometric(uid: string, on: boolean): Promise<void> {
  if (on) await SecureStore.setItemAsync(`${keyName(uid)}_on`, '1');
  else {
    await SecureStore.deleteItemAsync(`${keyName(uid)}_on`).catch(() => undefined);
    await SecureStore.deleteItemAsync(keyName(uid)).catch(() => undefined);
  }
}
