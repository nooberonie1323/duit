import { Tabs } from "expo-router";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DailyProvider } from "../../context/DailyContext";

const TAB_CONFIG = {
  index:        { label: "Home",   icon: "home",               iconOff: "home-outline" },
  log:          { label: "Log",    icon: "receipt",            iconOff: "receipt-outline" },
  reservations: { label: "Wallet", icon: "wallet",             iconOff: "wallet-outline" },
  stats:        { label: "Stats",  icon: "bar-chart",          iconOff: "bar-chart-outline" },
  settings:     { label: "More",   icon: "ellipsis-horizontal", iconOff: "ellipsis-horizontal-outline" },
};

function CustomTabBar({ state, navigation }) {
  return (
    <View style={{
      position: "absolute",
      bottom: 16,
      left: 20,
      right: 20,
      height: 60,
      backgroundColor: "#FFFFFF",
      borderRadius: 28,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 10,
    }}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const config = TAB_CONFIG[route.name];
        if (!config) return null;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.7}
            style={{ flex: 1, height: 60, alignItems: "center", justifyContent: "center", gap: 3 }}
          >
            <Ionicons
              name={focused ? config.icon : config.iconOff}
              size={20}
              color={focused ? "#4F46E5" : "#9CA3AF"}
            />
            <Text style={{
              fontSize: 10,
              fontFamily: focused ? "DMSans_600SemiBold" : "DMSans_400Regular",
              color: focused ? "#4F46E5" : "#9CA3AF",
            }}>
              {config.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <DailyProvider>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="log" />
        <Tabs.Screen name="reservations" />
        <Tabs.Screen name="stats" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </DailyProvider>
  );
}
