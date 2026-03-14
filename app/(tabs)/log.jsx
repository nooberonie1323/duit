import { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getActiveCycle, logDailySpend } from "../../services/db";

const DEFAULT_TAGS = ["Food", "Transport", "Luna", "Emergency", "Fun"];
const today = new Date().toISOString().split("T")[0];

export default function LogScreen() {
  const db = useSQLiteContext();
  const [cycle, setCycle] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [flag, setFlag] = useState(null);

  useFocusEffect(
    useCallback(() => {
      getActiveCycle(db).then(setCycle);
      // Reset form each time screen is focused
      setAmount("");
      setNote("");
      setSelectedTag(null);
      setFlag(null);
    }, [db])
  );

  async function handleSave() {
    if (!amount || isNaN(parseFloat(amount)) || !cycle) return;
    await logDailySpend(
      db,
      cycle.id,
      today,
      parseFloat(amount),
      note || null,
      flag,
      selectedTag ? [selectedTag] : null
    );
    router.replace("/(tabs)");
  }

  const hasAmount = !!amount && !isNaN(parseFloat(amount));

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="flex-row justify-between items-center">
          <Text className="text-text text-xl font-sans-bold">Log Spend</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-textSub font-sans">Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Amount Input */}
        <View className="bg-surface border-2 border-border rounded-card p-4 items-center">
          <Text className="text-textMuted text-xs font-sans mb-2">
            How much did you spend today?
          </Text>
          <View className="flex-row items-center">
            <Text className="text-text text-4xl font-sans-bold">৳</Text>
            <TextInput
              style={{ color: "#111827", fontSize: 48, fontWeight: "800", minWidth: 120 }}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
          </View>
        </View>

        {/* Tags */}
        <View>
          <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest mb-3">
            Tag (optional)
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {DEFAULT_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-4 py-2 rounded-full border ${
                  selectedTag === tag
                    ? "bg-indigo-light border-indigo-mid"
                    : "bg-surface border-border"
                }`}
              >
                <Text
                  className={`text-sm font-sans ${
                    selectedTag === tag ? "text-indigo" : "text-textSub"
                  }`}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Note */}
        <View>
          <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest mb-2">
            Note (optional)
          </Text>
          <TextInput
            className="bg-surface border border-border rounded-card p-4 text-text font-sans text-sm"
            value={note}
            onChangeText={setNote}
            placeholder="What was it for?"
            placeholderTextColor="#9CA3AF"
            multiline
          />
        </View>

        {/* Flag */}
        <View>
          <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest mb-3">
            Flag (optional)
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setFlag(flag === "green" ? null : "green")}
              className={`flex-1 py-3 rounded-card border items-center ${
                flag === "green" ? "bg-green-light border-green" : "bg-surface border-border"
              }`}
            >
              <Text className="text-lg">🟢</Text>
              <Text className={`text-xs font-sans mt-1 ${flag === "green" ? "text-green" : "text-textSub"}`}>
                Good day
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFlag(flag === "red" ? null : "red")}
              className={`flex-1 py-3 rounded-card border items-center ${
                flag === "red" ? "bg-red-light border-red" : "bg-surface border-border"
              }`}
            >
              <Text className="text-lg">🔴</Text>
              <Text className={`text-xs font-sans mt-1 ${flag === "red" ? "text-red" : "text-textSub"}`}>
                Rough day
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={!hasAmount}
          style={{
            backgroundColor: hasAmount ? "#4F46E5" : "#EAECF0",
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: "center",
            elevation: hasAmount ? 6 : 0,
            shadowColor: hasAmount ? "#4F46E5" : "transparent",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: hasAmount ? 0.3 : 0,
            shadowRadius: 8,
          }}
        >
          <Text style={{ color: hasAmount ? "#FFFFFF" : "#9CA3AF", fontWeight: "700", fontSize: 16 }}>
            Save
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
