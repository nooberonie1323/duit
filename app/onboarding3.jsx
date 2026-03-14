import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  ScrollView, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import { getReservationTags } from "../services/db";

export default function OnboardingStep3() {
  const params = useLocalSearchParams();
  const db = useSQLiteContext();

  const income = parseFloat(params.income || "0");

  const [mode, setMode] = useState("spent"); // "spent" | "balance"
  const [expenses, setExpenses] = useState([]);
  const [tags, setTags] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentBalance, setCurrentBalance] = useState("");

  // Modal form state
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [selectedTagId, setSelectedTagId] = useState(null);

  useEffect(() => {
    getReservationTags(db).then(setTags);
  }, []);

  const hasExpenses = expenses.length > 0;
  const canAdd = expenseName.trim().length > 0 && expenseAmount.length > 0;

  // Skip/Next logic per mode
  const hasValue = mode === "spent" ? hasExpenses : currentBalance.length > 0;

  function openModal() {
    setExpenseName("");
    setExpenseAmount("");
    setSelectedTagId(null);
    setModalVisible(true);
  }

  function selectTag(tag) {
    setSelectedTagId(tag.id);
    setExpenseName(tag.name);
  }

  function addExpense() {
    if (!canAdd) return;
    setExpenses((prev) => [
      ...prev,
      { id: Date.now(), name: expenseName.trim(), amount: parseFloat(expenseAmount) },
    ]);
    setModalVisible(false);
  }

  function removeExpense(id) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function handleNext() {
    let alreadySpent = 0;
    let expenseList = [];

    if (mode === "spent") {
      alreadySpent = expenses.reduce((sum, e) => sum + e.amount, 0);
      expenseList = expenses.map((e) => ({ name: e.name, amount: e.amount }));
    } else {
      const balance = parseFloat(currentBalance || "0");
      alreadySpent = Math.max(0, income - balance);
      expenseList = [{ name: "Calculated from balance", amount: alreadySpent }];
    }

    router.push({
      pathname: "/onboarding4",
      params: {
        ...params,
        alreadySpent: alreadySpent.toString(),
        expenses: JSON.stringify(expenseList),
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
          Already spent anything?
        </Text>
        <Text
          className="text-textSub text-sm mb-6"
          style={{ fontFamily: "DMSans_400Regular" }}
        >
          Log what you've already paid this cycle — rent, bills, groceries.
        </Text>

        {/* Mode toggle pills */}
        <View style={{
          flexDirection: "row",
          backgroundColor: "#EAECF0",
          borderRadius: 10,
          padding: 4,
          marginBottom: 20,
        }}>
          {[
            { key: "spent", label: "I know what I spent" },
            { key: "balance", label: "I know what I have" },
          ].map((option) => (
            <TouchableOpacity
              key={option.key}
              onPress={() => setMode(option.key)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: "center",
                borderRadius: 8,
                backgroundColor: mode === option.key ? "#FFFFFF" : "transparent",
                shadowColor: mode === option.key ? "#000" : "transparent",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: mode === option.key ? 0.06 : 0,
                shadowRadius: 2,
                elevation: mode === option.key ? 2 : 0,
              }}
            >
              <Text style={{
                fontFamily: mode === option.key ? "DMSans_600SemiBold" : "DMSans_400Regular",
                color: mode === option.key ? "#111827" : "#6B7280",
                fontSize: 13,
              }}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── MODE: I know what I spent ── */}
        {mode === "spent" && (
          <>
            <TouchableOpacity
              onPress={openModal}
              activeOpacity={0.7}
              style={{
                borderWidth: 1.5,
                borderColor: "#4F46E5",
                borderStyle: "dashed",
                borderRadius: 12,
                paddingVertical: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <Ionicons name="add" size={20} color="#4F46E5" />
              <Text style={{ fontFamily: "DMSans_600SemiBold", color: "#4F46E5", fontSize: 15 }}>
                Add expense
              </Text>
            </TouchableOpacity>

            {hasExpenses && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {expenses.map((expense) => (
                  <View
                    key={expense.id}
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderWidth: 1,
                      borderColor: "#EAECF0",
                      borderRadius: 16,
                      padding: 16,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <View>
                      <Text style={{ fontFamily: "DMSans_500Medium", color: "#111827", fontSize: 15 }}>
                        {expense.name}
                      </Text>
                      <Text style={{ fontFamily: "DMSans_400Regular", color: "#6B7280", fontSize: 13, marginTop: 2 }}>
                        ৳{expense.amount.toLocaleString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeExpense(expense.id)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={20} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {!hasExpenses && (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{
                  fontFamily: "DMSans_400Regular",
                  color: "#9CA3AF",
                  fontSize: 14,
                  textAlign: "center",
                  lineHeight: 22,
                }}>
                  No expenses added yet.{"\n"}Tap above to add one, or skip if{"\n"}you haven't spent anything.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── MODE: I know what I have ── */}
        {mode === "balance" && (
          <View style={{ flex: 1 }}>
            <Text style={{
              fontFamily: "DMSans_500Medium",
              color: "#6B7280",
              fontSize: 12,
              letterSpacing: 1,
              marginBottom: 8,
            }}>
              CURRENT BALANCE
            </Text>
            <View style={{
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#EAECF0",
              borderRadius: 12,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}>
              <Text style={{ fontFamily: "DMSans_400Regular", color: "#6B7280", fontSize: 15, marginRight: 6 }}>
                ৳
              </Text>
              <TextInput
                value={currentBalance}
                onChangeText={(t) => setCurrentBalance(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                style={{ fontFamily: "DMSans_400Regular", color: "#111827", fontSize: 15, flex: 1 }}
              />
            </View>

            {/* Calculated preview */}
            {currentBalance.length > 0 && (
              <View style={{
                backgroundColor: "#EEF2FF",
                borderWidth: 1,
                borderColor: "#C7D2FE",
                borderRadius: 12,
                padding: 14,
              }}>
                <Text style={{ fontFamily: "DMSans_400Regular", color: "#4F46E5", fontSize: 13, lineHeight: 20 }}>
                  Already spent = ৳{income.toLocaleString()} − ৳{parseFloat(currentBalance).toLocaleString()} = <Text style={{ fontFamily: "DMSans_600SemiBold" }}>৳{Math.max(0, income - parseFloat(currentBalance)).toLocaleString()}</Text>
                </Text>
              </View>
            )}

            {currentBalance.length === 0 && (
              <Text style={{
                fontFamily: "DMSans_400Regular",
                color: "#9CA3AF",
                fontSize: 13,
                lineHeight: 20,
              }}>
                We'll calculate how much you've spent as income − balance.
              </Text>
            )}
          </View>
        )}

      </View>

      {/* Back + Skip/Next */}
      <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingBottom: 32 }}>
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
          <Text style={{ color: "#111827", fontFamily: "DMSans_600SemiBold", fontSize: 16 }}>
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
          <Text style={{ color: "#FFFFFF", fontFamily: "DMSans_600SemiBold", fontSize: 16 }}>
            {hasValue ? "Next" : "Skip"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add expense modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}
          onPress={() => setModalVisible(false)}
        >
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24 }}>
              <Text style={{ fontFamily: "DMSans_700Bold", color: "#111827", fontSize: 18, marginBottom: 20 }}>
                Add expense
              </Text>

              {/* Tag pills */}
              <Text style={{ fontFamily: "DMSans_500Medium", color: "#6B7280", fontSize: 12, letterSpacing: 1, marginBottom: 10 }}>
                QUICK SELECT
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {tags.map((tag) => {
                    const isSelected = selectedTagId === tag.id;
                    return (
                      <TouchableOpacity
                        key={tag.id}
                        onPress={() => selectTag(tag)}
                        activeOpacity={0.7}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 99,
                          backgroundColor: isSelected ? "#4F46E5" : "#F8F9FB",
                          borderWidth: 1,
                          borderColor: isSelected ? "#4F46E5" : "#EAECF0",
                        }}
                      >
                        <Text style={{
                          fontFamily: "DMSans_500Medium",
                          color: isSelected ? "#FFFFFF" : "#6B7280",
                          fontSize: 13,
                        }}>
                          {tag.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Name input */}
              <Text style={{ fontFamily: "DMSans_500Medium", color: "#6B7280", fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>
                EXPENSE NAME
              </Text>
              <View style={{
                backgroundColor: "#F8F9FB",
                borderWidth: 1,
                borderColor: "#EAECF0",
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
              }}>
                <TextInput
                  value={expenseName}
                  onChangeText={(text) => { setExpenseName(text); setSelectedTagId(null); }}
                  placeholder="e.g. Rent, Groceries..."
                  placeholderTextColor="#9CA3AF"
                  style={{ fontFamily: "DMSans_400Regular", color: "#111827", fontSize: 15 }}
                />
              </View>

              {/* Amount input */}
              <Text style={{ fontFamily: "DMSans_500Medium", color: "#6B7280", fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>
                AMOUNT
              </Text>
              <View style={{
                backgroundColor: "#F8F9FB",
                borderWidth: 1,
                borderColor: "#EAECF0",
                borderRadius: 12,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 24,
              }}>
                <Text style={{ fontFamily: "DMSans_400Regular", color: "#6B7280", fontSize: 15, marginRight: 6 }}>
                  ৳
                </Text>
                <TextInput
                  value={expenseAmount}
                  onChangeText={(t) => setExpenseAmount(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  style={{ fontFamily: "DMSans_400Regular", color: "#111827", fontSize: 15, flex: 1 }}
                />
              </View>

              {/* Add button */}
              <TouchableOpacity
                onPress={addExpense}
                disabled={!canAdd}
                activeOpacity={canAdd ? 0.85 : 1}
                style={{
                  backgroundColor: canAdd ? "#4F46E5" : "#EAECF0",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                  elevation: canAdd ? 6 : 0,
                  shadowColor: canAdd ? "#4F46E5" : "transparent",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: canAdd ? 0.3 : 0,
                  shadowRadius: 8,
                }}
              >
                <Text style={{
                  color: canAdd ? "#FFFFFF" : "#9CA3AF",
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 16,
                }}>
                  Add
                </Text>
              </TouchableOpacity>

            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}
