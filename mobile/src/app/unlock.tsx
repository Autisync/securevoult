/** The lock screen: fingerprint first when it's set up, the master password always works. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useSession } from '../state/session';
import { LogoMark } from '../ui/Logo';
import { Banner, Button, Field, Screen } from '../ui/kit';
import { font, space, useTheme } from '../ui/theme';

export default function Unlock() {
  const t = useTheme();
  const { email, unlock, unlockWithBiometric, biometric, signOut } = useSession();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  const tryBiometric = useCallback(async () => {
    setError(null);
    try {
      await unlockWithBiometric();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [unlockWithBiometric]);

  // Offer the fingerprint straight away, once.
  useEffect(() => {
    if (biometric.enabled && !tried.current) {
      tried.current = true;
      void tryBiometric();
    }
  }, [biometric.enabled, tryBiometric]);

  const submit = async () => {
    setError(null);
    if (!password) { setError('Enter your master password.'); return; }
    setBusy(true);
    try {
      await unlock(password);
      setPassword('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ alignItems: 'center', marginTop: space.xxl * 1.5, marginBottom: space.xxl }}>
          <LogoMark size={64} dark={t.dark} />
          <Text style={[font.title, { color: t.text, marginTop: space.lg }]}>Vault locked</Text>
          {email ? <Text style={[font.body, { color: t.textDim, marginTop: space.xs }]}>{email}</Text> : null}
        </View>

        {error ? <Banner kind="error" text={error} /> : null}

        <Field label="Master password" value={password} onChangeText={setPassword} secret autoFocus={!biometric.enabled}
          returnKeyType="go" onSubmitEditing={submit} textContentType="password" importantForAutofill="no" />
        <Button title={busy ? 'Unlocking…' : 'Unlock'} onPress={submit} busy={busy} />

        {biometric.enabled ? (
          <Button title={`Use ${biometric.label}`} kind="secondary" icon="finger-print" onPress={tryBiometric}
            style={{ marginTop: space.md }} />
        ) : null}

        <Button title="Sign out" kind="ghost" onPress={() => void signOut()} style={{ marginTop: space.xl }} />
        <Text style={[font.tiny, { color: t.textFaint, textAlign: 'center', marginTop: space.sm, lineHeight: 18 }]}>
          Forgot your master password? Use your Recovery Kit on the web.{'\n'}Nobody, including SecureVoult, can reset it.
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}
