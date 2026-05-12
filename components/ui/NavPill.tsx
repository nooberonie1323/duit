import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ComponentProps, useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const TABS: Array<{ name: string; label: string; icon: IconName }> = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'log', label: 'Log', icon: 'receipt' },
  { name: 'more', label: 'More', icon: 'tune' },
];

function NavTabItem({
  tab,
  focused,
  onPress,
}: {
  tab: (typeof TABS)[number];
  focused: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: 220 });
  }, [focused]);

  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(22,163,74,0)', '#16A34A']
    ),
    paddingHorizontal: interpolate(progress.value, [0, 1], [11, 18]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    maxWidth: interpolate(progress.value, [0, 1], [0, 72]),
    marginLeft: interpolate(progress.value, [0, 1], [0, 7]),
  }));

  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 }}
    >
      <Animated.View style={[chipStyle, {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 100,
        overflow: 'hidden',
        paddingVertical: 10,
      }]}>
        <MaterialIcons
          name={tab.icon}
          size={21}
          color={focused ? '#fff' : '#B0B7C3'}
        />
        <Animated.Text
          numberOfLines={1}
          style={[labelStyle, {
            fontSize: 13,
            fontFamily: 'PlusJakartaSans_700Bold',
            color: '#fff',
            overflow: 'hidden',
          }]}
        >
          {tab.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

export function NavPill({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      position: 'absolute',
      bottom: Math.max(insets.bottom, 16) + 4,
      left: 24,
      right: 24,
      backgroundColor: '#fff',
      borderRadius: 40,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 8,
      shadowColor: '#16A34A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.10,
      shadowRadius: 24,
      elevation: 10,
    }}>
      {TABS.map((tab, index) => (
        <NavTabItem
          key={tab.name}
          tab={tab}
          focused={state.index === index}
          onPress={() => navigation.navigate(tab.name)}
        />
      ))}
    </View>
  );
}
