/** Settings: unlock, autofill, auto-lock, clipboard, sync, trash, sign out. */
import { useEffect, useState } from 'react';
import { Alert, AppState, Linking, Platform, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useSession } from '../state/session';
import { autofillEnabled, autofillSupported, openAutofillSettings } from '../services/autofill';
import { API_BASE } from '../services/config';
import { Banner, Card, Row, Screen, SectionTitle, Toggle } from '../ui/kit';
import { font, space, useTheme } from '../ui/theme';

const LOCK_OPTIONS = [
  { m: 0, label: 'Straight away' }, { m: 1, label: 'After 1 minute' }, { m: 5, label: 'After 5 minutes' },
  { m: 15, label: 'After 15 minutes' }, { m: 60, label: 'After 1 hour' },
];
const CLIP_OPTIONS = [{ s: 15, label: '15 seconds' }, { s: 30, label: '30 seconds' }, { s: 90, label: '90 seconds' }, { s: 0, label: 'Never' }];

function pick<T>(title: string, options: { label: string; value: T }[], onPick: (v: T) => void) {
  Alert.alert(title, undefined, [...options.map((o) => ({ text: o.label, onPress: () => onPick(o.value) })), { text: 'Cancel', style: 'cancel' as const }]);
}

export default function Settings() {
  const t = useTheme();
  const router = useRouter();
  const s = useSession();
  const [error, setError] = useState<string | null>(null);
  const [afOn, setAfOn] = useState(autofillEnabled());

  // Coming back from Android's autofill settings: show the new state.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') setAfOn(autofillEnabled()); });
    return () => sub.remove();
  }, []);

  const toggleBiometric = async (on: boolean) => {
    setError(null);
    try { await s.setBiometric(on); } catch (e) { setError((e as Error).message); }
  };

  const confirmSignOut = () => Alert.alert('Sign out of SecureVoult?', 'The vault copy, fingerprint unlock and autofill data are removed from this phone. Your vault stays safe on your account.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => void s.signOut() },
  ]);

  const lockLabel = LOCK_OPTIONS.find((o) => o.m === s.prefs.autoLockMinutes)?.label ?? `${s.prefs.autoLockMinutes} minutes`;
  const clipLabel = CLIP_OPTIONS.find((o) => o.s === s.prefs.clipboardSeconds)?.label ?? `${s.prefs.clipboardSeconds} seconds`;
  const synced = s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <Screen scroll edges={['bottom']}>
      {error ? <Banner kind="error" text={error} /> : null}

      <SectionTitle>Unlock</SectionTitle>
      <Card>
        <Row icon="finger-print" label={`Unlock with ${s.biometric.label}`}
          value={s.biometric.available ? 'Your master password still works too.' : `Set up a ${s.biometric.label} in your phone's settings first.`}
          right={<Toggle value={s.biometric.enabled} disabled={!s.biometric.available} onChange={(v) => void toggleBiometric(v)} />} />
        <Row icon="timer-outline" label="Lock the vault" value={lockLabel} last
          onPress={() => pick('Lock the vault', LOCK_OPTIONS.map((o) => ({ label: o.label, value: o.m })), (m) => void s.setPrefs({ autoLockMinutes: m }))} />
      </Card>

      {Platform.OS === 'android' && autofillSupported() ? (
        <>
          <SectionTitle>Autofill</SectionTitle>
          <Card>
            <Row icon="flash-outline" label="Fill in other apps and Chrome"
              value={afOn ? 'SecureVoult is your autofill service.' : 'Tap to choose SecureVoult in Android settings.'}
              onPress={openAutofillSettings} />
            <Row icon="phone-portrait-outline" label="Keep autofill data on this phone"
              value="Encrypted with a key that only opens with your fingerprint or screen lock." last
              right={<Toggle value={s.prefs.autofill} onChange={(v) => void s.setPrefs({ autofill: v })} />} />
          </Card>
        </>
      ) : null}

      <SectionTitle>Clipboard</SectionTitle>
      <Card>
        <Row icon="clipboard-outline" label="Clear copied passwords" value={clipLabel} last
          onPress={() => pick('Clear copied passwords', CLIP_OPTIONS.map((o) => ({ label: o.label, value: o.s })), (v) => void s.setPrefs({ clipboardSeconds: v }))} />
      </Card>

      <SectionTitle>Vault</SectionTitle>
      <Card>
        <Row icon="sync-outline" label={s.syncing ? 'Syncing…' : 'Sync now'}
          value={s.offline ? 'Offline: changes upload when you reconnect.' : synced ? `Last synced at ${synced}` : undefined}
          onPress={() => void s.refresh()} />
        <Row icon="dice-outline" label="Password generator" onPress={() => router.push('/generator')} />
        <Row icon="trash-outline" label="Trash" value={`${s.vault?.trash?.length ?? 0} item(s), kept 30 days`} onPress={() => router.push('/trash')} />
        <Row icon="globe-outline" label="Open SecureVoult on the web" value="Import, Recovery Kit, 2FA, devices, billing" last
          onPress={() => void Linking.openURL(API_BASE)} />
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card>
        <Row icon="person-circle-outline" label={s.email ?? 'Signed in'} />
        <Row icon="lock-closed-outline" label="Lock now" onPress={s.lock} />
        <Row icon="log-out-outline" label="Sign out" danger last onPress={confirmSignOut} />
      </Card>

      <Text style={[font.tiny, { color: t.textFaint, textAlign: 'center', marginTop: space.xl }]}>
        SecureVoult {Constants.expoConfig?.version ?? ''} · zero-knowledge, end-to-end encrypted
      </Text>
    </Screen>
  );
}
