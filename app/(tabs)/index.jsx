import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

export default function HomeScreen() {
  const db = useSQLiteContext();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-textMuted text-xs font-sans">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>
            <Text className="text-textPrimary text-lg font-sans-bold mt-0.5">
              Day — of —
            </Text>
          </View>
        </View>

        {/* Daily Budget Card */}
        <View className="bg-surface border border-border rounded-card p-4">
          <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest">
            Today's Budget
          </Text>
          <View className="flex-row items-baseline gap-2 mt-2">
            <Text className="text-textPrimary text-4xl font-sans-extrabold">
              ৳—
            </Text>
          </View>
          <View className="h-px bg-border my-3" />
          <Text className="text-textMuted text-xs font-sans">
            Set up your first pay cycle to get started
          </Text>
        </View>

        {/* Today's Spend */}
        <View className="bg-surface border border-border rounded-card p-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest">
              Spent Today
            </Text>
            <Text className="text-textPrimary text-base font-sans-bold">৳0</Text>
          </View>
          {/* Progress bar */}
          <View className="h-2 bg-border rounded-pill mt-3">
            <View
              className="h-2 bg-indigo rounded-pill"
              style={{ width: "0%" }}
            />
          </View>
        </View>

        {/* Pool Summary */}
        <View className="bg-surface border border-border rounded-card p-4">
          <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest mb-3">
            Cycle Overview
          </Text>
          <View className="flex-row justify-between">
            <View>
              <Text className="text-textMuted text-xs font-sans">Pool Left</Text>
              <Text className="text-textPrimary text-base font-sans-bold mt-0.5">
                ৳—
              </Text>
            </View>
            <View>
              <Text className="text-textMuted text-xs font-sans">Days Left</Text>
              <Text className="text-textPrimary text-base font-sans-bold mt-0.5">
                —
              </Text>
            </View>
            <View>
              <Text className="text-textMuted text-xs font-sans">Avg/Day</Text>
              <Text className="text-textPrimary text-base font-sans-bold mt-0.5">
                ৳—
              </Text>
            </View>
          </View>
        </View>

        {/* Log Spend Button */}
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/log")}
          className="bg-indigo rounded-btn py-4 items-center"
          style={{
            shadowColor: "#4F46E5",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Text className="text-white font-sans-bold text-base">
            Log Today's Spend
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
