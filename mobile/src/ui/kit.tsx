/** Small building blocks every screen uses. */
import React, { useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { font, radius, space, useTheme } from './theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = false, edges = ['top', 'bottom'], padded = true }: {
  children: React.ReactNode; scroll?: boolean; edges?: Edge[]; padded?: boolean;
}) {
  const t = useTheme();
  const inner = padded ? { paddingHorizontal: space.lg } : null;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[inner, { paddingBottom: space.xxl }]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Button({ title, onPress, kind = 'primary', busy = false, disabled = false, icon, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  busy?: boolean; disabled?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.gold : kind === 'danger' ? t.dangerSoft : kind === 'secondary' ? t.surfaceHi : 'transparent';
  const fg = kind === 'primary' ? t.goldInk : kind === 'danger' ? t.danger : kind === 'ghost' ? t.gold : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={19} color={fg} style={{ marginRight: space.sm }} /> : null}
          <Text style={[font.body, { color: fg, fontWeight: '600' }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, secret = false, error, right, ...input }: TextInputProps & {
  label: string; secret?: boolean; error?: string | null; right?: React.ReactNode;
}) {
  const t = useTheme();
  const [shown, setShown] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[font.small, { color: t.textDim, marginBottom: 6 }]}>{label}</Text>
      <View style={[styles.input, { backgroundColor: t.surface, borderColor: error ? t.danger : focused ? t.gold : t.border }]}>
        <TextInput
          placeholderTextColor={t.textFaint}
          selectionColor={t.gold}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secret && !shown}
          {...input}
          onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
          style={[font.body, { flex: 1, color: t.text, paddingVertical: 12 }, input.multiline ? { minHeight: 96, textAlignVertical: 'top' } : null]}
        />
        {secret ? (
          <Pressable onPress={() => setShown((s) => !s)} hitSlop={10} accessibilityLabel={shown ? 'Hide' : 'Show'}>
            <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={21} color={t.textDim} />
          </Pressable>
        ) : null}
        {right}
      </View>
      {error ? <Text style={[font.small, { color: t.danger, marginTop: 6 }]}>{error}</Text> : null}
    </View>
  );
}

export function Banner({ text, kind = 'info', onPress }: { text: string; kind?: 'info' | 'error' | 'ok'; onPress?: () => void }) {
  const t = useTheme();
  const color = kind === 'error' ? t.danger : kind === 'ok' ? t.ok : t.gold;
  const bg = kind === 'error' ? t.dangerSoft : t.goldSoft;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.banner, { backgroundColor: kind === 'ok' ? `${t.ok}22` : bg }]}>
      <Ionicons name={kind === 'error' ? 'alert-circle' : kind === 'ok' ? 'checkmark-circle' : 'information-circle'} size={18} color={color} />
      <Text style={[font.small, { color: t.text, flex: 1, marginLeft: space.sm }]}>{text}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={[font.small, { color: t.textDim, marginTop: space.xl, marginBottom: space.sm, fontWeight: '600' }]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, overflow: 'hidden' }, style]}>{children}</View>;
}

export function Row({ icon, label, value, onPress, right, danger = false, last = false }: {
  icon?: IconName; label: string; value?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean; last?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.listRow, { backgroundColor: pressed ? t.surfaceHi : 'transparent', borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}
    >
      {icon ? <Ionicons name={icon} size={20} color={danger ? t.danger : t.textDim} style={{ marginRight: space.md }} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { color: danger ? t.danger : t.text }]}>{label}</Text>
        {value ? <Text style={[font.small, { color: t.textDim, marginTop: 2 }]} numberOfLines={2}>{value}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={t.textFaint} /> : null)}
    </Pressable>
  );
}

export function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const t = useTheme();
  return <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: t.gold, false: t.border }} thumbColor={t.dark ? '#F3EFE7' : '#FFFFFF'} />;
}

export function Chip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.chip, { backgroundColor: active ? t.goldSoft : t.surface, borderColor: active ? (color ?? t.gold) : t.border }]}
    >
      <Text style={[font.small, { color: active ? t.text : t.textDim, fontWeight: active ? '600' : '400' }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color }: { icon: IconName; onPress: () => void; label: string; color?: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={label} accessibilityRole="button"
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? t.surfaceHi : 'transparent' }]}>
      <Ionicons name={icon} size={22} color={color ?? t.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  button: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  input: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, gap: space.sm },
  banner: { flexDirection: 'row', alignItems: 'center', padding: space.md, borderRadius: radius.md, marginBottom: space.md },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 14, minHeight: 56 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, marginRight: space.sm },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
