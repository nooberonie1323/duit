import { Tabs } from "expo-router";
import { View, Text } from "react-native";

function TabIcon({ label, focused }) {
  return (
    <View
      className={`items-center justify-center px-3 py-1 rounded-pill ${
        focused ? "bg-indigo-light" : "bg-transparent"
      }`}
    >
      <Text
        className={`text-xs ${
          focused ? "text-indigo font-sans-semibold" : "text-textMuted font-sans"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#EAECF0",
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Log" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Reserve" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Stats" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Settings" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
