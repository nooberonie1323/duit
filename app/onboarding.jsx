import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { startCycle } from "../services/db";

const TOTAL_STEPS = 5;

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const [step, setStep] = useState(1);

  // Step 1
  const [payDate, setPayDate] = useState("");
  const [nextPayDate, setNextPayDate] = useState("");
  const [income, setIncome] = useState("");

  // Step 2
  const [savings, setSavings] = useState("");

  // Step 3
  const [alreadySpent, setAlreadySpent] = useState("");

  // Step 4 — reservations (handled at cycle start)

  // Step 5
  const [minThreshold, setMinThreshold] = useState("50");

  function canProceed() {
    if (step === 1) return payDate && nextPayDate && income;
    if (step === 2) return savings !== "";
    if (step === 3) return alreadySpent !== "";
    if (step === 5) return minThreshold !== "";
    return true;
  }

  async function handleFinish() {
    await startCycle(db, {
      start_date: payDate,
      end_date: nextPayDate,
      income: parseFloat(income),
      savings_amount: parseFloat(savings) || 0,
      already_spent: parseFloat(alreadySpent) || 0,
      min_daily_threshold: parseFloat(minThreshold) || 50,
    });
    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      {/* Progress bar */}
      <View className="h-1 bg-border mx-5 mt-4 rounded-pill">
        <View
          className="h-1 bg-indigo rounded-pill"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, gap: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-textMuted text-xs font-sans-medium uppercase tracking-widest">
          Step {step} of {TOTAL_STEPS}
        </Text>

        {/* Step 1 — Pay dates + income */}
        {step === 1 && (
          <View className="gap-4">
            <Text className="text-textPrimary text-2xl font-sans-bold">
              When did you get paid?
            </Text>
            <View className="gap-2">
              <Text className="text-textSub text-xs font-sans-medium">Pay date (YYYY-MM-DD)</Text>
              <TextInput
                className="bg-surface border border-border rounded-card p-4 text-textPrimary font-sans"
                value={payDate}
                onChangeText={setPayDate}
                placeholder="2026-03-01"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View className="gap-2">
              <Text className="text-textSub text-xs font-sans-medium">Next expected pay date</Text>
              <TextInput
                className="bg-surface border border-border rounded-card p-4 text-textPrimary font-sans"
                value={nextPayDate}
                onChangeText={setNextPayDate}
                placeholder="2026-04-01"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View className="gap-2">
              <Text className="text-textSub text-xs font-sans-medium">Income this cycle (৳)</Text>
              <TextInput
                className="bg-surface border border-border rounded-card p-4 text-textPrimary font-sans"
                value={income}
                onChangeText={setIncome}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        )}

        {/* Step 2 — Savings */}
        {step === 2 && (
          <View className="gap-4">
            <Text className="text-textPrimary text-2xl font-sans-bold">
              How much are you saving?
            </Text>
            <Text className="text-textSub font-sans text-sm -mt-2">
              This amount is locked away and never touched by daily spending.
            </Text>
            <View className="gap-2">
              <Text className="text-textSub text-xs font-sans-medium">Savings amount (৳)</Text>
              <TextInput
                className="bg-surface border border-border rounded-card p-4 text-textPrimary font-sans"
                value={savings}
                onChangeText={setSavings}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View className="bg-indigo-light border border-indigo-mid rounded-card p-4">
              <Text className="text-indigo font-sans text-sm">
                Enter 0 if you're not setting aside savings this cycle.
              </Text>
            </View>
          </View>
        )}

        {/* Step 3 — Already spent */}
        {step === 3 && (
          <View className="gap-4">
            <Text className="text-textPrimary text-2xl font-sans-bold">
              Already spent anything?
            </Text>
            <Text className="text-textSub font-sans text-sm -mt-2">
              Money you've already spent since getting paid — bills, rent, etc.
            </Text>
            <View className="gap-2">
              <Text className="text-textSub text-xs font-sans-medium">Already spent (৳)</Text>
              <TextInput
                className="bg-surface border border-border rounded-card p-4 text-textPrimary font-sans"
                value={alreadySpent}
                onChangeText={setAlreadySpent}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        )}

        {/* Step 4 — Reservations */}
        {step === 4 && (
          <View className="gap-4">
            <Text className="text-textPrimary text-2xl font-sans-bold">
              Any reservations?
            </Text>
            <Text className="text-textSub font-sans text-sm -mt-2">
              Set aside money for specific things this cycle — vet, subscriptions, etc.
            </Text>
            <View className="bg-indigo-light border border-indigo-mid rounded-card p-4">
              <Text className="text-indigo font-sans text-sm">
                You can manage reservations now or skip and add them from the Reservations tab.
              </Text>
            </View>
            {/* TODO: reservation creation UI */}
            <Text className="text-textMuted font-sans text-sm text-center py-4">
              Reservation creation coming soon.
            </Text>
          </View>
        )}

        {/* Step 5 — Min threshold + summary */}
        {step === 5 && (
          <View className="gap-4">
            <Text className="text-textPrimary text-2xl font-sans-bold">
              Low budget warning
            </Text>
            <Text className="text-textSub font-sans text-sm -mt-2">
              Alert me when my daily budget drops below this amount.
            </Text>
            <View className="gap-2">
              <Text className="text-textSub text-xs font-sans-medium">Minimum daily threshold (৳)</Text>
              <TextInput
                className="bg-surface border border-border rounded-card p-4 text-textPrimary font-sans"
                value={minThreshold}
                onChangeText={setMinThreshold}
                keyboardType="numeric"
                placeholder="50"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Summary */}
            <View className="bg-surface border border-border rounded-card p-4 gap-3 mt-2">
              <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest">
                Summary
              </Text>
              {[
                ["Income", `৳${income || 0}`],
                ["Savings", `৳${savings || 0}`],
                ["Already spent", `৳${alreadySpent || 0}`],
                ["Min threshold", `৳${minThreshold}`],
              ].map(([label, value]) => (
                <View key={label} className="flex-row justify-between">
                  <Text className="text-textSub font-sans text-sm">{label}</Text>
                  <Text className="text-textPrimary font-sans-semibold text-sm">{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Navigation */}
      <View className="flex-row gap-3 px-5 pb-8">
        {step > 1 && (
          <TouchableOpacity
            onPress={() => setStep((s) => s - 1)}
            className="flex-1 bg-surface border border-border rounded-btn py-4 items-center"
          >
            <Text className="text-textPrimary font-sans-bold text-base">Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={step === TOTAL_STEPS ? handleFinish : () => setStep((s) => s + 1)}
          disabled={!canProceed()}
          className={`flex-1 rounded-btn py-4 items-center ${
            canProceed() ? "bg-indigo" : "bg-border"
          }`}
          style={
            canProceed()
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
            className={`font-sans-bold text-base ${canProceed() ? "text-white" : "text-textMuted"}`}
          >
            {step === TOTAL_STEPS ? "Launch Duit" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
