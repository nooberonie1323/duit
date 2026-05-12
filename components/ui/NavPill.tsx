import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const TABS: Array<{ name: string; label: string; icon: IconName }> = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'log', label: 'Log', icon: 'receipt' },
  { name: 'stats', label: 'Stats', icon: 'show-chart' },
  { name: 'more', label: 'More', icon: 'settings' },
];

export function NavPill({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      position: 'absolute',
      bottom: Math.max(insets.bottom, 16) + 4,
      left: 24,
      right: 24,
      backgroundColor: '#fff',
      borderRadius: 32,
      flexDirection: 'row',
      paddingVertical: 10,
      shadowColor: '#16A34A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 8,
    }}>
      {TABS.map((tab, index) => {
        const focused = state.index === index;
        return (
          <Pressable
            key={tab.name}
            onPress={() => navigation.navigate(tab.name)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 4, gap: 3 }}
          >
            <MaterialIcons
              name={tab.icon}
              size={22}
              color={focused ? '#16A34A' : '#9CA3AF'}
            />
            <Text style={{
              fontSize: 10,
              fontFamily: focused ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_400Regular',
              color: focused ? '#16A34A' : '#9CA3AF',
            }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
