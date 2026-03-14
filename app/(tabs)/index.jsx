import { useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, Animated, Dimensions,
  ScrollView, Modal, Pressable, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  getActiveCycle,
  getDailyBudget,
  getRemainingPool,
} from "../../services/db";

const today = new Date().toISOString().split("T")[0];
const SCREEN_H = Dimensions.get("window").height;

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [cycle, setCycle] = useState(null);
  const [budget, setBudget] = useState({ regular: 0, extra: 0, total: 0 });
  const [pool, setPool] = useState({ regular: 0, extra: 0 });
  const [loading, setLoading] = useState(true);

  // Quick deductions (in-memory)
  const [pendingDeduction, setPendingDeduction] = useState(0);

  // Big expenses (in-memory, pending midnight review)
  const [bigExpenses, setBigExpenses] = useState([]);

  // Modal visibility
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);

  // Modal form state
  const [modalNote, setModalNote] = useState("");
  const [modalAmount, setModalAmount] = useState("");

  // Toast
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastText, setToastText] = useState("");
  const toastTimer = useRef(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        const activeCycle = await getActiveCycle(db);
        if (!active) return;
        setCycle(activeCycle);
        if (activeCycle) {
          const [b, p] = await Promise.all([
            getDailyBudget(db, activeCycle.id, today),
            getRemainingPool(db, activeCycle.id),
          ]);
          if (!active) return;
          setBudget(b);
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

  const remaining = Math.max(0, budget.total - pendingDeduction);
  const avgPerDay = daysLeft > 0 ? pool.regular / daysLeft : 0;

  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });

  const canSubmit = modalNote.trim().length > 0 && modalAmount.length > 0;

  // ── Toast ──────────────────────────────────────────────────────────────────

  function showToast(text) {
    setToastText(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastOpacity.setValue(1);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0, duration: 500, useNativeDriver: true,
      }).start();
    }, 1000);
  }

  // ── Quick deduct ───────────────────────────────────────────────────────────

  function handleDeduct(amount) {
    setPendingDeduction((prev) => prev + amount);
    showToast(`−৳${amount}`);
  }

  function handleAdd(amount) {
    setPendingDeduction((prev) => Math.max(0, prev - amount));
    showToast(`+৳${amount}`);
  }

  // ── Big expenses ───────────────────────────────────────────────────────────

  function openAddModal() {
    setModalNote("");
    setModalAmount("");
    setAddModalVisible(true);
  }

  function openEditModal(expense) {
    setSelectedExpense(expense);
    setModalNote(expense.note);
    setModalAmount(expense.amount.toString());
    setEditModalVisible(true);
  }

  function openDeleteConfirm(expense) {
    setSelectedExpense(expense);
    setEditModalVisible(false);
    setDeleteConfirmVisible(true);
  }

  function addExpense() {
    if (!canSubmit) return;
    setBigExpenses((prev) => [
      ...prev,
      { id: Date.now(), note: modalNote.trim(), amount: parseFloat(modalAmount) },
    ]);
    setAddModalVisible(false);
  }

  function saveEdit() {
    if (!canSubmit) return;
    setBigExpenses((prev) =>
      prev.map((e) =>
        e.id === selectedExpense.id
          ? { ...e, note: modalNote.trim(), amount: parseFloat(modalAmount) }
          : e
      )
    );
    setEditModalVisible(false);
  }

  function confirmDelete() {
    setBigExpenses((prev) => prev.filter((e) => e.id !== selectedExpense.id));
    setDeleteConfirmVisible(false);
    setSelectedExpense(null);
  }

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: "#F8F9FB" }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8F9FB" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
      >

        {/* ── Big Budget Card ─────────────────────────────────────────────── */}
        <LinearGradient
          colors={["#4F46E5", "#3730A3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: SCREEN_H * 0.56, borderRadius: 24, padding: 24, justifyContent: "space-between" }}
        >
          <View>
            <Text style={{ fontFamily: "DMSans_400Regular", color: "rgba(255,255,255,0.65)", fontSize: 14 }}>
              {dateStr}
            </Text>
            {cycle && (
              <Text style={{ fontFamily: "DMSans_400Regular", color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 2 }}>
                Day {dayNum} of {totalDays}
              </Text>
            )}
          </View>

          <View style={{ alignItems: "center" }}>
            <Text style={{ fontFamily: "DMSans_400Regular", color: "rgba(255,255,255,0.55)", fontSize: 14, marginBottom: 2 }}>
              left to spend today
            </Text>
            <Text style={{ fontFamily: "DMSans_800ExtraBold", color: "#FFFFFF", fontSize: 80, lineHeight: 88, letterSpacing: -2 }}>
              {cycle ? Math.round(remaining) : "—"}
            </Text>
            <Text style={{ fontFamily: "DMSans_400Regular", color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 2 }}>
              ৳ BDT
            </Text>
            <Animated.View style={{ opacity: toastOpacity, marginTop: 10, height: 26, justifyContent: "center" }}>
              <Text style={{ fontFamily: "DMSans_700Bold", color: "rgba(255,255,255,0.85)", fontSize: 20 }}>
                {toastText}
              </Text>
            </Animated.View>
          </View>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[10, 20, 50].map((amount) => (
                <TouchableOpacity
                  key={`d-${amount}`}
                  onPress={() => handleDeduct(amount)}
                  activeOpacity={0.75}
                  style={{ flex: 1, backgroundColor: "#DC2626", borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
                >
                  <Text style={{ fontFamily: "DMSans_700Bold", color: "#FFFFFF", fontSize: 15 }}>−{amount}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[10, 20, 50].map((amount) => (
                <TouchableOpacity
                  key={`a-${amount}`}
                  onPress={() => handleAdd(amount)}
                  activeOpacity={0.75}
                  style={{ flex: 1, backgroundColor: "#16A34A", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
                >
                  <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#FFFFFF", fontSize: 14 }}>+{amount}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </LinearGradient>

        {/* ── Cycle Overview ──────────────────────────────────────────────── */}
        <View style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20 }}>
          <Text style={{ fontFamily: "DMSans_500Medium", color: "#9CA3AF", fontSize: 11, letterSpacing: 1, marginBottom: 12 }}>
            CYCLE OVERVIEW
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ alignItems: "center", flex: 1 }}>
              <Text style={{ fontFamily: "DMSans_700Bold", color: "#111827", fontSize: 17 }}>
                {cycle ? `৳${Math.round(pool.regular).toLocaleString()}` : "—"}
              </Text>
              <Text style={{ fontFamily: "DMSans_400Regular", color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>pool left</Text>
            </View>
            <View style={{ width: 1, height: 32, backgroundColor: "#EAECF0" }} />
            <View style={{ alignItems: "center", flex: 1 }}>
              <Text style={{ fontFamily: "DMSans_700Bold", color: "#111827", fontSize: 17 }}>
                {cycle ? daysLeft : "—"}
              </Text>
              <Text style={{ fontFamily: "DMSans_400Regular", color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>days left</Text>
            </View>
            <View style={{ width: 1, height: 32, backgroundColor: "#EAECF0" }} />
            <View style={{ alignItems: "center", flex: 1 }}>
              <Text style={{ fontFamily: "DMSans_700Bold", color: "#111827", fontSize: 17 }}>
                {cycle ? `৳${Math.round(avgPerDay)}` : "—"}
              </Text>
              <Text style={{ fontFamily: "DMSans_400Regular", color: "#9CA3AF", fontSize: 12, marginTop: 2 }}>avg / day</Text>
            </View>
          </View>
        </View>

        {/* ── Big Expenses Card ───────────────────────────────────────────── */}
        <View style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 16, padding: 16 }}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={{ fontFamily: "DMSans_500Medium", color: "#9CA3AF", fontSize: 11, letterSpacing: 1 }}>
              BIG EXPENSES
            </Text>
            <View style={{ backgroundColor: "#FEF3C7", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontFamily: "DMSans_500Medium", color: "#D97706", fontSize: 11 }}>
                pending review
              </Text>
            </View>
          </View>

          {/* Expense rows */}
          {bigExpenses.map((expense) => (
            <TouchableOpacity
              key={expense.id}
              onPress={() => openEditModal(expense)}
              activeOpacity={0.7}
              style={{
                flexDirection: "row", alignItems: "center",
                paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#EAECF0",
                marginBottom: 4,
              }}
            >
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ fontFamily: "DMSans_400Regular", color: "#111827", fontSize: 14, flex: 1, marginRight: 8 }}
              >
                {expense.note}
              </Text>
              <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#111827", fontSize: 14, marginRight: 12 }}>
                ৳{expense.amount.toLocaleString()}
              </Text>
              <TouchableOpacity
                onPress={() => openDeleteConfirm(expense)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle-outline" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {/* Dashed add button */}
          <TouchableOpacity
            onPress={openAddModal}
            activeOpacity={0.7}
            style={{
              borderWidth: 1.5, borderColor: "#4F46E5", borderStyle: "dashed",
              borderRadius: 10, paddingVertical: 12, flexDirection: "row",
              alignItems: "center", justifyContent: "center", gap: 8,
              marginTop: bigExpenses.length > 0 ? 8 : 0,
            }}
          >
            <Ionicons name="add" size={18} color="#4F46E5" />
            <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#4F46E5", fontSize: 14 }}>
              Log a big expense
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Add Modal ───────────────────────────────────────────────────────── */}
      <Modal visible={addModalVisible} transparent animationType="none" onRequestClose={() => setAddModalVisible(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}
          onPress={() => setAddModalVisible(false)}
        >
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24 }}>
              <Text style={{ fontFamily: "DMSans_700Bold", color: "#111827", fontSize: 18, marginBottom: 20 }}>
                Log big expense
              </Text>

              <Text style={{ fontFamily: "DMSans_500Medium", color: "#6B7280", fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>NOTE</Text>
              <View style={{ backgroundColor: "#F8F9FB", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <TextInput
                  value={modalNote}
                  onChangeText={setModalNote}
                  placeholder="What was it?"
                  placeholderTextColor="#9CA3AF"
                  style={{ fontFamily: "DMSans_400Regular", color: "#111827", fontSize: 15 }}
                />
              </View>

              <Text style={{ fontFamily: "DMSans_500Medium", color: "#6B7280", fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>AMOUNT</Text>
              <View style={{ backgroundColor: "#F8F9FB", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
                <Text style={{ fontFamily: "DMSans_400Regular", color: "#6B7280", fontSize: 15, marginRight: 6 }}>৳</Text>
                <TextInput
                  value={modalAmount}
                  onChangeText={(t) => setModalAmount(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  style={{ fontFamily: "DMSans_400Regular", color: "#111827", fontSize: 15, flex: 1 }}
                />
              </View>

              <TouchableOpacity
                onPress={addExpense}
                disabled={!canSubmit}
                activeOpacity={canSubmit ? 0.85 : 1}
                style={{
                  backgroundColor: canSubmit ? "#4F46E5" : "#EAECF0",
                  borderRadius: 12, paddingVertical: 15, alignItems: "center",
                  elevation: canSubmit ? 4 : 0,
                  shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: canSubmit ? 0.25 : 0, shadowRadius: 8,
                }}
              >
                <Text style={{ fontFamily: "DMSans_600SemiBold", color: canSubmit ? "#FFFFFF" : "#9CA3AF", fontSize: 15 }}>
                  Log expense
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Edit Modal ──────────────────────────────────────────────────────── */}
      <Modal visible={editModalVisible} transparent animationType="none" onRequestClose={() => setEditModalVisible(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}
          onPress={() => setEditModalVisible(false)}
        >
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24 }}>
              <Text style={{ fontFamily: "DMSans_700Bold", color: "#111827", fontSize: 18, marginBottom: 20 }}>
                Edit expense
              </Text>

              <Text style={{ fontFamily: "DMSans_500Medium", color: "#6B7280", fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>NOTE</Text>
              <View style={{ backgroundColor: "#F8F9FB", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <TextInput
                  value={modalNote}
                  onChangeText={setModalNote}
                  placeholder="What was it?"
                  placeholderTextColor="#9CA3AF"
                  style={{ fontFamily: "DMSans_400Regular", color: "#111827", fontSize: 15 }}
                />
              </View>

              <Text style={{ fontFamily: "DMSans_500Medium", color: "#6B7280", fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>AMOUNT</Text>
              <View style={{ backgroundColor: "#F8F9FB", borderWidth: 1, borderColor: "#EAECF0", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
                <Text style={{ fontFamily: "DMSans_400Regular", color: "#6B7280", fontSize: 15, marginRight: 6 }}>৳</Text>
                <TextInput
                  value={modalAmount}
                  onChangeText={(t) => setModalAmount(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  style={{ fontFamily: "DMSans_400Regular", color: "#111827", fontSize: 15, flex: 1 }}
                />
              </View>

              <TouchableOpacity
                onPress={saveEdit}
                disabled={!canSubmit}
                activeOpacity={canSubmit ? 0.85 : 1}
                style={{
                  backgroundColor: canSubmit ? "#4F46E5" : "#EAECF0",
                  borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 10,
                  elevation: canSubmit ? 4 : 0,
                  shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: canSubmit ? 0.25 : 0, shadowRadius: 8,
                }}
              >
                <Text style={{ fontFamily: "DMSans_600SemiBold", color: canSubmit ? "#FFFFFF" : "#9CA3AF", fontSize: 15 }}>
                  Save changes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openDeleteConfirm(selectedExpense)}
                activeOpacity={0.8}
                style={{ backgroundColor: "#FEE2E2", borderRadius: 12, paddingVertical: 15, alignItems: "center" }}
              >
                <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#DC2626", fontSize: 15 }}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Delete Confirm Modal ─────────────────────────────────────────────── */}
      <Modal visible={deleteConfirmVisible} transparent animationType="none" onRequestClose={() => setDeleteConfirmVisible(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}
          onPress={() => setDeleteConfirmVisible(false)}
        >
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24 }}>
              <Text style={{ fontFamily: "DMSans_700Bold", color: "#111827", fontSize: 18, marginBottom: 8 }}>
                Remove this expense?
              </Text>
              <Text style={{ fontFamily: "DMSans_400Regular", color: "#6B7280", fontSize: 14, lineHeight: 22, marginBottom: 24 }}>
                "{selectedExpense?.note}" will be removed from today's pending list.
              </Text>

              <TouchableOpacity
                onPress={confirmDelete}
                activeOpacity={0.85}
                style={{ backgroundColor: "#DC2626", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 10 }}
              >
                <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#FFFFFF", fontSize: 15 }}>
                  Yes, remove it
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setDeleteConfirmVisible(false)}
                activeOpacity={0.8}
                style={{ backgroundColor: "#FFFFFF", borderRadius: 12, paddingVertical: 15, alignItems: "center", borderWidth: 1, borderColor: "#EAECF0" }}
              >
                <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#111827", fontSize: 15 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}
