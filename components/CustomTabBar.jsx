import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const TABS = [
  { name: "index",        label: "Home",   icon: "home",                iconOff: "home-outline" },
  { name: "log",          label: "Log",    icon: "receipt",             iconOff: "receipt-outline" },
  { name: "reservations", label: "Wallet", icon: "wallet",              iconOff: "wallet-outline" },
  { name: "stats",        label: "Stats",  icon: "bar-chart",           iconOff: "bar-chart-outline" },
  { name: "settings",     label: "More",   icon: "ellipsis-horizontal", iconOff: "ellipsis-horizontal-outline" },
];

export default function CustomTabBar({ activeTab, setActiveTab }) {
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
      {TABS.map((tab) => {
        const focused = activeTab === tab.name;
        return (
          <Pressable
            key={tab.name}
            onPress={() => setActiveTab(tab.name)}
            style={{ flex: 1, height: 60, alignItems: "center", justifyContent: "center", gap: 3 }}
          >
            <Ionicons
              name={focused ? tab.icon : tab.iconOff}
              size={20}
              color={focused ? "#4F46E5" : "#9CA3AF"}
            />
            <Text style={{
              fontSize: 10,
              fontFamily: focused ? "DMSans_600SemiBold" : "DMSans_400Regular",
              color: focused ? "#4F46E5" : "#9CA3AF",
            }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
