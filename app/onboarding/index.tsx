import { View, Text } from 'react-native';

/**
 * Page 1 — Welcome
 * Full implementation in Phase 2.
 */
export default function OnboardingWelcome() {
  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#4F46E5' }}>
      <Text className="text-3xl font-bold" style={{ color: '#FFFFFF' }}>Duit</Text>
      <Text className="text-base mt-2" style={{ color: '#C7D2FE' }}>Onboarding — Phase 2</Text>
    </View>
  );
}
