import { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  Modal, Pressable, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import {
  startCycle, createReservation, createReservationTag, getReservationTags,
} from "../services/db";

function formatDateStr(isoString) {
  const date = new Date(isoString);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function fmt(amount) {
  return `৳${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function OnboardingStep5() {
  const params = useLocalSearchParams();
  const db = useSQLiteContext();

  const [saving, setSaving] = useState(false);
  const [spentOpen, setSpentOpen] = useState(false);
  const [reservationsOpen, setReservationsOpen] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  // Parse all collected data
  const income = parseFloat(params.income || "0");
  const savings = parseFloat(params.savings || "0");
  const alreadySpent = parseFloat(params.alreadySpent || "0");
  const expenses = JSON.parse(params.expenses || "[]");
  const reservations = JSON.parse(params.reservations || "[]");

  const payDate = new Date(params.payDate);
  const nextPayDate = new Date(params.nextPayDate);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  nextPayDate.setHours(0, 0, 0, 0);

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.floor((nextPayDate - payDate) / msPerDay) + 1);
  const remainingDays = Math.max(1, Math.floor((nextPayDate - today) / msPerDay) + 1);

  const reservationsTotal = reservations.reduce((sum, r) => sum + r.amount, 0);
  const budgetPool = income - savings - alreadySpent - reservationsTotal;
  const dailyBudget = budgetPool / remainingDays;
  const isLow = dailyBudget < 50 || budgetPool <= 0;

  async function save() {
    setSaving(true);
    try {
      const cycleId = await startCycle(db, {
        start_date: params.payDate.split("T")[0],
        end_date: params.nextPayDate.split("T")[0],
        income,
        savings_amount: savings,
        already_spent: alreadySpent,
        min_daily_threshold: 50,
      });

      if (reservations.length > 0) {
        const existingTags = await getReservationTags(db);
        for (const reservation of reservations) {
          const existing = existingTags.find(
            (t) => t.name.toLowerCase() === reservation.name.toLowerCase()
          );
          const tagId = existing
            ? existing.id
            : await createReservationTag(db, reservation.name);
          await createReservation(db, cycleId, tagId, reservation.amount);
        }
      }

      router.replace("/(tabs)");
    } catch (e) {
      setSaving(false);
    }
  }

  function handleLaunch() {
    if (isLow) {
      setShowWarning(true);
    } else {
      save();
    }
  }

  const Row = ({ label, value, bold, valueColor }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <Text style={{ fontFamily: bold ? "DMSans_600SemiBold" : "DMSans_400Regular", color: "#6B7280", fontSize: 14 }}>
        {label}
      </Text>
      <Text style={{ fontFamily: bold ? "DMSans_700Bold" : "DMSans_500Medium", color: valueColor || "#111827", fontSize: bold ? 18 : 14 }}>
        {value}
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="flex-1 px-5 pt-10" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Text className="text-3xl text-text mb-2" style={{ fontFamily: "DMSans_800ExtraBold" }}>
          Here's your summary
        </Text>
        <Text className="text-textSub text-sm mb-8" style={{ fontFamily: "DMSans_400Regular" }}>
          Review everything before we set it up.
        </Text>

        {/* Summary card */}
        <View style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 16, padding: 20, marginBottom: 12 }}>

          {/* Cycle dates */}
          <Row label="Pay cycle" value={`${formatDateStr(params.payDate)} → ${formatDateStr(params.nextPayDate)}`} />
          <Row label="Total days in cycle" value={`${totalDays} days`} />
          <Row label="Days remaining" value={`${remainingDays} days`} />

          <View style={{ height: 1, backgroundColor: "#EAECF0", marginBottom: 14 }} />

          {/* Income & savings */}
          <Row label="Income" value={fmt(income)} />
          <Row label="Savings" value={fmt(savings)} />

          {/* Already spent accordion */}
          <TouchableOpacity
            onPress={() => expenses.length > 0 && setSpentOpen((o) => !o)}
            activeOpacity={expenses.length > 0 ? 0.7 : 1}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spentOpen ? 10 : 14 }}
          >
            <Text style={{ fontFamily: "DMSans_400Regular", color: "#6B7280", fontSize: 14 }}>Already spent</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontFamily: "DMSans_500Medium", color: "#111827", fontSize: 14 }}>{fmt(alreadySpent)}</Text>
              {expenses.length > 0 && (
                <Ionicons name={spentOpen ? "chevron-up" : "chevron-down"} size={14} color="#9CA3AF" />
              )}
            </View>
          </TouchableOpacity>
          {spentOpen && (
            <View style={{ marginBottom: 14 }}>
              {expenses.map((e, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingLeft: 14, marginBottom: 6 }}>
                  <Text style={{ fontFamily: "DMSans_400Regular", color: "#9CA3AF", fontSize: 13 }}>└ {e.name}</Text>
                  <Text style={{ fontFamily: "DMSans_400Regular", color: "#9CA3AF", fontSize: 13 }}>{fmt(e.amount)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Reservations accordion */}
          <TouchableOpacity
            onPress={() => reservations.length > 0 && setReservationsOpen((o) => !o)}
            activeOpacity={reservations.length > 0 ? 0.7 : 1}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: reservationsOpen ? 10 : 14 }}
          >
            <Text style={{ fontFamily: "DMSans_400Regular", color: "#6B7280", fontSize: 14 }}>Reservations</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontFamily: "DMSans_500Medium", color: "#111827", fontSize: 14 }}>{fmt(reservationsTotal)}</Text>
              {reservations.length > 0 && (
                <Ionicons name={reservationsOpen ? "chevron-up" : "chevron-down"} size={14} color="#9CA3AF" />
              )}
            </View>
          </TouchableOpacity>
          {reservationsOpen && (
            <View style={{ marginBottom: 14 }}>
              {reservations.map((r, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingLeft: 14, marginBottom: 6 }}>
                  <Text style={{ fontFamily: "DMSans_400Regular", color: "#9CA3AF", fontSize: 13 }}>└ {r.name}</Text>
                  <Text style={{ fontFamily: "DMSans_400Regular", color: "#9CA3AF", fontSize: 13 }}>{fmt(r.amount)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 1, backgroundColor: "#EAECF0", marginBottom: 14 }} />

          {/* Daily budget */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#111827", fontSize: 15 }}>Daily budget</Text>
            <Text style={{ fontFamily: "DMSans_800ExtraBold", color: isLow ? "#DC2626" : "#4F46E5", fontSize: 22 }}>
              {fmt(Math.max(0, dailyBudget))}/day
            </Text>
          </View>

        </View>

        {/* Low budget inline warning */}
        {isLow && (
          <View style={{ backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#DC2626", borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#DC2626", fontSize: 14, marginBottom: 4 }}>
              Your daily budget looks very low
            </Text>
            <Text style={{ fontFamily: "DMSans_400Regular", color: "#DC2626", fontSize: 13, lineHeight: 20 }}>
              Your savings, expenses, or reservations may be leaving very little to spend each day. Tap "Launch Duit" to review before confirming.
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Back + Launch buttons */}
      <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          style={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#EAECF0" }}
        >
          <Text style={{ color: "#111827", fontFamily: "DMSans_600SemiBold", fontSize: 16 }}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLaunch}
          disabled={saving}
          activeOpacity={0.85}
          style={{ flex: 1, backgroundColor: "#4F46E5", borderRadius: 12, paddingVertical: 16, alignItems: "center", elevation: 6, shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
        >
          {saving
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={{ color: "#FFFFFF", fontFamily: "DMSans_600SemiBold", fontSize: 16 }}>Launch Duit</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Low budget warning modal */}
      <Modal
        visible={showWarning}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWarning(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}
          onPress={() => setShowWarning(false)}
        >
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24 }}>

              <Text style={{ fontFamily: "DMSans_700Bold", color: "#111827", fontSize: 18, marginBottom: 6 }}>
                Before you continue
              </Text>
              <Text style={{ fontFamily: "DMSans_400Regular", color: "#6B7280", fontSize: 14, lineHeight: 22, marginBottom: 20 }}>
                Based on what you entered, you'd have {fmt(Math.max(0, dailyBudget))} per day to spend. That's quite low — is everything correct?
              </Text>

              {/* Breakdown */}
              <View style={{ backgroundColor: "#F8F9FB", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                {[
                  { label: "Income", value: income },
                  savings > 0 && { label: "Savings", value: -savings },
                  alreadySpent > 0 && { label: "Already spent", value: -alreadySpent },
                  reservationsTotal > 0 && { label: "Reservations", value: -reservationsTotal },
                ].filter(Boolean).map((item, i) => (
                  <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ fontFamily: "DMSans_400Regular", color: "#6B7280", fontSize: 13 }}>{item.label}</Text>
                    <Text style={{ fontFamily: "DMSans_500Medium", color: item.value < 0 ? "#DC2626" : "#111827", fontSize: 13 }}>
                      {item.value < 0 ? `−${fmt(item.value)}` : fmt(item.value)}
                    </Text>
                  </View>
                ))}
                <View style={{ height: 1, backgroundColor: "#EAECF0", marginVertical: 8 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#111827", fontSize: 13 }}>Daily budget</Text>
                  <Text style={{ fontFamily: "DMSans_700Bold", color: "#DC2626", fontSize: 13 }}>
                    {fmt(Math.max(0, dailyBudget))}/day
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => { setShowWarning(false); save(); }}
                activeOpacity={0.85}
                style={{ backgroundColor: "#4F46E5", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 10 }}
              >
                <Text style={{ color: "#FFFFFF", fontFamily: "DMSans_600SemiBold", fontSize: 15 }}>
                  Looks right, continue
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowWarning(false)}
                activeOpacity={0.8}
                style={{ backgroundColor: "#FFFFFF", borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#EAECF0" }}
              >
                <Text style={{ color: "#111827", fontFamily: "DMSans_600SemiBold", fontSize: 15 }}>
                  Let me review
                </Text>
              </TouchableOpacity>

            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}
