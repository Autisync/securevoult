/**
 * Root: crypto set-up, the session, screenshot protection, and the guard that
 * keeps each screen to the state it belongs to (no vault screen while locked).
 */
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenCapture from 'expo-screen-capture';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setupCrypto } from '../services/crypto-setup';
import { SessionProvider, useSession, type Phase } from '../state/session';
import { useTheme } from '../ui/theme';

setupCrypto();
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Which top-level route each state lives on. */
const HOME: Record<Exclude<Phase, 'loading'>, string> = {
  signedOut: 'sign-in',
  mfa: 'mfa',
  locked: 'unlock',
  noVault: 'create-vault',
  unlocked: 'vault',
};
/** Screens only reachable with the vault open. */
const VAULT_SCREENS = new Set(['vault', 'item', 'edit', 'generator', 'settings', 'trash', 'scan']);

function Guard() {
  const { phase } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const t = useTheme();

  useEffect(() => {
    if (phase === 'loading') return;
    void SplashScreen.hideAsync().catch(() => undefined);
    const here = segments[0] ?? '';
    const home = HOME[phase];
    // create-vault stays up after the vault opens, to show the Recovery Kit key once.
    const allowed = phase === 'unlocked' ? VAULT_SCREENS.has(here) || here === 'create-vault' : here === home;
    if (!allowed) router.replace(`/${home}` as never);
  }, [phase, segments, router]);

  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="mfa" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="unlock" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="create-vault" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="vault" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="item/[id]" options={{ title: '' }} />
        <Stack.Screen name="edit" options={{ title: 'Edit', presentation: 'modal' }} />
        <Stack.Screen name="generator" options={{ title: 'Password generator' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="trash" options={{ title: 'Trash' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan 2FA QR code', presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // No screenshots or screen recording of the vault, and a blank card in the app switcher.
  useEffect(() => {
    void ScreenCapture.preventScreenCaptureAsync('securevoult').catch(() => undefined);
  }, []);
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Guard />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
