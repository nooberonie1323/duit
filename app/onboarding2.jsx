import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

export default function OnboardingStep2() {
  const params = useLocalSearchParams();
  const [savings, setSavings] = useState("");

  const hasValue = savings.length > 0;

  function handleNext() {
    router.push({
      pathname: "/onboarding3",
      params: {
        ...params,
        savings: savings || "0",
      },
    });
  }

  function handleBack() {
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 px-5 pt-10">

        {/* Header */}
        <Text
          className="text-3xl text-text mb-2"
          style={{ fontFamily: "DMSans_800ExtraBold" }}
        >
          How much are you saving?
        </Text>
        <Text
          className="text-textSub text-sm mb-10"
          style={{ fontFamily: "DMSans_400Regular" }}
        >
          This amount is locked away and never touched by your daily spending.
        </Text>

        {/* Savings input */}
        <View className="mb-5">
          <Text
            className="text-textSub text-xs mb-2"
            style={{ fontFamily: "DMSans_500Medium", letterSpacing: 1 }}
          >
            SAVINGS AMOUNT
          </Text>
          <View className="bg-surface border border-border rounded-card p-4 flex-row items-center">
            <Text style={{
              fontFamily: "DMSans_400Regular",
              color: "#6B7280",
              fontSize: 15,
              marginRight: 6,
            }}>
              ৳
            </Text>
            <TextInput
              value={savings}
              onChangeText={(t) => setSavings(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              style={{
                fontFamily: "DMSans_400Regular",
                color: "#111827",
                fontSize: 15,
                flex: 1,
              }}
            />
          </View>
        </View>

        {/* Info callout */}
        <View
          className="rounded-card p-4"
          style={{ backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE" }}
        >
          <Text style={{
            fontFamily: "DMSans_400Regular",
            color: "#4F46E5",
            fontSize: 13,
          }}>
            Not saving this cycle? Just tap Skip — you can always set this up later.
          </Text>
        </View>

      </View>

      {/* Back + Skip/Next buttons */}
      <View className="flex-row gap-3 px-5 pb-8">
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.8}
          style={{
            flex: 1,
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#EAECF0",
          }}
        >
          <Text style={{
            color: "#111827",
            fontFamily: "DMSans_600SemiBold",
            fontSize: 16,
          }}>
            Back
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.85}
          style={{
            flex: 1,
            backgroundColor: "#4F46E5",
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: "center",
            elevation: 6,
            shadowColor: "#4F46E5",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }}
        >
          <Text style={{
            color: "#FFFFFF",
            fontFamily: "DMSans_600SemiBold",
            fontSize: 16,
          }}>
            {hasValue ? "Next" : "Skip"}
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}
