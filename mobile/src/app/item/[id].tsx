/** One item: every field with copy and reveal, a live 2FA code, and edit / delete. */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PasswordEntry } from '../../core/types';
import { formatCode, parseTotp, totpNow } from '../../core/totp';
import { strengthOf } from '../../core/generator';
import { useSession } from '../../state/session';
import { copySecret } from '../../services/clipboard';
import { Button, Card, IconButton, Screen, SectionTitle } from '../../ui/kit';
import { ITEM_TYPE, hostLabel, typeOf } from '../../ui/item-types';
import { font, space, useTheme } from '../../ui/theme';

interface FieldDef { label: string; value?: string; secret?: boolean; mono?: boolean; link?: boolean }

function fieldsOf(e: PasswordEntry): FieldDef[] {
  switch (typeOf(e)) {
    case 'login': return [
      { label: 'Username', value: e.username },
      { label: 'Password', value: e.password, secret: true, mono: true },
      { label: 'Website', value: e.url, link: true },
      ...(e.urls ?? []).map((u) => ({ label: 'Also used on', value: u, link: true })),
    ];
    case 'card': return [
      { label: 'Name on card', value: e.card?.holder },
      { label: 'Card number', value: e.card?.number, secret: true, mono: true },
      { label: 'Expiry', value: e.card?.expiry },
      { label: 'Security code', value: e.card?.cvv, secret: true, mono: true },
      { label: 'PIN', value: e.card?.pin, secret: true, mono: true },
      { label: 'Billing postcode', value: e.card?.postcode },
    ];
    case 'identity': {
      const i = e.identity ?? {};
      return [
        { label: 'Full name', value: i.fullName }, { label: 'Email', value: i.email }, { label: 'Phone', value: i.phone },
        { label: 'Company', value: i.company },
        { label: 'Address', value: [i.address1, i.address2, i.city, i.state, i.postcode, i.country].filter(Boolean).join(', ') },
        { label: 'Date of birth', value: i.birthDate }, { label: 'Document number', value: i.documentNumber, secret: true },
      ];
    }
    case 'bank': {
      const b = e.bank ?? {};
      return [
        { label: 'Bank', value: b.bankName }, { label: 'Account name', value: b.accountName },
        { label: 'Account number', value: b.accountNumber, secret: true, mono: true }, { label: 'Sort code', value: b.sortCode, mono: true },
        { label: 'IBAN', value: b.iban, secret: true, mono: true }, { label: 'SWIFT / BIC', value: b.swift, mono: true },
        { label: 'PIN', value: b.pin, secret: true, mono: true }, { label: 'Branch', value: b.branch },
      ];
    }
    case 'wifi': return [
      { label: 'Network name', value: e.wifi?.ssid }, { label: 'Password', value: e.password, secret: true, mono: true },
      { label: 'Security', value: e.wifi?.security },
    ];
    case 'document': {
      const d = e.document ?? {};
      return [
        { label: 'Full name', value: d.fullName }, { label: 'Number', value: d.number, secret: true, mono: true },
        { label: 'Issued by', value: d.issuedBy }, { label: 'Issued on', value: d.issuedOn }, { label: 'Expires on', value: d.expiresOn },
      ];
    }
    default: return [];
  }
}

export default function ItemScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { vault, prefs, markUsed, toggleFavorite, deleteEntry } = useSession();
  const entry = vault?.entries.find((e) => e.id === id);

  if (!entry) {
    return (
      <Screen>
        <Text style={[font.body, { color: t.textDim, marginTop: space.xl }]}>This item is no longer in your vault.</Text>
      </Screen>
    );
  }

  const kind = typeOf(entry);
  const copy = (v: string) => { void copySecret(v, prefs.clipboardSeconds); markUsed(entry.id); };
  const confirmDelete = () => Alert.alert('Move to Trash?', `"${entry.website}" can be restored from Trash for 30 days.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Move to Trash', style: 'destructive', onPress: () => { void deleteEntry(entry.id); router.back(); } },
  ]);

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{
        title: '',
        headerRight: () => (
          <View style={{ flexDirection: 'row' }}>
            <IconButton icon={entry.isFavorite ? 'star' : 'star-outline'} color={entry.isFavorite ? t.gold : t.text}
              label={entry.isFavorite ? 'Remove from favourites' : 'Add to favourites'} onPress={() => void toggleFavorite(entry.id)} />
            <IconButton icon="create-outline" label="Edit" onPress={() => router.push({ pathname: '/edit', params: { id: entry.id } })} />
          </View>
        ),
      }} />

      <View style={styles.hero}>
        <View style={[styles.heroTile, { backgroundColor: `${t.type[kind]}22` }]}>
          <Ionicons name={ITEM_TYPE[kind].icon} size={28} color={t.type[kind]} />
        </View>
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={[font.title, { color: t.text, fontSize: 22 }]} numberOfLines={2}>{entry.website || 'Untitled'}</Text>
          <Text style={[font.small, { color: t.textDim, marginTop: 2 }]}>{ITEM_TYPE[kind].label}{entry.category && entry.category !== 'General' ? ` · ${entry.category}` : ''}</Text>
        </View>
      </View>

      <Card>
        {fieldsOf(entry).filter((f) => f.value).map((f, i, arr) => (
          <FieldRow key={`${f.label}${i}`} field={f} last={i === arr.length - 1 && !entry.totp} onCopy={copy} />
        ))}
        {entry.totp ? <TotpRow secret={entry.totp} onCopy={copy} /> : null}
      </Card>

      {kind === 'login' && entry.password ? <StrengthLine password={entry.password} /> : null}

      {(entry.fields ?? []).length ? (
        <>
          <SectionTitle>More fields</SectionTitle>
          <Card>
            {(entry.fields ?? []).map((f, i, arr) => (
              <FieldRow key={i} field={{ label: f.label || 'Field', value: f.value, secret: f.hidden }} last={i === arr.length - 1} onCopy={copy} />
            ))}
          </Card>
        </>
      ) : null}

      {entry.notes ? (
        <>
          <SectionTitle>Notes</SectionTitle>
          <Card style={{ padding: space.lg }}>
            <Text selectable style={[font.body, { color: t.text, lineHeight: 23 }]}>{entry.notes}</Text>
          </Card>
        </>
      ) : null}

      {(entry.passwordHistory ?? []).length ? <PasswordHistory entry={entry} onCopy={copy} /> : null}

      {(entry.attachments ?? []).length ? (
        <Text style={[font.small, { color: t.textFaint, marginTop: space.lg }]}>
          {entry.attachments!.length} attached file{entry.attachments!.length === 1 ? '' : 's'}: open them on the web for now.
        </Text>
      ) : null}

      <Text style={[font.tiny, { color: t.textFaint, marginTop: space.xl }]}>
        Last changed {new Date(entry.updatedAt).toLocaleString()}
      </Text>
      <Button title="Move to Trash" kind="danger" icon="trash-outline" onPress={confirmDelete} style={{ marginTop: space.lg }} />
    </Screen>
  );
}

function FieldRow({ field, last, onCopy }: { field: FieldDef; last: boolean; onCopy: (v: string) => void }) {
  const t = useTheme();
  const [shown, setShown] = useState(false);
  const value = field.value ?? '';
  const display = field.secret && !shown ? '•'.repeat(Math.min(12, Math.max(8, value.length))) : value;
  const openLink = () => {
    const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    if (/^https?:\/\//i.test(url)) void Linking.openURL(url);
  };
  return (
    <Pressable onPress={() => onCopy(value)} onLongPress={field.secret ? () => setShown((s) => !s) : undefined}
      style={({ pressed }) => [styles.field, { backgroundColor: pressed ? t.surfaceHi : 'transparent', borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1 }}>
        <Text style={[font.tiny, { color: t.textDim, marginBottom: 3 }]}>{field.label}</Text>
        <Text selectable={!field.secret || shown} style={[field.mono ? font.mono : font.body, { color: field.link ? t.gold : t.text }]}>
          {field.link ? hostLabel(value) || value : display}
        </Text>
      </View>
      {field.secret ? <IconButton icon={shown ? 'eye-off-outline' : 'eye-outline'} label={shown ? 'Hide' : 'Show'} onPress={() => setShown((s) => !s)} color={t.textDim} /> : null}
      {field.link ? <IconButton icon="open-outline" label="Open website" onPress={openLink} color={t.textDim} /> : null}
      <IconButton icon="copy-outline" label={`Copy ${field.label}`} onPress={() => onCopy(value)} color={t.textDim} />
    </Pressable>
  );
}

function TotpRow({ secret, onCopy }: { secret: string; onCopy: (v: string) => void }) {
  const t = useTheme();
  const cfg = useMemo(() => parseTotp(secret), [secret]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!cfg) {
    return (
      <View style={styles.field}>
        <Text style={[font.small, { color: t.danger }]}>The 2FA secret on this item can't be read. Edit it to fix it.</Text>
      </View>
    );
  }
  const { code, remaining } = totpNow(cfg, now);
  const urgent = remaining <= 5;
  return (
    <Pressable onPress={() => onCopy(code)} style={({ pressed }) => [styles.field, { backgroundColor: pressed ? t.surfaceHi : 'transparent' }]}>
      <View style={{ flex: 1 }}>
        <Text style={[font.tiny, { color: t.textDim, marginBottom: 3 }]}>2FA code</Text>
        <Text style={[font.mono, { color: urgent ? t.warn : t.gold, fontSize: 24, letterSpacing: 2 }]}>{formatCode(code)}</Text>
      </View>
      <View style={[styles.countdown, { borderColor: urgent ? t.warn : t.border }]}>
        <Text style={[font.small, { color: urgent ? t.warn : t.textDim, fontVariant: ['tabular-nums'] }]}>{remaining}</Text>
      </View>
      <IconButton icon="copy-outline" label="Copy 2FA code" onPress={() => onCopy(code)} color={t.textDim} />
    </Pressable>
  );
}

function StrengthLine({ password }: { password: string }) {
  const t = useTheme();
  const { strength } = strengthOf(password);
  const color = { weak: t.danger, fair: t.warn, good: t.gold, strong: t.ok }[strength];
  const text = { weak: 'Weak password: change it', fair: 'Fair password', good: 'Good password', strong: 'Strong password' }[strength];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md }}>
      <Ionicons name={strength === 'weak' ? 'warning-outline' : 'shield-checkmark-outline'} size={15} color={color} />
      <Text style={[font.small, { color, marginLeft: 6 }]}>{text}</Text>
    </View>
  );
}

function PasswordHistory({ entry, onCopy }: { entry: PasswordEntry; onCopy: (v: string) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.xl }}>
        <Text style={[font.small, { color: t.textDim, fontWeight: '600', flex: 1 }]}>Password history ({entry.passwordHistory!.length})</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={t.textDim} />
      </Pressable>
      {open ? (
        <Card style={{ marginTop: space.sm }}>
          {entry.passwordHistory!.map((h, i, arr) => (
            <FieldRow key={i} last={i === arr.length - 1} onCopy={onCopy}
              field={{ label: `Used until ${new Date(h.changedAt).toLocaleDateString()}`, value: h.password, secret: true, mono: true }} />
          ))}
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', marginVertical: space.lg },
  heroTile: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, paddingRight: space.xs, paddingVertical: 10, minHeight: 64 },
  countdown: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
