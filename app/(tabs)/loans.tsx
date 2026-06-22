import { useThemeColors } from '@/contexts/theme';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoansScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 16 }}>
      <Text style={{ color: colors.textPrimary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, paddingHorizontal: 20 }}>
        Loans
      </Text>
    </View>
  );
}
