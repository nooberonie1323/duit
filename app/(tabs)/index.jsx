import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  getActiveCycle,
  getDailyBudget,
  getDailyEntry,
  getRemainingPool,
} from "../../services/db";

const today = new Date().toISOString().split("T")[0];

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [cycle, setCycle] = useState(null);
  const [budget, setBudget] = useState({ regular: 0, extra: 0, total: 0 });
  const [entry, setEntry] = useState(null);
  const [pool, setPool] = useState({ regular: 0, extra: 0 });
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        const activeCycle = await getActiveCycle(db);
        if (!active) return;
        setCycle(activeCycle);
        if (activeCycle) {
          const [b, e, p] = await Promise.all([
            getDailyBudget(db, activeCycle.id, today),
            getDailyEntry(db, activeCycle.id, today),
            getRemainingPool(db, activeCycle.id),
          ]);
          if (!active) return;
          setBudget(b);
          setEntry(e);
          setPool(p);
        }
        setLoading(false);
      }
      load();
      return () => { active = false; };
    }, [db])
  );

  const daysLeft = cycle
    ? Math.max(1, Math.floor((new Date(cycle.end_date) - new Date(today)) / 86400000) + 1)
    : 0;
  const dayNum = cycle
    ? Math.floor((new Date(today) - new Date(cycle.start_date)) / 86400000) + 1
    : 0;
  const totalDays = cycle
    ? Math.floor((new Date(cycle.end_date) - new Date(cycle.start_date)) / 86400000) + 1
    : 0;

  const spentToday = entry?.amount_spent ?? 0;
  const spendRatio = budget.total > 0 ? Math.min(1, spentToday / budget.total) : 0;
  const avgPerDay = daysLeft > 0 ? (pool.regular / daysLeft) : 0;

  if (loading) return <SafeAreaView className="flex-1 bg-bg" />;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-textMuted text-xs font-sans">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>
            <Text className="text-text text-lg font-sans-bold mt-0.5">
              {cycle ? `Day ${dayNum} of ${totalDays}` : "No active cycle"}
            </Text>
          </View>
        </View>

        {/* Daily Budget Card */}
        <View className="bg-surface border border-border rounded-card p-4">
          <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest">
            Today's Budget
          </Text>
          <View className="flex-row items-baseline gap-2 mt-2">
            <Text className="text-text text-4xl font-sans-bold">
              ৳{cycle ? budget.regular.toFixed(0) : "—"}
            </Text>
            {budget.extra > 0 && (
              <Text className="text-extra text-lg font-sans-medium">
                +৳{budget.extra.toFixed(0)} extra
              </Text>
            )}
          </View>
          <View className="h-px bg-border my-3" />
          <Text className="text-textMuted text-xs font-sans">
            {cycle
              ? `৳${budget.total.toFixed(0)} total available today`
              : "Set up your first pay cycle to get started"}
          </Text>
        </View>

        {/* Today's Spend */}
        <View className="bg-surface border border-border rounded-card p-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest">
              Spent Today
            </Text>
            <Text className="text-text text-base font-sans-bold">
              ৳{spentToday.toFixed(0)}
            </Text>
          </View>
          <View className="h-2 bg-border rounded-full mt-3">
            <View
              className="h-2 bg-indigo rounded-full"
              style={{ width: `${spendRatio * 100}%` }}
            />
          </View>
        </View>

        {/* Cycle Overview */}
        <View className="bg-surface border border-border rounded-card p-4">
          <Text className="text-textSub text-xs font-sans-medium uppercase tracking-widest mb-3">
            Cycle Overview
          </Text>
          <View className="flex-row justify-between">
            <View>
              <Text className="text-textMuted text-xs font-sans">Pool Left</Text>
              <Text className="text-text text-base font-sans-bold mt-0.5">
                {cycle ? `৳${pool.regular.toFixed(0)}` : "—"}
              </Text>
            </View>
            <View>
              <Text className="text-textMuted text-xs font-sans">Days Left</Text>
              <Text className="text-text text-base font-sans-bold mt-0.5">
                {cycle ? daysLeft : "—"}
              </Text>
            </View>
            <View>
              <Text className="text-textMuted text-xs font-sans">Avg/Day</Text>
              <Text className="text-text text-base font-sans-bold mt-0.5">
                {cycle ? `৳${avgPerDay.toFixed(0)}` : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Log Spend Button */}
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/log")}
          className="bg-indigo rounded-btn py-4 items-center"
          style={{
            shadowColor: "#4F46E5",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Text className="text-white font-sans-bold text-base">
            Log Today's Spend
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
