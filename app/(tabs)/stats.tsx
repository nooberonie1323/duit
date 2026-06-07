import { useThemeColors } from '@/contexts/theme';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>Stats — coming soon</Text>
    </View>
  );
}
