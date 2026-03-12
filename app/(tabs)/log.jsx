import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { logDailySpend } from "../../services/db";

const DEFAULT_TAGS = ["Food", "Transport", "Luna", "Emergency", "Fun"];

export default function LogScreen() {
  const db = useSQLiteContext();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [flag, setFlag] = useState(null); // 'green' | 'red' | null

  async function handleSave() {
    if (!amount || isNaN(parseFloat(amount))) return;
    // TODO: get active cycle id and save
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="flex-row justify-between items-center">
          <Text className="text-textPrimary text-xl font-sans-bold">
            Log Spend
          </Text>
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
            <Text className="text-textPrimary text-4xl font-sans-extrabold">৳</Text>
            <TextInput
              className="text-textPrimary text-5xl font-sans-extrabold min-w-[120px]"
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
                className={`px-4 py-2 rounded-pill border ${
                  selectedTag === tag
                    ? "bg-indigo-light border-indigo-mid"
                    : "bg-surface border-border"
                }`}
              >
                <Text
                  className={`text-sm font-sans-medium ${
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
            className="bg-surface border border-border rounded-card p-4 text-textPrimary font-sans text-sm"
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
              <Text className={`text-xs font-sans-medium mt-1 ${flag === "green" ? "text-green" : "text-textSub"}`}>
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
              <Text className={`text-xs font-sans-medium mt-1 ${flag === "red" ? "text-red" : "text-textSub"}`}>
                Rough day
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          className={`rounded-btn py-4 items-center ${
            amount ? "bg-indigo" : "bg-border"
          }`}
          disabled={!amount}
          style={
            amount
              ? {
                  shadowColor: "#4F46E5",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }
              : undefined
          }
        >
          <Text
            className={`font-sans-bold text-base ${amount ? "text-white" : "text-textMuted"}`}
          >
            Save
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
