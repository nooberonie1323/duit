import { useState, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import { getActiveCycle, logDailySpend } from "../../services/db";
import { useDailyContext } from "../../context/DailyContext";

const today = new Date().toISOString().split("T")[0];

export default function LogScreen() {
  const db = useSQLiteContext();
  const daily = useDailyContext();
  const [cycle, setCycle] = useState(null);
  const [now, setNow] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewFlag, setReviewFlag] = useState(null);

  useFocusEffect(
    useCallback(() => {
      getActiveCycle(db).then(setCycle);
    }, [db])
  );

  // Refresh clock every 30s to keep countdown accurate
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const reviewUnlocked = now.getHours() >= daily.reviewHour;
  const hasAnything =
    daily.pendingDeductions.length > 0 || daily.bigExpenses.length > 0;

  function getCountdown() {
    const reviewTime = new Date();
    reviewTime.setHours(daily.reviewHour, 0, 0, 0);
    const diff = reviewTime - now;
    if (diff <= 0) return null;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  async function handleConfirm() {
    if (!cycle || saving || daily.totalPending === 0) return;
    setSaving(true);
    try {
      await logDailySpend(
        db,
        cycle.id,
        today,
        daily.totalPending,
        reviewNote || null,
        reviewFlag,
        null
      );
      daily.confirmAndSave(daily.totalPending);
    } finally {
      setSaving(false);
    }
  }

  // ── Confirmed state ───────────────────────────────────────────────────────

  if (daily.reviewConfirmed) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#F8F9FB",
          justifyContent: "center",
          alignItems: "center",
          padding: 32,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: "#ECFDF5",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <Ionicons name="checkmark-circle" size={40} color="#16A34A" />
        </View>
        <Text
          style={{
            fontFamily: "DMSans_700Bold",
            color: "#111827",
            fontSize: 24,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Day wrapped up
        </Text>
        <Text
          style={{
            fontFamily: "DMSans_400Regular",
            color: "#6B7280",
            fontSize: 16,
            textAlign: "center",
            lineHeight: 26,
            marginBottom: 12,
          }}
        >
          You spent{" "}
          <Text style={{ fontFamily: "DMSans_700Bold", color: "#111827" }}>
            ৳{Math.round(daily.confirmedTotal).toLocaleString()}
          </Text>{" "}
          today.
        </Text>
        <Text
          style={{
            fontFamily: "DMSans_400Regular",
            color: "#9CA3AF",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          Get some rest. See you tomorrow.
        </Text>
      </SafeAreaView>
    );
  }

  const countdown = getCountdown();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8F9FB" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <Text
            style={{ fontFamily: "DMSans_700Bold", color: "#111827", fontSize: 22 }}
          >
            {reviewUnlocked ? "Review Today" : "Today's Log"}
          </Text>
          {reviewUnlocked && (
            <View
              style={{
                backgroundColor: "#FEF3C7",
                borderRadius: 99,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: "DMSans_600SemiBold",
                  color: "#D97706",
                  fontSize: 12,
                }}
              >
                REVIEW TIME
              </Text>
            </View>
          )}
        </View>

        {/* Total spent card */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#EAECF0",
            borderRadius: 16,
            padding: 20,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "DMSans_800ExtraBold",
              color: "#111827",
              fontSize: 52,
              letterSpacing: -1,
            }}
          >
            ৳{Math.round(daily.totalPending).toLocaleString()}
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              color: "#9CA3AF",
              fontSize: 13,
              marginTop: 4,
            }}
          >
            spent today · pending review
          </Text>
        </View>

        {/* Countdown (view mode only) */}
        {!reviewUnlocked && countdown && (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#EAECF0",
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Ionicons name="time-outline" size={20} color="#9CA3AF" />
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                color: "#6B7280",
                fontSize: 14,
              }}
            >
              Review unlocks in{" "}
              <Text
                style={{ fontFamily: "DMSans_600SemiBold", color: "#111827" }}
              >
                {countdown}
              </Text>
            </Text>
          </View>
        )}

        {/* Empty state */}
        {!hasAnything && (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#EAECF0",
              borderRadius: 16,
              padding: 32,
              alignItems: "center",
              gap: 8,
            }}
          >
            <Ionicons name="receipt-outline" size={32} color="#D1D5DB" />
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                color: "#9CA3AF",
                fontSize: 14,
                textAlign: "center",
              }}
            >
              Nothing logged yet
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                color: "#D1D5DB",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              Use the quick buttons on Home to track spending
            </Text>
          </View>
        )}

        {/* Quick deductions list */}
        {daily.pendingDeductions.length > 0 && (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#EAECF0",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                color: "#9CA3AF",
                fontSize: 11,
                letterSpacing: 1,
                marginBottom: 12,
              }}
            >
              QUICK DEDUCTIONS
            </Text>
            {daily.pendingDeductions.map((item) => (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: "#F3F4F6",
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor:
                      item.type === "deduct" ? "#DC2626" : "#16A34A",
                    marginRight: 12,
                  }}
                />
                <Text
                  style={{
                    fontFamily: "DMSans_400Regular",
                    color: "#374151",
                    fontSize: 14,
                    flex: 1,
                  }}
                >
                  {item.type === "deduct" ? "Quick spend" : "Added back"}
                </Text>
                <Text
                  style={{
                    fontFamily: "DMSans_600SemiBold",
                    color: item.type === "deduct" ? "#DC2626" : "#16A34A",
                    fontSize: 14,
                    marginRight: reviewUnlocked ? 12 : 0,
                  }}
                >
                  {item.type === "deduct" ? "−" : "+"}৳{item.amount}
                </Text>
                {reviewUnlocked && (
                  <TouchableOpacity
                    onPress={() => daily.removeDeductionItem(item.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle-outline" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Big expenses list */}
        {daily.bigExpenses.length > 0 && (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#EAECF0",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                color: "#9CA3AF",
                fontSize: 11,
                letterSpacing: 1,
                marginBottom: 12,
              }}
            >
              BIG EXPENSES
            </Text>
            {daily.bigExpenses.map((item) => (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: "#F3F4F6",
                }}
              >
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{
                    fontFamily: "DMSans_400Regular",
                    color: "#374151",
                    fontSize: 14,
                    flex: 1,
                    marginRight: 8,
                  }}
                >
                  {item.note}
                </Text>
                <Text
                  style={{
                    fontFamily: "DMSans_600SemiBold",
                    color: "#111827",
                    fontSize: 14,
                    marginRight: reviewUnlocked ? 12 : 0,
                  }}
                >
                  ৳{item.amount.toLocaleString()}
                </Text>
                {reviewUnlocked && (
                  <TouchableOpacity
                    onPress={() => daily.removeBigExpense(item.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle-outline" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Review form — only shown when review is unlocked */}
        {reviewUnlocked && (
          <>
            {/* Note */}
            <View>
              <Text
                style={{
                  fontFamily: "DMSans_500Medium",
                  color: "#9CA3AF",
                  fontSize: 11,
                  letterSpacing: 1,
                  marginBottom: 8,
                }}
              >
                NOTE (OPTIONAL)
              </Text>
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#EAECF0",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <TextInput
                  value={reviewNote}
                  onChangeText={setReviewNote}
                  placeholder="How did today go?"
                  placeholderTextColor="#9CA3AF"
                  style={{
                    fontFamily: "DMSans_400Regular",
                    color: "#111827",
                    fontSize: 14,
                  }}
                  multiline
                />
              </View>
            </View>

            {/* Flag */}
            <View>
              <Text
                style={{
                  fontFamily: "DMSans_500Medium",
                  color: "#9CA3AF",
                  fontSize: 11,
                  letterSpacing: 1,
                  marginBottom: 8,
                }}
              >
                FLAG (OPTIONAL)
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() =>
                    setReviewFlag(reviewFlag === "green" ? null : "green")
                  }
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor:
                      reviewFlag === "green" ? "#DCFCE7" : "#FFFFFF",
                    borderWidth: 1,
                    borderColor:
                      reviewFlag === "green" ? "#16A34A" : "#EAECF0",
                  }}
                >
                  <Text style={{ fontSize: 18 }}>🟢</Text>
                  <Text
                    style={{
                      fontFamily: "DMSans_500Medium",
                      color: reviewFlag === "green" ? "#16A34A" : "#9CA3AF",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Good day
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    setReviewFlag(reviewFlag === "red" ? null : "red")
                  }
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor:
                      reviewFlag === "red" ? "#FEE2E2" : "#FFFFFF",
                    borderWidth: 1,
                    borderColor: reviewFlag === "red" ? "#DC2626" : "#EAECF0",
                  }}
                >
                  <Text style={{ fontSize: 18 }}>🔴</Text>
                  <Text
                    style={{
                      fontFamily: "DMSans_500Medium",
                      color: reviewFlag === "red" ? "#DC2626" : "#9CA3AF",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Rough day
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm & Save */}
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={saving || daily.totalPending === 0}
              activeOpacity={0.85}
              style={{
                backgroundColor:
                  daily.totalPending > 0 ? "#4F46E5" : "#EAECF0",
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: "center",
                elevation: daily.totalPending > 0 ? 6 : 0,
                shadowColor: "#4F46E5",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: daily.totalPending > 0 ? 0.3 : 0,
                shadowRadius: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  color: daily.totalPending > 0 ? "#FFFFFF" : "#9CA3AF",
                  fontSize: 16,
                }}
              >
                {saving ? "Saving..." : "Confirm & Save"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
