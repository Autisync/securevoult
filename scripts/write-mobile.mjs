import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const mobile = `// Mobile app component — premium SecureVoult UI
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, StatusBar, Alert,
} from 'react-native';
import { useVault } from '@/contexts/VaultContext';

const COLORS = {
  bg: '#080d1a',
  card: '#0d1424',
  border: '#1e2d4a',
  primary: '#3b82f6',
  primaryDim: 'rgba(59,130,246,0.15)',
  violet: '#8b5cf6',
  muted: '#94a3b8',
  text: '#f1f5f9',
  textSub: '#64748b',
  success: '#4ade80',
  danger: '#f87171',
  amber: '#fbbf24',
};

export function MobileApp() {
  const { isUnlocked, hasVault } = useVault();
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);

  useEffect(() => {
    hasVault().then((exists) => setIsFirstTime(!exists));
  }, [hasVault]);

  if (isFirstTime === null) {
    return (
      <SafeAreaView style={[styles.root, styles.centered]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ActivityIndicator color={COLORS.primary} />
        <Text style={[styles.mutedText, { marginTop: 12 }]}>Loading vault...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      {isUnlocked
        ? <MobileVaultInterface />
        : isFirstTime
          ? <MobileMasterPasswordSetup onComplete={() => setIsFirstTime(false)} />
          : <MobileUnlockVault />}
    </SafeAreaView>
  );
}

// ------- Vault Interface ------- //
function MobileVaultInterface() {
  const { vault, lockVault } = useVault();
  const entries = vault?.entries ?? [];

  const letter = (website: string) => (website || '?')[0].toUpperCase();
  const gradients: [string, string][] = [
    ['#3b82f6', '#8b5cf6'],
    ['#8b5cf6', '#ec4899'],
    ['#10b981', '#14b8a6'],
    ['#f59e0b', '#ef4444'],
  ];
  const grad = (w: string): [string, string] => gradients[w.charCodeAt(0) % gradients.length];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SecureVoult</Text>
          <Text style={styles.mutedText}>{entries.length} password{entries.length !== 1 ? 's' : ''} stored</Text>
        </View>
        <TouchableOpacity
          style={styles.lockBtn}
          onPress={() => Alert.alert('Lock vault?', 'You will need your master password to unlock.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Lock', style: 'destructive', onPress: lockVault },
          ])}
        >
          <Text style={styles.lockBtnText}>Lock</Text>
        </TouchableOpacity>
      </View>

      {entries.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Text style={{ fontSize: 24 }}>🔐</Text>
          </View>
          <Text style={styles.h3}>No entries yet</Text>
          <Text style={styles.mutedText}>Add passwords from the web app.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: COLORS.primary }]}>{entries.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: COLORS.amber }]}>{entries.filter(e => e.isFavorite).length}</Text>
              <Text style={styles.statLabel}>Favorites</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: COLORS.violet }]}>{new Set(entries.map(e => e.category)).size}</Text>
              <Text style={styles.statLabel}>Categories</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>ALL ITEMS</Text>
          {entries.map((entry) => {
            const [c1, c2] = grad(entry.website || '');
            return (
              <View key={entry.id} style={styles.entryRow}>
                <View style={[styles.entryAvatar, { backgroundColor: c1 }]}>
                  <Text style={styles.entryLetter}>{letter(entry.website)}</Text>
                </View>
                <View style={styles.entryText}>
                  <Text style={styles.entryTitle} numberOfLines={1}>{entry.website}</Text>
                  <Text style={styles.entryUsername} numberOfLines={1}>{entry.username}</Text>
                </View>
                <View style={styles.entryBadge}>
                  <Text style={styles.entryBadgeText}>{entry.category}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ------- Setup ------- //
function MobileMasterPasswordSetup({ onComplete }: { onComplete: () => void }) {
  const { createVault } = useVault();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const valid = password.length >= 10;
  const matches = password === confirm && confirm.length > 0;

  const handleCreate = async () => {
    if (!valid) { Alert.alert('Weak password', 'Master password must be at least 10 characters.'); return; }
    if (!matches) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }
    setIsLoading(true);
    try {
      await createVault(password);
      onComplete();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not create vault.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.logoBlock}>
        <Text style={styles.logoText}>🔐 SecureVoult</Text>
        <Text style={styles.tagline}>Zero-knowledge encryption</Text>
      </View>
      <View style={styles.authCard}>
        <Text style={styles.h2}>Create master password</Text>
        <Text style={[styles.mutedText, { marginBottom: 20 }]}>
          This password encrypts your vault. It never leaves your device and cannot be recovered.
        </Text>
        <Text style={styles.inputLabel}>Master password</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Choose a strong password"
            placeholderTextColor={COLORS.textSub}
            secureTextEntry={!show}
            value={password}
            onChangeText={setPassword}
            autoComplete="off"
          />
          <TouchableOpacity onPress={() => setShow(!show)} style={styles.inputIcon}>
            <Text style={{ color: COLORS.muted, fontSize: 12 }}>{show ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Confirm password</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Re-enter your password"
          placeholderTextColor={COLORS.textSub}
          secureTextEntry={!show}
          value={confirm}
          onChangeText={setConfirm}
          autoComplete="off"
        />
        {confirm.length > 0 && (
          <Text style={[styles.matchText, { color: matches ? COLORS.success : COLORS.danger }]}>
            {matches ? '✓ Passwords match' : '✗ Passwords do not match'}
          </Text>
        )}
        <View style={styles.warningBox}>
          <Text style={[styles.mutedText, { color: COLORS.amber }]}>
            ⚠ If you forget this password, your vault cannot be recovered. Write it down.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.primaryBtn, (!valid || !matches || isLoading) && styles.primaryBtnDisabled]}
          onPress={handleCreate}
          disabled={!valid || !matches || isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Create vault</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ------- Unlock ------- //
function MobileUnlockVault() {
  const { unlockVault } = useVault();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = async () => {
    if (!password) return;
    setIsLoading(true);
    setError('');
    try {
      await unlockVault(password);
    } catch {
      setError('Incorrect master password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.root, styles.centered, { paddingHorizontal: 24 }]}>
      <View style={styles.logoBlock}>
        <Text style={styles.logoText}>🔐 SecureVoult</Text>
        <Text style={styles.tagline}>Enter your master password</Text>
      </View>
      <View style={[styles.authCard, { width: '100%' }]}>
        <Text style={styles.inputLabel}>Master password</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Your master password"
            placeholderTextColor={COLORS.textSub}
            secureTextEntry={!show}
            value={password}
            onChangeText={setPassword}
            autoComplete="current-password"
            onSubmitEditing={handleUnlock}
            returnKeyType="go"
          />
          <TouchableOpacity onPress={() => setShow(!show)} style={styles.inputIcon}>
            <Text style={{ color: COLORS.muted, fontSize: 12 }}>{show ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={[styles.matchText, { color: COLORS.danger }]}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.primaryBtn, { marginTop: 16 }, (!password || isLoading) && styles.primaryBtnDisabled]}
          onPress={handleUnlock}
          disabled={!password || isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Unlock vault</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  lockBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)',
  },
  lockBtnText: { color: COLORS.danger, fontSize: 12, fontWeight: '600' },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 16, backgroundColor: COLORS.card,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  h3: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  h2: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  mutedText: { fontSize: 13, color: COLORS.muted, lineHeight: 20 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSub, letterSpacing: 1,
    marginTop: 20, marginBottom: 8,
  },
  entryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  entryAvatar: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  entryLetter: { fontSize: 14, fontWeight: '700', color: '#fff' },
  entryText: { flex: 1 },
  entryTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  entryUsername: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  entryBadge: {
    backgroundColor: COLORS.primaryDim, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  entryBadgeText: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 4 },
  statCard: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 12,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 10, color: COLORS.muted, marginTop: 2 },
  authContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoBlock: { alignItems: 'center', marginBottom: 32 },
  logoText: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  tagline: { fontSize: 13, color: COLORS.muted, marginTop: 4 },
  authCard: {
    backgroundColor: COLORS.card, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: COLORS.border,
  },
  inputLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  inputRow: { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  textInput: {
    flex: 1, height: 46, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, fontSize: 14, color: COLORS.text,
  },
  inputIcon: { position: 'absolute', right: 14 },
  matchText: { fontSize: 12, marginTop: 6 },
  warningBox: {
    backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
    padding: 12, marginVertical: 16,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
`;

writeFileSync(join(root, 'src/components/MobileApp.tsx'), mobile, 'utf8');
console.log('MobileApp written:', mobile.split('\n').length, 'lines');
