import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";

function formatDate(date) {
  if (!date) return null;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export default function OnboardingStep1() {
  const [payDate, setPayDate] = useState(null);
  const [nextPayDate, setNextPayDate] = useState(null);
  const [income, setIncome] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);

  const today = new Date();
  const canProceed = payDate && nextPayDate && income.length > 0;

  function openPicker(target) {
    setPickerTarget(target);
    setShowPicker(true);
  }

  function onDateChange(event, selectedDate) {
    setShowPicker(false);
    if (event.type === "set" && selectedDate) {
      if (pickerTarget === "pay") setPayDate(selectedDate);
      else setNextPayDate(selectedDate);
    }
  }

  function handleNext() {
    router.push({
      pathname: "/onboarding2",
      params: {
        payDate: payDate.toISOString(),
        nextPayDate: nextPayDate.toISOString(),
        income,
      },
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 px-5 pt-10">

        {/* Header */}
        <Text
          className="text-3xl text-text mb-2"
          style={{ fontFamily: "DMSans_800ExtraBold" }}
        >
          When did you get paid?
        </Text>
        <Text
          className="text-textSub text-sm mb-10"
          style={{ fontFamily: "DMSans_400Regular" }}
        >
          Set up your pay cycle to get started.
        </Text>

        {/* Last pay date */}
        <View className="mb-5">
          <Text
            className="text-textSub text-xs mb-2"
            style={{ fontFamily: "DMSans_500Medium", letterSpacing: 1 }}
          >
            LAST PAY DATE
          </Text>
          <TouchableOpacity
            onPress={() => openPicker("pay")}
            className="bg-surface border border-border rounded-card p-4 flex-row justify-between items-center"
            activeOpacity={0.7}
          >
            <Text style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 15,
              color: payDate ? "#111827" : "#9CA3AF",
            }}>
              {payDate ? formatDate(payDate) : "Select date"}
            </Text>
            <Text style={{ fontSize: 18 }}>📅</Text>
          </TouchableOpacity>
        </View>

        {/* Next pay date */}
        <View className="mb-5">
          <Text
            className="text-textSub text-xs mb-2"
            style={{ fontFamily: "DMSans_500Medium", letterSpacing: 1 }}
          >
            NEXT EXPECTED PAY DATE
          </Text>
          <TouchableOpacity
            onPress={() => openPicker("next")}
            className="bg-surface border border-border rounded-card p-4 flex-row justify-between items-center"
            activeOpacity={0.7}
          >
            <Text style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 15,
              color: nextPayDate ? "#111827" : "#9CA3AF",
            }}>
              {nextPayDate ? formatDate(nextPayDate) : "Select date"}
            </Text>
            <Text style={{ fontSize: 18 }}>📅</Text>
          </TouchableOpacity>
        </View>

        {/* Income */}
        <View className="mb-5">
          <Text
            className="text-textSub text-xs mb-2"
            style={{ fontFamily: "DMSans_500Medium", letterSpacing: 1 }}
          >
            INCOME THIS CYCLE
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
              value={income}
              onChangeText={(t) => setIncome(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
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

      </View>

      {/* Native date picker */}
      {showPicker && (
        <DateTimePicker
          value={pickerTarget === "pay" ? (payDate || today) : (nextPayDate || today)}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}

      {/* Next button */}
      <View className="px-5 pb-8">
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={canProceed ? 0.85 : 1}
          disabled={!canProceed}
          style={{
            backgroundColor: canProceed ? "#4F46E5" : "#EAECF0",
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: "center",
            elevation: canProceed ? 6 : 0,
            shadowColor: canProceed ? "#4F46E5" : "transparent",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: canProceed ? 0.3 : 0,
            shadowRadius: 8,
          }}
        >
          <Text style={{
            color: canProceed ? "#FFFFFF" : "#9CA3AF",
            fontFamily: "DMSans_600SemiBold",
            fontSize: 16,
          }}>
            Next
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}
