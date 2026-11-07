/** Shown for a moment while the saved sign-in is read; the guard moves on from here. */
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../ui/theme';

export default function Starting() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
      <ActivityIndicator color={t.gold} />
    </View>
  );
}
