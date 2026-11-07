/** Sign in with the SecureVoult account (the same email and password as on the web). */
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, Text, View } from 'react-native';
import { useSession } from '../state/session';
import { resetPassword } from '../services/firebase';
import { API_BASE } from '../services/config';
import { LogoMark } from '../ui/Logo';
import { Banner, Button, Field, Screen } from '../ui/kit';
import { font, space, useTheme } from '../ui/theme';

export default function SignIn() {
  const t = useTheme();
  const { signIn, startupError, retryStartup } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNote(null);
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(null);
    if (!email.trim()) { setError('Type your email first, then tap "Forgot password".'); return; }
    try {
      await resetPassword(email);
      setNote('If that email has an account, a reset link is on its way.');
    } catch {
      setNote('If that email has an account, a reset link is on its way.');
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ alignItems: 'center', marginTop: space.xxl * 1.5, marginBottom: space.xxl }}>
          <LogoMark size={72} dark={t.dark} />
          <Text style={[font.title, { color: t.text, marginTop: space.lg }]}>SecureVoult</Text>
          <Text style={[font.body, { color: t.textDim, marginTop: space.xs }]}>Sign in to your account</Text>
        </View>

        {startupError ? <Banner kind="error" text={`${startupError} Tap to try again.`} onPress={() => void retryStartup()} /> : null}
        {error ? <Banner kind="error" text={error} /> : null}
        {note ? <Banner kind="ok" text={note} /> : null}

        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email"
          textContentType="username" placeholder="you@example.com" returnKeyType="next" />
        <Field label="Account password" value={password} onChangeText={setPassword} secret autoComplete="password"
          textContentType="password" returnKeyType="go" onSubmitEditing={submit} />

        <Button title="Sign in" onPress={submit} busy={busy} style={{ marginTop: space.sm }} />

        <Pressable onPress={forgot} style={{ paddingVertical: space.lg, alignItems: 'center' }}>
          <Text style={[font.small, { color: t.gold }]}>Forgot password</Text>
        </Pressable>

        <Text style={[font.small, { color: t.textFaint, textAlign: 'center', lineHeight: 20 }]}>
          No account yet?{' '}
          <Text style={{ color: t.gold }} onPress={() => void Linking.openURL(API_BASE)}>Create one on the web</Text>
          {'\n'}Your vault is encrypted on this phone. SecureVoult never sees your master password.
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}
