/** Two-step sign-in: the 6-digit code from the authenticator app (or a backup code). */
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../state/session';
import { Banner, Button, Field, Screen } from '../ui/kit';
import { font, space, useTheme } from '../ui/theme';

export default function Mfa() {
  const t = useTheme();
  const { submitMfa, signOut } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (code.replace(/\s/g, '').length < 6) { setError('Enter the 6-digit code.'); return; }
    setBusy(true);
    try { await submitMfa(code); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Screen scroll>
      <View style={{ alignItems: 'center', marginTop: space.xxl * 1.5, marginBottom: space.xl }}>
        <Ionicons name="shield-checkmark-outline" size={56} color={t.gold} />
        <Text style={[font.title, { color: t.text, marginTop: space.lg }]}>Two-step sign-in</Text>
        <Text style={[font.body, { color: t.textDim, marginTop: space.sm, textAlign: 'center' }]}>
          Enter the code from your authenticator app, or one of your backup codes.
        </Text>
      </View>
      {error ? <Banner kind="error" text={error} /> : null}
      <Field label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code"
        textContentType="oneTimeCode" maxLength={11} autoFocus returnKeyType="go" onSubmitEditing={submit} />
      <Button title="Continue" onPress={submit} busy={busy} />
      <Button title="Use another account" kind="ghost" onPress={() => void signOut()} style={{ marginTop: space.md }} />
    </Screen>
  );
}
