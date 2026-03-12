import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";

export default function ReservationsScreen() {
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
          <Text className="text-textPrimary text-xl font-sans-bold">
            Reservations
          </Text>
        </View>

        {/* Empty state */}
        <View className="bg-surface border border-border rounded-card p-6 items-center mt-4">
          <Text className="text-textMuted font-sans text-sm text-center">
            No reservations for this cycle.{"\n"}Set them up when starting a new cycle.
          </Text>
        </View>

        {/* Example reservation card (placeholder) */}
        <View className="bg-surface border border-border rounded-card p-4">
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-pill bg-indigo" />
              <Text className="text-textPrimary font-sans-semibold text-sm">
                Example: Luna Vet
              </Text>
            </View>
            <Text className="text-textSub font-sans text-sm">৳500</Text>
          </View>
          {/* Progress bar */}
          <View className="h-2 bg-border rounded-pill mb-3">
            <View className="h-2 bg-indigo rounded-pill" style={{ width: "40%" }} />
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-textMuted text-xs font-sans">৳200 used of ৳500</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity className="bg-indigo-light border border-indigo-mid rounded-sm px-3 py-1">
                <Text className="text-indigo text-xs font-sans-medium">+ Use</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-surface border border-border rounded-sm px-3 py-1">
                <Text className="text-textSub text-xs font-sans-medium">Release</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
