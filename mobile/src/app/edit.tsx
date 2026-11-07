/** Add or edit an item. The fields follow the item kind, as on the web. */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PasswordEntry, VaultItemType } from '../core/types';
import { generatePassword, DEFAULT_GENERATOR } from '../core/generator';
import { parseTotp } from '../core/totp';
import { useSession } from '../state/session';
import { onScanned } from '../services/scan-bridge';
import { Banner, Button, Field, IconButton, Screen, SectionTitle } from '../ui/kit';
import { ITEM_TYPE } from '../ui/item-types';
import { font, space, useTheme } from '../ui/theme';

type Draft = Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>;

function blank(type: VaultItemType): Draft {
  return { type, website: '', username: '', password: '', url: '', notes: '', category: 'General', totp: '' };
}

export default function EditScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; type?: VaultItemType }>();
  const { vault, saveEntry, prefs } = useSession();
  const existing = params.id ? vault?.entries.find((e) => e.id === params.id) : undefined;
  const [draft, setDraft] = useState<Draft>(() => {
    if (existing) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing;
      return rest;
    }
    return blank(params.type && ITEM_TYPE[params.type] ? params.type : 'login');
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kind = draft.type ?? 'login';

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setIn = <G extends 'card' | 'identity' | 'bank' | 'wifi' | 'document'>(group: G, k: string, v: string) =>
    setDraft((d) => ({ ...d, [group]: { ...((d[group] as object) ?? {}), [k]: v } }));
  const val = (group: 'card' | 'identity' | 'bank' | 'wifi' | 'document', k: string) =>
    ((draft[group] as Record<string, string> | undefined)?.[k] ?? '');

  // A QR code scanned on the scan screen lands here.
  useEffect(() => onScanned((value) => set('totp', value)), []);

  const save = async () => {
    setError(null);
    if (!draft.website.trim()) { setError('Give it a name.'); return; }
    if (draft.totp && !parseTotp(draft.totp)) { setError('That 2FA secret isn\'t valid. Scan the QR code instead.'); return; }
    setBusy(true);
    try {
      const url = draft.url?.trim();
      await saveEntry({
        ...draft,
        website: draft.website.trim(),
        url: url && kind === 'login' && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? `https://${url}` : url,
        ...(existing ? { id: existing.id } : {}),
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const generate = () => {
    set('password', generatePassword({ ...DEFAULT_GENERATOR, length: prefs.passwordLength }));
  };

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{
        title: existing ? `Edit ${ITEM_TYPE[kind].label.toLowerCase()}` : `New ${ITEM_TYPE[kind].label.toLowerCase()}`,
        headerRight: () => (
          <Pressable onPress={save} disabled={busy} hitSlop={10} accessibilityRole="button">
            <Text style={[font.body, { color: t.gold, fontWeight: '600' }]}>{busy ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        ),
      }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ paddingTop: space.lg }}>
        {error ? <Banner kind="error" text={error} /> : null}

        <Field label="Name" value={draft.website} onChangeText={(v) => set('website', v)} autoCapitalize="sentences"
          placeholder={kind === 'login' ? 'e.g. Gmail' : kind === 'card' ? 'e.g. Monzo debit' : ''} />

        {kind === 'login' ? (
          <>
            <Field label="Username or email" value={draft.username} onChangeText={(v) => set('username', v)} keyboardType="email-address" importantForAutofill="no" />
            <Field label="Password" value={draft.password} onChangeText={(v) => set('password', v)} secret importantForAutofill="no"
              right={<IconButton icon="dice-outline" label="Generate a password" onPress={generate} color={t.gold} />} />
            <Field label="Website" value={draft.url ?? ''} onChangeText={(v) => set('url', v)} keyboardType="url" placeholder="example.com" />
            <Field label="2FA secret (optional)" value={draft.totp ?? ''} onChangeText={(v) => set('totp', v)} placeholder="Scan the QR code or paste the key"
              importantForAutofill="no" right={<IconButton icon="qr-code-outline" label="Scan QR code" onPress={() => router.push('/scan')} color={t.gold} />} />
          </>
        ) : null}

        {kind === 'card' ? (
          <>
            <Field label="Name on card" value={val('card', 'holder')} onChangeText={(v) => setIn('card', 'holder', v)} autoCapitalize="words" />
            <Field label="Card number" value={val('card', 'number')} onChangeText={(v) => setIn('card', 'number', v)} keyboardType="number-pad" secret importantForAutofill="no" />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1 }}><Field label="Expiry (MM/YY)" value={val('card', 'expiry')} onChangeText={(v) => setIn('card', 'expiry', v)} keyboardType="numbers-and-punctuation" maxLength={7} /></View>
              <View style={{ flex: 1 }}><Field label="Security code" value={val('card', 'cvv')} onChangeText={(v) => setIn('card', 'cvv', v)} keyboardType="number-pad" secret maxLength={4} importantForAutofill="no" /></View>
            </View>
            <Field label="PIN" value={val('card', 'pin')} onChangeText={(v) => setIn('card', 'pin', v)} keyboardType="number-pad" secret maxLength={8} importantForAutofill="no" />
            <Field label="Billing postcode" value={val('card', 'postcode')} onChangeText={(v) => setIn('card', 'postcode', v)} autoCapitalize="characters" />
          </>
        ) : null}

        {kind === 'identity' ? (
          <>
            {([['fullName', 'Full name', 'words'], ['email', 'Email'], ['phone', 'Phone'], ['company', 'Company', 'words'], ['address1', 'Address line 1', 'words'],
              ['address2', 'Address line 2', 'words'], ['city', 'Town / city', 'words'], ['postcode', 'Postcode', 'characters'], ['country', 'Country', 'words'],
              ['birthDate', 'Date of birth'], ['documentNumber', 'ID / passport number']] as const).map(([k, label, cap]) => (
              <Field key={k} label={label} value={val('identity', k)} onChangeText={(v) => setIn('identity', k, v)} autoCapitalize={cap ?? 'none'}
                keyboardType={k === 'email' ? 'email-address' : k === 'phone' ? 'phone-pad' : 'default'} />
            ))}
          </>
        ) : null}

        {kind === 'bank' ? (
          <>
            {([['bankName', 'Bank'], ['accountName', 'Account name'], ['accountNumber', 'Account number', true], ['sortCode', 'Sort code'],
              ['iban', 'IBAN', true], ['swift', 'SWIFT / BIC'], ['pin', 'PIN', true], ['branch', 'Branch']] as const).map(([k, label, secret]) => (
              <Field key={k} label={label} value={val('bank', k)} onChangeText={(v) => setIn('bank', k, v)} secret={!!secret}
                autoCapitalize={k === 'iban' || k === 'swift' ? 'characters' : 'words'} importantForAutofill="no" />
            ))}
          </>
        ) : null}

        {kind === 'wifi' ? (
          <>
            <Field label="Network name (SSID)" value={val('wifi', 'ssid')} onChangeText={(v) => setIn('wifi', 'ssid', v)} />
            <Field label="Password" value={draft.password} onChangeText={(v) => set('password', v)} secret importantForAutofill="no"
              right={<IconButton icon="dice-outline" label="Generate a password" onPress={generate} color={t.gold} />} />
            <Field label="Security (e.g. WPA2)" value={val('wifi', 'security')} onChangeText={(v) => setIn('wifi', 'security', v)} autoCapitalize="characters" />
          </>
        ) : null}

        {kind === 'document' ? (
          <>
            {([['fullName', 'Full name'], ['number', 'Document number'], ['issuedBy', 'Issued by'], ['issuedOn', 'Issued on (YYYY-MM-DD)'], ['expiresOn', 'Expires on (YYYY-MM-DD)']] as const).map(([k, label]) => (
              <Field key={k} label={label} value={val('document', k)} onChangeText={(v) => setIn('document', k, v)} autoCapitalize={k === 'fullName' || k === 'issuedBy' ? 'words' : 'none'} />
            ))}
          </>
        ) : null}

        <SectionTitle>Notes</SectionTitle>
        <Field label={kind === 'note' ? 'Note' : 'Notes (optional)'} value={draft.notes ?? ''} onChangeText={(v) => set('notes', v)} multiline autoCapitalize="sentences" />

        {(draft.fields ?? []).length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
            <Ionicons name="information-circle-outline" size={16} color={t.textDim} />
            <Text style={[font.small, { color: t.textDim, marginLeft: 6, flex: 1 }]}>
              This item has {draft.fields!.length} extra field{draft.fields!.length === 1 ? '' : 's'}; they are kept as they are. Edit them on the web.
            </Text>
          </View>
        ) : null}

        <Button title={existing ? 'Save changes' : 'Save to vault'} onPress={save} busy={busy} style={{ marginTop: space.md }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
