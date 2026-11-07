/**
 * First time on an account with no vault: choose the master password, then
 * see the Recovery Kit key once.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSession } from '../state/session';
import { strengthOf } from '../core/generator';
import { copySecret } from '../services/clipboard';
import { Banner, Button, Card, Field, Screen } from '../ui/kit';
import { font, radius, space, useTheme } from '../ui/theme';

export default function CreateVault() {
  const t = useTheme();
  const router = useRouter();
  const { createVault, signOut, prefs, phase } = useSession();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const strength = strengthOf(pw);

  // Reached with the vault already open and nothing to show: go to the vault.
  useEffect(() => {
    if (phase === 'unlocked' && !recoveryKey && !busy) router.replace('/vault');
  }, [phase, recoveryKey, busy, router]);

  const submit = async () => {
    setError(null);
    if (pw.length < 10) { setError('Use at least 10 characters. A short sentence works well.'); return; }
    if (strength.strength === 'weak') { setError('That one is easy to guess. Add more words or characters.'); return; }
    if (pw !== again) { setError('The two passwords don\'t match.'); return; }
    setBusy(true);
    try {
      setRecoveryKey(await createVault(pw));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (recoveryKey) {
    return (
      <Screen scroll>
        <View style={{ marginTop: space.xxl }}>
          <Ionicons name="document-lock-outline" size={48} color={t.gold} />
          <Text style={[font.title, { color: t.text, marginTop: space.lg }]}>Your Recovery Kit key</Text>
          <Text style={[font.body, { color: t.textDim, marginTop: space.sm, lineHeight: 23 }]}>
            If you ever forget your master password, this key is the only way back into your vault. Write it down or keep it somewhere safe that isn't this phone.
          </Text>
        </View>
        <Card style={{ padding: space.lg, marginTop: space.xl, alignItems: 'center' }}>
          <Text selectable style={[font.mono, { color: t.text, textAlign: 'center', lineHeight: 28 }]}>{recoveryKey}</Text>
        </Card>
        <Button title="Copy key" kind="secondary" icon="copy-outline" style={{ marginTop: space.md }}
          onPress={() => void copySecret(recoveryKey, Math.max(prefs.clipboardSeconds, 60))} />
        <Button title={saved ? 'Open my vault' : 'I\'ve saved it somewhere safe'} style={{ marginTop: space.xl }}
          onPress={() => { if (!saved) setSaved(true); else router.replace('/vault'); }} />
      </Screen>
    );
  }

  const meterColor = { weak: t.danger, fair: t.warn, good: t.gold, strong: t.ok }[strength.strength];
  return (
    <Screen scroll>
      <View style={{ marginTop: space.xxl, marginBottom: space.xl }}>
        <Text style={[font.title, { color: t.text }]}>Create your master password</Text>
        <Text style={[font.body, { color: t.textDim, marginTop: space.sm, lineHeight: 23 }]}>
          It encrypts your vault on this phone. SecureVoult never receives it and can't reset it, so pick one you'll remember.
        </Text>
      </View>
      {error ? <Banner kind="error" text={error} /> : null}
      <Field label="Master password" value={pw} onChangeText={setPw} secret autoFocus importantForAutofill="no" />
      {pw ? (
        <View style={{ marginTop: -4, marginBottom: space.md }}>
          <View style={{ height: 4, borderRadius: radius.pill, backgroundColor: t.surfaceHi }}>
            <View style={{ height: 4, borderRadius: radius.pill, width: `${Math.max(8, strength.score)}%`, backgroundColor: meterColor }} />
          </View>
          <Text style={[font.tiny, { color: meterColor, marginTop: 4 }]}>{strength.strength[0].toUpperCase() + strength.strength.slice(1)}</Text>
        </View>
      ) : null}
      <Field label="Type it again" value={again} onChangeText={setAgain} secret importantForAutofill="no" returnKeyType="go" onSubmitEditing={submit} />
      <Button title="Create vault" onPress={submit} busy={busy} style={{ marginTop: space.sm }} />
      <Button title="Use another account" kind="ghost" onPress={() => void signOut()} style={{ marginTop: space.md }} />
    </Screen>
  );
}
