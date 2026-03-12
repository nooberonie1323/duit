import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function StatsScreen() {
  const db = useSQLiteContext();
  const currentYear = new Date().getFullYear();

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
            Stats & Logs
          </Text>
          <Text className="text-textSub font-sans-medium text-sm">{currentYear}</Text>
        </View>

        {/* Year view — month blocks */}
        <View className="flex-row flex-wrap gap-3">
          {MONTHS.map((month) => (
            <TouchableOpacity
              key={month}
              className="bg-surface border border-border rounded-card p-3 items-center"
              style={{ width: "30%" }}
            >
              <Text className="text-textPrimary font-sans-semibold text-sm">
                {month}
              </Text>
              {/* Mini bar chart placeholder */}
              <View className="flex-row items-end gap-0.5 mt-2 h-8">
                {[40, 70, 50, 90, 60].map((h, i) => (
                  <View
                    key={i}
                    className="w-1.5 bg-border rounded-pill"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </View>
              <View className="flex-row gap-2 mt-2">
                <Text className="text-red text-xs font-sans">●0</Text>
                <Text className="text-green text-xs font-sans">●0</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
