import { useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getActiveCycle } from "../services/db";

export default function Welcome() {
  const db = useSQLiteContext();

  useEffect(() => {
    async function checkCycle() {
      const cycle = await getActiveCycle(db);
      if (cycle) {
        router.replace("/(tabs)");
      }
    }
    checkCycle();
  }, []);

  return (
    <View className="flex-1 bg-bg px-5 justify-between py-20">

      <View />

      <View className="items-center gap-4">
        <Text className="text-5xl font-extrabold text-indigo tracking-tight"
          style={{ fontFamily: "DMSans_800ExtraBold" }}>
          duit
        </Text>
        <Text className="text-base text-textSub text-center leading-6"
          style={{ fontFamily: "DMSans_400Regular" }}>
          Know exactly what you can spend today.
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => router.push("/onboarding")}
        className="bg-indigo rounded-btn py-4 items-center"
        style={{ shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}
        activeOpacity={0.85}
      >
        <Text className="text-white text-base font-semibold"
          style={{ fontFamily: "DMSans_600SemiBold" }}>
          Get Started
        </Text>
      </TouchableOpacity>

    </View>
  );
}
