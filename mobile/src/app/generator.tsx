/** Password generator: length and character sets, copy with one tap. */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_GENERATOR, generatePassword, strengthOf, type GeneratorOptions } from '../core/generator';
import { useSession } from '../state/session';
import { copySecret } from '../services/clipboard';
import { Button, Card, IconButton, Row, Screen, SectionTitle, Toggle } from '../ui/kit';
import { font, radius, space, useTheme } from '../ui/theme';

const LENGTHS = [12, 16, 20, 24, 32, 48];

export default function Generator() {
  const t = useTheme();
  const { prefs, setPrefs } = useSession();
  const [opts, setOpts] = useState<GeneratorOptions>({ ...DEFAULT_GENERATOR, length: prefs.passwordLength });
  const [pw, setPw] = useState('');
  const [copied, setCopied] = useState(false);

  const regenerate = useCallback(() => { setPw(generatePassword(opts)); setCopied(false); }, [opts]);
  useEffect(() => { regenerate(); }, [regenerate]);

  const s = strengthOf(pw);
  const color = { weak: t.danger, fair: t.warn, good: t.gold, strong: t.ok }[s.strength];
  const toggle = (k: 'upper' | 'lower' | 'digits' | 'symbols' | 'avoidAmbiguous') => (v: boolean) => {
    const next = { ...opts, [k]: v };
    if (!next.upper && !next.lower && !next.digits && !next.symbols) return; // keep at least one set
    setOpts(next);
  };

  return (
    <Screen scroll edges={['bottom']}>
      <Card style={{ padding: space.lg, marginTop: space.lg }}>
        <Text selectable style={[font.mono, { color: t.text, fontSize: 20, lineHeight: 30 }]}>{pw}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          <Text style={[font.small, { color, marginLeft: 6, flex: 1 }]}>{s.strength[0].toUpperCase() + s.strength.slice(1)}</Text>
          <IconButton icon="refresh" label="New password" onPress={regenerate} color={t.textDim} />
        </View>
      </Card>
      <Button title={copied ? 'Copied' : 'Copy password'} icon={copied ? 'checkmark' : 'copy-outline'} style={{ marginTop: space.md }}
        onPress={() => { void copySecret(pw, prefs.clipboardSeconds); setCopied(true); }} />

      <SectionTitle>Length</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {LENGTHS.map((n) => (
          <Pressable key={n} onPress={() => { setOpts((o) => ({ ...o, length: n })); void setPrefs({ passwordLength: n }); }}
            style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1,
              borderColor: opts.length === n ? t.gold : t.border, backgroundColor: opts.length === n ? t.goldSoft : t.surface }}>
            <Text style={[font.body, { color: t.text, fontVariant: ['tabular-nums'] }]}>{n}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle>Characters</SectionTitle>
      <Card>
        <Row label="Capital letters (A–Z)" right={<Toggle value={opts.upper} onChange={toggle('upper')} />} />
        <Row label="Small letters (a–z)" right={<Toggle value={opts.lower} onChange={toggle('lower')} />} />
        <Row label="Numbers (0–9)" right={<Toggle value={opts.digits} onChange={toggle('digits')} />} />
        <Row label="Symbols (!@#$…)" right={<Toggle value={opts.symbols} onChange={toggle('symbols')} />} />
        <Row label="Leave out look-alikes (0 O 1 l I)" right={<Toggle value={opts.avoidAmbiguous} onChange={toggle('avoidAmbiguous')} />} last />
      </Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: space.lg }}>
        <Ionicons name="shield-checkmark-outline" size={16} color={t.textDim} />
        <Text style={[font.small, { color: t.textDim, marginLeft: 6, flex: 1, lineHeight: 20 }]}>
          Made on this phone with its secure random number source. Nothing is sent anywhere.
        </Text>
      </View>
    </Screen>
  );
}
