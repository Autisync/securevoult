// Mobile app component — premium SecureVoult UI
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, StatusBar, Alert, Clipboard,
} from 'react-native';
import { useVault } from '@/contexts/VaultContext';
import { CryptoService } from '@/lib/crypto';
import { VaultItemType, PasswordEntry } from '@/types/vault';
import { formatDistanceToNow } from 'date-fns';

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

// ------- Entry Detail ------- //
function MobileEntryDetail({
  entry,
  onBack,
  updateEntry,
}: {
  entry: PasswordEntry;
  onBack: () => void;
  updateEntry: (id: string, updates: Partial<PasswordEntry>) => Promise<void>;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyField = useCallback(async (label: string, value: string) => {
    try {
      await Clipboard.setString(value);
      setCopied(label);
      // Track lastUsed
      if (label === 'Password' || label === 'Username') {
        updateEntry(entry.id, { lastUsed: new Date() }).catch(() => {});
      }
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }, [entry.id, updateEntry]);

  const passwordAgeDays = entry.password
    ? Math.floor((Date.now() - new Date(entry.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isStale = entry.type === 'login' && entry.password && passwordAgeDays > 90;

  const fields: Array<{ label: string; value: string; secret?: boolean; mono?: boolean } | null> = [
    entry.username ? { label: 'Username', value: entry.username } : null,
    entry.password ? { label: 'Password', value: entry.password, secret: true, mono: true } : null,
    entry.url ? { label: 'URL', value: entry.url } : null,
    { label: 'Category', value: entry.category },
    entry.notes ? { label: 'Notes', value: entry.notes } : null,
    entry.lastUsed ? { label: 'Last used', value: formatDistanceToNow(new Date(entry.lastUsed), { addSuffix: true }) } : null,
  ];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={{ color: COLORS.primary, fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{entry.website}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <View style={[styles.entryBadge, { paddingHorizontal: 6, paddingVertical: 2 }]}>
              <Text style={[styles.entryBadgeText, { fontSize: 9 }]}>{(entry.type ?? 'login').toUpperCase()}</Text>
            </View>
            {isStale && (
              <View style={{ backgroundColor: 'rgba(234,179,8,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(234,179,8,0.25)' }}>
                <Text style={{ fontSize: 9, color: COLORS.amber, fontWeight: '600' }}>{passwordAgeDays}d OLD</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ width: 48 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={styles.detailCard}>
          {fields.filter(Boolean).map(row => row && (
            <View key={row.label} style={[styles.detailRow, { flexDirection: 'row', alignItems: 'center' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>{row.label}</Text>
                {row.secret ? (
                  <Text style={[styles.detailValue, { fontFamily: 'monospace', letterSpacing: row.secret && !showPassword ? 2 : 0.5 }]} numberOfLines={1}>
                    {showPassword ? row.value : '••••••••••••'}
                  </Text>
                ) : (
                  <Text style={[styles.detailValue, row.mono && { fontFamily: 'monospace', fontSize: 12 }]} numberOfLines={3}>
                    {row.value}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
                {row.secret && (
                  <TouchableOpacity
                    onPress={() => setShowPassword(v => !v)}
                    style={{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: COLORS.card, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border }}
                  >
                    <Text style={{ fontSize: 11, color: COLORS.muted }}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                )}
                {row.value && row.label !== 'Category' && row.label !== 'Last used' && (
                  <TouchableOpacity
                    onPress={() => copyField(row.label, row.value)}
                    style={{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: copied === row.label ? 'rgba(59,130,246,0.15)' : COLORS.card, borderRadius: 8, borderWidth: 1, borderColor: copied === row.label ? COLORS.primary : COLORS.border }}
                  >
                    <Text style={{ fontSize: 11, color: copied === row.label ? COLORS.primary : COLORS.muted }}>
                      {copied === row.label ? '✓' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
        {entry.tags && entry.tags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {entry.tags.map(tag => (
              <View key={tag} style={styles.tagBadge}><Text style={styles.tagBadgeText}>{tag}</Text></View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ------- Vault Interface ------- //
function MobileVaultInterface() {
  const { vault, lockVault, updateEntry } = useVault();
  const entries = vault?.entries ?? [];
  const [search, setSearch] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<VaultItemType | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Security stats
  const pwCounts = new Map<string, number>();
  for (const e of entries) if (e.password) pwCounts.set(e.password, (pwCounts.get(e.password) ?? 0) + 1);
  const weakCount = entries.filter(e => e.password && CryptoService.checkPasswordStrength(e.password).strength === 'weak').length;
  const reusedCount = entries.filter(e => e.password && (pwCounts.get(e.password) ?? 0) > 1).length;
  const secureScore = entries.length === 0 ? 100 : Math.max(0, Math.round(100 - (weakCount / entries.length) * 60 - (reusedCount / entries.length) * 30));

  // Recent items (last 5 updated)
  const recentEntries = [...entries].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);

  // Recently used
  const recentlyUsed = [...entries]
    .filter(e => e.lastUsed)
    .sort((a, b) => new Date(b.lastUsed!).getTime() - new Date(a.lastUsed!).getTime())
    .slice(0, 5);

  const letter = (website: string) => (website || '?')[0].toUpperCase();
  const gradients: [string, string][] = [
    ['#3b82f6', '#8b5cf6'],
    ['#8b5cf6', '#ec4899'],
    ['#10b981', '#14b8a6'],
    ['#f59e0b', '#ef4444'],
  ];
  const grad = (w: string): [string, string] => gradients[w.charCodeAt(0) % gradients.length];

  const filtered = entries.filter(e => {
    if (favOnly && !e.isFavorite) return false;
    if (typeFilter !== 'all' && (e.type ?? 'login') !== typeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.website.toLowerCase().includes(q) ||
      e.username.toLowerCase().includes(q) ||
      (e.tags ?? []).some(t => t.toLowerCase().includes(q))
    );
  });

  const selectedEntry = selectedId ? entries.find(e => e.id === selectedId) : null;

  if (selectedEntry) {
    return <MobileEntryDetail entry={selectedEntry} onBack={() => setSelectedId(null)} updateEntry={updateEntry} />;
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SecureVoult</Text>
          <Text style={styles.mutedText}>{entries.length} item{entries.length !== 1 ? 's' : ''}</Text>
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

      {/* Search bar */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search vault…"
          placeholderTextColor={COLORS.textSub}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
          {[{ label: 'All', active: !favOnly }, { label: '★ Favorites', active: favOnly }].map(tab => (
            <TouchableOpacity
              key={tab.label}
              onPress={() => setFavOnly(tab.label !== 'All')}
              style={[styles.filterTab, tab.active && styles.filterTabActive]}
            >
              <Text style={[styles.filterTabText, tab.active && styles.filterTabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ width: 1, backgroundColor: COLORS.border, marginHorizontal: 4 }} />
          {(['all', 'login', 'note', 'card', 'identity', 'wifi'] as const).map(t => {
            const labels: Record<string, string> = { all: 'Any type', login: '🔑 Login', note: '📝 Note', card: '💳 Card', identity: '👤 Identity', wifi: '📶 Wi-Fi' };
            const active = typeFilter === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setTypeFilter(t)}
                style={[styles.filterTab, active && styles.filterTabActive]}
              >
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{labels[t]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {entries.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Text style={{ fontSize: 24 }}>🔐</Text>
          </View>
          <Text style={styles.h3}>No entries yet</Text>
          <Text style={styles.mutedText}>Add passwords from the web app.</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.h3}>No results</Text>
          <Text style={styles.mutedText}>{favOnly ? 'No favorites yet.' : `Nothing matches "${search}"`}</Text>
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

          {/* Security summary */}
          <View style={[styles.statRow, { marginTop: 0 }]}>
            <View style={[styles.statCard, { borderColor: secureScore >= 80 ? '#166534' : secureScore >= 50 ? '#713f12' : '#991b1b', borderWidth: 1 }]}>
              <Text style={[styles.statValue, { color: secureScore >= 80 ? COLORS.success : secureScore >= 50 ? COLORS.amber : COLORS.danger }]}>{secureScore}</Text>
              <Text style={styles.statLabel}>Score</Text>
            </View>
            <View style={[styles.statCard, weakCount > 0 ? { borderColor: '#991b1b', borderWidth: 1 } : {}]}>
              <Text style={[styles.statValue, { color: weakCount > 0 ? COLORS.danger : COLORS.success }]}>{weakCount}</Text>
              <Text style={styles.statLabel}>Weak</Text>
            </View>
            <View style={[styles.statCard, reusedCount > 0 ? { borderColor: '#78350f', borderWidth: 1 } : {}]}>
              <Text style={[styles.statValue, { color: reusedCount > 0 ? COLORS.amber : COLORS.success }]}>{reusedCount}</Text>
              <Text style={styles.statLabel}>Reused</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>
            {search ? `RESULTS (${filtered.length})` : favOnly ? 'FAVORITES' : typeFilter !== 'all' ? typeFilter.toUpperCase() + 'S' : 'ALL ITEMS'}
          </Text>
          {!search && !favOnly && typeFilter === 'all' && recentlyUsed.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 12 }]}>RECENTLY USED</Text>
              {recentlyUsed.map((entry) => {
                const [c1] = grad(entry.website || '');
                return (
                  <TouchableOpacity key={`used-${entry.id}`} style={[styles.entryRow, { opacity: 0.85 }]} onPress={() => setSelectedId(entry.id)}>
                    <View style={[styles.entryAvatar, { backgroundColor: c1 }]}>
                      <Text style={styles.entryLetter}>{letter(entry.website)}</Text>
                    </View>
                    <View style={styles.entryText}>
                      <Text style={styles.entryTitle} numberOfLines={1}>{entry.website}</Text>
                      <Text style={styles.entryUsername} numberOfLines={1}>{formatDistanceToNow(new Date(entry.lastUsed!), { addSuffix: true })}</Text>
                    </View>
                    <View style={[styles.entryBadge, { backgroundColor: 'rgba(139,92,246,0.12)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)' }]}>
                      <Text style={[styles.entryBadgeText, { color: COLORS.violet }]}>Used</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <Text style={[styles.sectionLabel, { marginTop: 12 }]}>ALL ITEMS</Text>
            </>
          )}
          {!search && !favOnly && typeFilter === 'all' && recentlyUsed.length === 0 && recentEntries.length > 0 && filtered.length > 5 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 12 }]}>RECENTLY UPDATED</Text>
              {recentEntries.map((entry) => {
                const [c1] = grad(entry.website || '');
                return (
                  <TouchableOpacity key={`recent-${entry.id}`} style={[styles.entryRow, { opacity: 0.85 }]} onPress={() => setSelectedId(entry.id)}>
                    <View style={[styles.entryAvatar, { backgroundColor: c1 }]}>
                      <Text style={styles.entryLetter}>{letter(entry.website)}</Text>
                    </View>
                    <View style={styles.entryText}>
                      <Text style={styles.entryTitle} numberOfLines={1}>{entry.website}</Text>
                      <Text style={styles.entryUsername} numberOfLines={1}>{entry.username}</Text>
                    </View>
                    <View style={styles.entryBadge}>
                      <Text style={styles.entryBadgeText}>Recent</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <Text style={[styles.sectionLabel, { marginTop: 12 }]}>ALL ITEMS</Text>
            </>
          )}
          {filtered.map((entry) => {
            const [c1] = grad(entry.website || '');
            const pwAge = entry.password
              ? Math.floor((Date.now() - new Date(entry.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            const entryIsStale = entry.type === 'login' && entry.password && pwAge > 90;
            return (
              <TouchableOpacity key={entry.id} style={styles.entryRow} onPress={() => setSelectedId(entry.id)}>
                <View style={[styles.entryAvatar, { backgroundColor: c1 }]}>
                  <Text style={styles.entryLetter}>{letter(entry.website)}</Text>
                </View>
                <View style={styles.entryText}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.entryTitle} numberOfLines={1}>{entry.website}</Text>
                    {entryIsStale && (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.amber }} />
                    )}
                  </View>
                  <Text style={styles.entryUsername} numberOfLines={1}>{entry.username}</Text>
                </View>
                <View style={styles.entryBadge}>
                  <Text style={styles.entryBadgeText}>{(entry.type ?? entry.category ?? 'login').toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
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
  searchInput: {
    backgroundColor: COLORS.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
    fontSize: 13, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
  },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  filterTabActive: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.3)' },
  filterTabText: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  filterTabTextActive: { color: COLORS.primary },
  detailCard: {
    backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 12,
  },
  detailRow: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '600', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, color: COLORS.text },
  tagBadge: {
    backgroundColor: 'rgba(139,92,246,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)',
  },
  tagBadgeText: { fontSize: 11, color: COLORS.violet, fontWeight: '500' },
});
