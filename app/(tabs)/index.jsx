import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { getActiveCycle, getDailyBudget, getRemainingPool } from "../../services/db";
import { useDailyContext } from "../../context/DailyContext";

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { totalDeductions, addDeduction, addCredit, bigExpenses, addBigExpense, removeBigExpense } = useDailyContext();

  const [cycle, setCycle] = useState(null);
  const [dailyBudget, setDailyBudget] = useState(0);
  const [poolLeft, setPoolLeft] = useState(0);
  const [daysLeft, setDaysLeft] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const activeCycle = await getActiveCycle(db);
    if (!activeCycle) return;
    setCycle(activeCycle);

    const today = new Date().toISOString().split("T")[0];
    const budget = await getDailyBudget(db, activeCycle.id, today);
    setDailyBudget(budget.regular);

    const pool = await getRemainingPool(db, activeCycle.id);
    setPoolLeft(pool.regular);

    const endDate = new Date(activeCycle.end_date);
    const todayDate = new Date(today);
    const msPerDay = 1000 * 60 * 60 * 24;
    const remaining = Math.max(1, Math.floor((endDate - todayDate) / msPerDay) + 1);
    setDaysLeft(remaining);
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const leftToday = Math.max(0, dailyBudget - totalDeductions);
  const avgPerDay = daysLeft > 0 ? Math.round(poolLeft / daysLeft) : 0;

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long", day: "numeric", month: "long",
  });

  let dayOfCycle = 1;
  let totalDays = 1;
  if (cycle) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const start = new Date(cycle.start_date);
    const end = new Date(cycle.end_date);
    totalDays = Math.floor((end - start) / msPerDay) + 1;
    dayOfCycle = Math.min(Math.floor((today - start) / msPerDay) + 1, totalDays);
  }

  // ── Big expense modal ─────────────────────────────────────────────────────
  function handleAddExpense() {
    const amount = parseFloat(expenseAmount);
    if (!expenseNote.trim() || isNaN(amount) || amount <= 0) return;
    addBigExpense(expenseNote.trim(), amount);
    setExpenseNote("");
    setExpenseAmount("");
    setModalVisible(false);
  }

  function handleCloseModal() {
    setExpenseNote("");
    setExpenseAmount("");
    setModalVisible(false);
  }

  const logItActive = expenseNote.trim().length > 0 && parseFloat(expenseAmount) > 0;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Hero card ── */}
        <View style={{
          backgroundColor: "#4F46E5",
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          paddingHorizontal: 24,
          paddingTop: 56,
          paddingBottom: 28,
        }}>
          {/* Date */}
          <View>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "DMSans_500Medium" }}>
              {dateStr}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "DMSans_400Regular", marginTop: 2 }}>
              Day {dayOfCycle} of {totalDays}
            </Text>
          </View>

          {/* Amount */}
          <View style={{ alignItems: "center", paddingVertical: 36 }}>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, fontFamily: "DMSans_400Regular", marginBottom: 4 }}>
              left to spend today
            </Text>
            <Text style={{ color: "#FFFFFF", fontSize: 80, fontFamily: "DMSans_800ExtraBold", lineHeight: 88 }}>
              {Math.round(leftToday)}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "DMSans_400Regular", marginTop: 4 }}>
              ৳ BDT
            </Text>
          </View>

          {/* Quick buttons */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[10, 20, 50].map((amount) => (
                <Pressable
                  key={amount}
                  onPress={() => addDeduction(amount)}
                  style={{ flex: 1, backgroundColor: "#DC2626", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontFamily: "DMSans_600SemiBold" }}>-{amount}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[10, 20, 50].map((amount) => (
                <Pressable
                  key={amount}
                  onPress={() => addCredit(amount)}
                  style={{ flex: 1, backgroundColor: "#16A34A", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontFamily: "DMSans_600SemiBold" }}>+{amount}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={{ padding: 16, gap: 12 }}>

          {/* ── Cycle overview ── */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16 }}>
            <Text style={{ fontSize: 11, fontFamily: "DMSans_600SemiBold", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 14 }}>
              CYCLE OVERVIEW
            </Text>
            <View style={{ flexDirection: "row" }}>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontSize: 18, fontFamily: "DMSans_700Bold", color: "#111827" }}>
                  ৳{Math.round(poolLeft).toLocaleString()}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "DMSans_400Regular", color: "#9CA3AF", marginTop: 3 }}>
                  pool left
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: "#F3F4F6" }} />
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontSize: 18, fontFamily: "DMSans_700Bold", color: "#111827" }}>
                  {daysLeft}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "DMSans_400Regular", color: "#9CA3AF", marginTop: 3 }}>
                  days left
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: "#F3F4F6" }} />
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontSize: 18, fontFamily: "DMSans_700Bold", color: "#111827" }}>
                  ৳{avgPerDay}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "DMSans_400Regular", color: "#9CA3AF", marginTop: 3 }}>
                  avg / day
                </Text>
              </View>
            </View>
          </View>

          {/* ── Big expenses ── */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16 }}>
            <Text style={{ fontSize: 11, fontFamily: "DMSans_600SemiBold", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 14 }}>
              BIG EXPENSES
            </Text>
            {bigExpenses.map((expense) => (
              <View
                key={expense.id}
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}
              >
                <Text style={{ fontFamily: "DMSans_400Regular", color: "#374151", flex: 1 }}>{expense.note}</Text>
                <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#111827", marginLeft: 12 }}>৳{expense.amount}</Text>
                <Pressable
                  onPress={() => setDeleteTarget(expense)}
                  style={{ marginLeft: 12, width: 22, height: 22, borderRadius: 11, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 12, color: "#6B7280", lineHeight: 14 }}>✕</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() => setModalVisible(true)}
              style={{ borderWidth: 1.5, borderColor: "#4F46E5", borderStyle: "dashed", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: bigExpenses.length > 0 ? 10 : 0 }}
            >
              <Text style={{ color: "#4F46E5", fontFamily: "DMSans_500Medium", fontSize: 14 }}>+ Log a big expense</Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>

      {/* ── Big expense modal ── */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={handleCloseModal}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, backgroundColor: "rgba(0,0,0,0.4)" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} onPress={handleCloseModal} />
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 18, fontFamily: "DMSans_700Bold", color: "#111827", marginBottom: 24 }}>
              Log a big expense
            </Text>

            <Text style={{ fontSize: 13, fontFamily: "DMSans_500Medium", color: "#6B7280", marginBottom: 6 }}>What was it?</Text>
            <TextInput
              value={expenseNote}
              onChangeText={setExpenseNote}
              placeholder="e.g. Dinner with friends"
              placeholderTextColor="#D1D5DB"
              style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, fontFamily: "DMSans_400Regular", fontSize: 15, marginBottom: 16, color: "#111827" }}
            />

            <Text style={{ fontSize: 13, fontFamily: "DMSans_500Medium", color: "#6B7280", marginBottom: 6 }}>Amount (৳)</Text>
            <TextInput
              value={expenseAmount}
              onChangeText={setExpenseAmount}
              placeholder="0"
              placeholderTextColor="#D1D5DB"
              keyboardType="numeric"
              style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, fontFamily: "DMSans_400Regular", fontSize: 15, marginBottom: 28, color: "#111827" }}
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={handleCloseModal}
                style={{ flex: 1, backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
              >
                <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#6B7280" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={logItActive ? handleAddExpense : null}
                style={{ flex: 1, backgroundColor: logItActive ? "#4F46E5" : "#C7D2FE", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
              >
                <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#FFFFFF" }}>Log it</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delete confirmation modal ── */}
      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <Pressable
          style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setDeleteTarget(null)}
        >
          <Pressable style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 16, fontFamily: "DMSans_700Bold", color: "#111827", marginBottom: 8 }}>
              Delete expense?
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "DMSans_400Regular", color: "#6B7280", marginBottom: 24 }}>
              "{deleteTarget?.note}" (৳{deleteTarget?.amount}) will be removed.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => setDeleteTarget(null)}
                style={{ flex: 1, backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
              >
                <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#6B7280" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => { removeBigExpense(deleteTarget.id); setDeleteTarget(null); }}
                style={{ flex: 1, backgroundColor: "#DC2626", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
              >
                <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#FFFFFF" }}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
