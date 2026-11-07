/** Items deleted in the last 30 days, ready to restore. */
import { FlatList, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../state/session';
import { Button, Card, Screen } from '../ui/kit';
import { ITEM_TYPE, typeOf } from '../ui/item-types';
import { font, space, useTheme } from '../ui/theme';

export default function Trash() {
  const t = useTheme();
  const { vault, restore } = useSession();
  const items = [...(vault?.trash ?? [])].sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
  return (
    <Screen edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(x) => x.entry.id}
        contentContainerStyle={{ paddingVertical: space.lg }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: space.xxl * 2 }}>
            <Ionicons name="trash-outline" size={40} color={t.textFaint} />
            <Text style={[font.body, { color: t.textDim, marginTop: space.md }]}>Trash is empty.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const kind = typeOf(item.entry);
          const days = Math.max(0, 30 - Math.floor((Date.now() - new Date(item.trashedAt).getTime()) / 86_400_000));
          return (
            <Card style={{ padding: space.lg, marginBottom: space.sm, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={ITEM_TYPE[kind].icon} size={22} color={t.type[kind]} />
              <View style={{ flex: 1, marginHorizontal: space.md }}>
                <Text style={[font.body, { color: t.text, fontWeight: '600' }]} numberOfLines={1}>{item.entry.website || 'Untitled'}</Text>
                <Text style={[font.small, { color: t.textDim }]}>Deleted for good in {days} day{days === 1 ? '' : 's'}</Text>
              </View>
              <Button title="Restore" kind="secondary" onPress={() => void restore(item.entry.id)} style={{ minHeight: 40 }} />
            </Card>
          );
        }}
      />
    </Screen>
  );
}
