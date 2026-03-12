import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("21:00");
  const [minThreshold, setMinThreshold] = useState("50");

  function handleReset() {
    Alert.alert(
      "Reset App",
      "This will delete all data including cycles, spending history and reservations. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            // TODO: implement reset
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
        {/* Header */}
        <Text className="text-textPrimary text-xl font-sans-bold">Settings</Text>

        {/* Budget Settings */}
        <View className="bg-surface border border-border rounded-card p-4 gap-4">
          <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest">
            Budget
          </Text>
          <View className="flex-row justify-between items-center">
            <Text className="text-textPrimary font-sans text-sm">
              Minimum daily threshold
            </Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-textSub font-sans text-sm">৳</Text>
              <TextInput
                className="text-textPrimary font-sans-semibold text-sm border border-border rounded-sm px-3 py-1.5 min-w-[60px] text-right"
                value={minThreshold}
                onChangeText={setMinThreshold}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Notification Settings */}
        <View className="bg-surface border border-border rounded-card p-4 gap-4">
          <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest">
            Notifications
          </Text>
          <View className="flex-row justify-between items-center">
            <Text className="text-textPrimary font-sans text-sm">
              End-of-day reminder
            </Text>
            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              trackColor={{ false: "#EAECF0", true: "#4F46E5" }}
              thumbColor="#FFFFFF"
            />
          </View>
          {reminderEnabled && (
            <View className="flex-row justify-between items-center">
              <Text className="text-textPrimary font-sans text-sm">
                Reminder time
              </Text>
              <TextInput
                className="text-textPrimary font-sans-semibold text-sm border border-border rounded-sm px-3 py-1.5"
                value={reminderTime}
                onChangeText={setReminderTime}
                placeholder="21:00"
              />
            </View>
          )}
        </View>

        {/* Reservation Tags */}
        <View className="bg-surface border border-border rounded-card p-4 gap-3">
          <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest">
            Reservation Tags
          </Text>
          {["Food", "Transport", "Luna", "Emergency", "Fun"].map((tag) => (
            <View key={tag} className="flex-row justify-between items-center">
              <Text className="text-textPrimary font-sans text-sm">{tag}</Text>
              <TouchableOpacity>
                <Text className="text-textMuted text-xs font-sans">Rename</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity className="mt-1">
            <Text className="text-indigo font-sans-medium text-sm">+ Add tag</Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View className="bg-surface border border-red-light rounded-card p-4">
          <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest mb-3">
            Danger Zone
          </Text>
          <TouchableOpacity
            onPress={handleReset}
            className="bg-red-light border border-red rounded-btn py-3 items-center"
          >
            <Text className="text-red font-sans-bold text-sm">Reset App</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
