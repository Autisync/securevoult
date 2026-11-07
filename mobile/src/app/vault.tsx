/** The vault: search, filter by kind, one-tap copy, and the + button to add an item. */
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PasswordEntry, VaultItemType } from '../core/types';
import { searchEntries } from '../core/vault-ops';
import { useSession } from '../state/session';
import { autofillEnabled, autofillSupported, openAutofillSettings } from '../services/autofill';
import { copySecret } from '../services/clipboard';
import { LogoMark } from '../ui/Logo';
import { Banner, Chip, IconButton, Screen } from '../ui/kit';
import { ITEM_TYPE, ITEM_TYPES, subtitleOf, typeOf } from '../ui/item-types';
import { font, radius, space, useTheme } from '../ui/theme';

type Filter = 'all' | 'favorites' | VaultItemType;

export default function VaultList() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vault, offline, syncing, refresh, prefs, markUsed, importedFromAutofill, lock, biometric, setBiometric } = useSession();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [hideAutofillTip, setHideAutofillTip] = useState(false);
  const [hideBioTip, setHideBioTip] = useState(false);

  const entries = vault?.entries ?? [];
  const kinds = useMemo(() => ITEM_TYPES.filter((k) => entries.some((e) => typeOf(e) === k.type)), [entries]);

  const shown = useMemo(() => {
    let list = searchEntries(entries, query);
    if (filter === 'favorites') list = list.filter((e) => e.isFavorite);
    else if (filter !== 'all') list = list.filter((e) => typeOf(e) === filter);
    return [...list].sort((a, b) => (a.website || '').localeCompare(b.website || '', undefined, { sensitivity: 'base' }));
  }, [entries, query, filter]);

  const copyPassword = async (e: PasswordEntry) => {
    if (!e.password) return;
    await copySecret(e.password, prefs.clipboardSeconds);
    markUsed(e.id);
    setCopied(e.id);
    setTimeout(() => setCopied((c) => (c === e.id ? null : c)), 1500);
  };

  const showAutofillTip = !hideAutofillTip && prefs.autofill && autofillSupported() && !autofillEnabled();

  return (
    <Screen edges={['top']} padded={false}>
      <View style={[styles.header, { paddingHorizontal: space.lg }]}>
        <LogoMark size={30} dark={t.dark} />
        <Text style={[font.title, { color: t.text, marginLeft: space.sm, flex: 1 }]}>Vault</Text>
        {syncing ? <Ionicons name="sync" size={18} color={t.textDim} style={{ marginRight: space.sm }} /> : null}
        <IconButton icon="lock-closed-outline" label="Lock now" onPress={lock} />
        <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      <View style={{ paddingHorizontal: space.lg }}>
        <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Ionicons name="search" size={18} color={t.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${entries.length} item${entries.length === 1 ? '' : 's'}`}
            placeholderTextColor={t.textFaint}
            selectionColor={t.gold}
            autoCorrect={false}
            autoCapitalize="none"
            style={[font.body, { flex: 1, color: t.text, paddingVertical: 10, marginLeft: space.sm }]}
          />
          {query ? <Ionicons name="close-circle" size={18} color={t.textFaint} onPress={() => setQuery('')} /> : null}
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: space.md }}>
          <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Favourites" active={filter === 'favorites'} onPress={() => setFilter('favorites')} />
          {kinds.map((k) => (
            <Chip key={k.type} label={k.plural} active={filter === k.type} color={t.type[k.type]} onPress={() => setFilter(k.type)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refresh()} tintColor={t.gold} colors={[t.gold]} />}
        ListHeaderComponent={
          <>
            {offline ? <Banner text="Offline. Changes are kept on this phone and upload when you're back online." onPress={() => void refresh()} /> : null}
            {importedFromAutofill > 0 ? <Banner kind="ok" text={`${importedFromAutofill} login${importedFromAutofill === 1 ? '' : 's'} saved from other apps were added.`} /> : null}
            {!hideBioTip && biometric.available && !biometric.enabled ? (
              <Banner text={`Unlock faster: tap to turn on ${biometric.label} unlock.`}
                onPress={() => { setHideBioTip(true); void setBiometric(true).catch(() => undefined); }} />
            ) : null}
            {showAutofillTip ? (
              <Banner text="Fill passwords in other apps and Chrome: tap to choose SecureVoult as your autofill service." onPress={() => { openAutofillSettings(); setHideAutofillTip(true); }} />
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: space.xxl * 2 }}>
            <Ionicons name={query ? 'search-outline' : 'key-outline'} size={40} color={t.textFaint} />
            <Text style={[font.body, { color: t.textDim, marginTop: space.md, textAlign: 'center' }]}>
              {query ? 'Nothing matches that search.' : entries.length ? 'Nothing here yet.' : 'Your vault is empty. Tap + to add your first password.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ItemRow
            entry={item}
            copied={copied === item.id}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
            onCopy={() => void copyPassword(item)}
          />
        )}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add an item"
        onPress={() => setAdding(true)}
        style={({ pressed }) => [styles.fab, { backgroundColor: t.gold, bottom: space.xl + insets.bottom, opacity: pressed ? 0.85 : 1 }]}
      >
        <Ionicons name="add" size={30} color={t.goldInk} />
      </Pressable>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <Pressable style={styles.scrim} onPress={() => setAdding(false)} />
        <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: space.xl + insets.bottom }]}>
          <Text style={[font.heading, { color: t.text, marginBottom: space.md }]}>Add to vault</Text>
          {ITEM_TYPES.map((k) => (
            <Pressable
              key={k.type}
              onPress={() => { setAdding(false); router.push({ pathname: '/edit', params: { type: k.type } }); }}
              style={({ pressed }) => [styles.sheetRow, { backgroundColor: pressed ? t.surfaceHi : 'transparent' }]}
            >
              <View style={[styles.tile, { backgroundColor: `${t.type[k.type]}22` }]}>
                <Ionicons name={k.icon} size={20} color={t.type[k.type]} />
              </View>
              <Text style={[font.body, { color: t.text, marginLeft: space.md }]}>{k.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => { setAdding(false); router.push('/generator'); }} style={({ pressed }) => [styles.sheetRow, { backgroundColor: pressed ? t.surfaceHi : 'transparent' }]}>
            <View style={[styles.tile, { backgroundColor: t.goldSoft }]}>
              <Ionicons name="dice-outline" size={20} color={t.gold} />
            </View>
            <Text style={[font.body, { color: t.text, marginLeft: space.md }]}>Generate a password</Text>
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
}

function ItemRow({ entry, copied, onPress, onCopy }: { entry: PasswordEntry; copied: boolean; onPress: () => void; onCopy: () => void }) {
  const t = useTheme();
  const kind = typeOf(entry);
  const color = t.type[kind];
  const letter = (entry.website || '?').trim()[0]?.toUpperCase() ?? '?';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, { backgroundColor: pressed ? t.surfaceHi : t.surface, borderColor: t.border }]}>
      <View style={[styles.tile, { backgroundColor: `${color}22` }]}>
        {kind === 'login'
          ? <Text style={{ color, fontWeight: '700', fontSize: 17 }}>{letter}</Text>
          : <Ionicons name={ITEM_TYPE[kind].icon} size={20} color={color} />}
      </View>
      <View style={{ flex: 1, marginLeft: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[font.body, { color: t.text, fontWeight: '600', flexShrink: 1 }]} numberOfLines={1}>{entry.website || 'Untitled'}</Text>
          {entry.isFavorite ? <Ionicons name="star" size={13} color={t.gold} style={{ marginLeft: 6 }} /> : null}
        </View>
        <Text style={[font.small, { color: t.textDim, marginTop: 2 }]} numberOfLines={1}>{subtitleOf(entry) || ' '}</Text>
      </View>
      {kind === 'login' && entry.password ? (
        <IconButton icon={copied ? 'checkmark' : 'copy-outline'} label={`Copy password for ${entry.website}`} onPress={onCopy} color={copied ? t.ok : t.textDim} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: space.sm, paddingBottom: space.md },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  item: { flexDirection: 'row', alignItems: 'center', padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: space.sm },
  tile: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: space.xl, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { padding: space.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: space.sm, borderRadius: radius.md },
});
