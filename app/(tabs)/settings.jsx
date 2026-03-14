import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { resetDatabase } from "../../services/db";

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [reminderEnabled, setReminderEnabled] = useState(true);

  function handleReset() {
    Alert.alert(
      "Reset App",
      "This will delete all cycles, spending history, and reservations. Cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetDatabase(db);
            router.replace("/onboarding");
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-text text-xl font-sans-bold">Settings</Text>

        {/* Notifications */}
        <View className="bg-surface border border-border rounded-card p-4 gap-4">
          <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest">
            Notifications
          </Text>
          <View className="flex-row justify-between items-center">
            <Text className="text-text font-sans text-sm">End-of-day reminder</Text>
            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              trackColor={{ false: "#EAECF0", true: "#4F46E5" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View className="bg-surface border border-border rounded-card p-4 gap-3">
          <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest">
            Danger Zone
          </Text>
          <Text className="text-textSub font-sans text-sm">
            Use this to reset the app during testing or to start a fresh cycle from scratch.
          </Text>
          <TouchableOpacity
            onPress={handleReset}
            className="bg-red-light border border-red rounded-btn py-3 items-center"
          >
            <Text className="text-red font-sans-bold text-sm">Reset All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
