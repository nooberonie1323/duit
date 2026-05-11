import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }}
    >
      {/* Decorative background blobs */}
      <View className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary-light opacity-60" style={{ transform: [{ translateX: 80 }, { translateY: -80 }] }} />
      <View className="absolute top-32 right-8 w-32 h-32 rounded-full bg-primary opacity-10" />

      {/* Main content */}
      <View className="flex-1 justify-center px-8">
        {/* Logo mark — two overlapping circles suggesting a leaf */}
        <View className="mb-8">
          <View className="w-16 h-16 rounded-full bg-primary-light items-center justify-center">
            <View className="w-10 h-10 rounded-full bg-primary opacity-80" />
          </View>
        </View>

        {/* Wordmark */}
        <Text
          className="text-6xl text-primary mb-3"
          style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
        >
          Duit.
        </Text>

        {/* Tagline */}
        <Text
          className="text-xl text-text-secondary leading-relaxed"
          style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
        >
          How much can I{'\n'}spend today?
        </Text>
      </View>

      {/* Bottom CTA */}
      <View className="px-6 pb-4">
        <Pressable
          onPress={() => router.push('/onboarding/basics')}
          className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text
            className="text-white text-lg"
            style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
          >
            Get Started
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
