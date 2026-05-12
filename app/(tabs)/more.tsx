import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 13, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' }}>More — coming soon</Text>
    </View>
  );
}
