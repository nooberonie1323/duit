import { useState } from "react";
import { View } from "react-native";
import { DailyProvider } from "../../context/DailyContext";
import CustomTabBar from "../../components/CustomTabBar";

import HomeScreen from "./index";
import LogScreen from "./log";
import ReservationsScreen from "./reservations";
import StatsScreen from "./stats";
import SettingsScreen from "./settings";

const SCREENS = {
  index: HomeScreen,
  log: LogScreen,
  reservations: ReservationsScreen,
  stats: StatsScreen,
  settings: SettingsScreen,
};

export default function TabLayout() {
  const [activeTab, setActiveTab] = useState("index");
  const ActiveScreen = SCREENS[activeTab];

  return (
    <DailyProvider>
      <View style={{ flex: 1 }}>
        <ActiveScreen />
        <CustomTabBar activeTab={activeTab} setActiveTab={setActiveTab} />
      </View>
    </DailyProvider>
  );
}
