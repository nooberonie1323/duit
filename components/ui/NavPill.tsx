import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const TABS: Array<{ name: string; label: string; icon: IconName }> = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'log', label: 'Log', icon: 'receipt' },
  { name: 'more', label: 'More', icon: 'tune' },
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
      {TABS.map((tab, index) => {
        const focused = state.index === index;
        return (
          <Pressable
            key={tab.name}
            onPress={() => navigation.navigate(tab.name)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: focused ? 7 : 0,
              backgroundColor: focused ? '#16A34A' : 'transparent',
              borderRadius: 100,
              overflow: 'hidden',
              paddingHorizontal: focused ? 20 : 14,
              paddingVertical: 10,
            }}>
              <MaterialIcons
                name={tab.icon}
                size={21}
                color={focused ? '#fff' : '#B0B7C3'}
              />
              {focused && (
                <Text style={{
                  fontSize: 13,
                  fontFamily: 'PlusJakartaSans_700Bold',
                  color: '#fff',
                  letterSpacing: 0.1,
                }}>
                  {tab.label}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
