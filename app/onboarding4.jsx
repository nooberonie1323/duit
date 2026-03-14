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

export default function OnboardingStep4() {
  const params = useLocalSearchParams();
  const db = useSQLiteContext();

  const [tags, setTags] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Modal form state
  const [selectedTag, setSelectedTag] = useState(null);
  const [reservationName, setReservationName] = useState("");
  const [reservationAmount, setReservationAmount] = useState("");

  useEffect(() => {
    getReservationTags(db).then(setTags);
  }, []);

  const hasReservations = reservations.length > 0;
  const canAdd = reservationName.trim().length > 0 && reservationAmount.length > 0;

  function openModal() {
    setSelectedTag(null);
    setReservationName("");
    setReservationAmount("");
    setModalVisible(true);
  }

  function selectTag(tag) {
    setSelectedTag(tag.id);
    setReservationName(tag.name);
  }

  function addReservation() {
    if (!canAdd) return;
    setReservations((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: reservationName.trim(),
        amount: parseFloat(reservationAmount),
      },
    ]);
    setModalVisible(false);
  }

  function removeReservation(id) {
    setReservations((prev) => prev.filter((r) => r.id !== id));
  }

  function handleNext() {
    // TODO: navigate to step 5 passing all collected data
    router.push({
      pathname: "/onboarding5",
      params: {
        ...params,
        reservations: JSON.stringify(
          reservations.map((r) => ({ name: r.name, amount: r.amount }))
        ),
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
          Any reservations?
        </Text>
        <Text
          className="text-textSub text-sm mb-6"
          style={{ fontFamily: "DMSans_400Regular" }}
        >
          Set aside money for specific things this cycle. These won't count against your daily budget.
        </Text>

        {/* Add reservation button — dashed, at the top */}
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
            Add reservation
          </Text>
        </TouchableOpacity>

        {/* Reservation list */}
        {hasReservations && (
          <ScrollView showsVerticalScrollIndicator={false}>
            {reservations.map((reservation) => (
              <View
                key={reservation.id}
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
                    {reservation.name}
                  </Text>
                  <Text style={{ fontFamily: "DMSans_400Regular", color: "#6B7280", fontSize: 13, marginTop: 2 }}>
                    ৳{reservation.amount.toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeReservation(reservation.id)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Empty state */}
        {!hasReservations && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{
              fontFamily: "DMSans_400Regular",
              color: "#9CA3AF",
              fontSize: 14,
              textAlign: "center",
              lineHeight: 22,
            }}>
              No reservations yet.{"\n"}Tap above to reserve money for{"\n"}something specific, or skip.
            </Text>
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
            {hasReservations ? "Next" : "Skip"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Centered modal */}
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
                Add reservation
              </Text>

              {/* Tag pills */}
              <Text style={{ fontFamily: "DMSans_500Medium", color: "#6B7280", fontSize: 12, letterSpacing: 1, marginBottom: 10 }}>
                QUICK SELECT
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {tags.map((tag) => {
                    const isSelected = selectedTag === tag.id;
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
                RESERVATION NAME
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
                  value={reservationName}
                  onChangeText={(text) => { setReservationName(text); setSelectedTag(null); }}
                  placeholder="e.g. Rent, Luna's food..."
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
                  value={reservationAmount}
                  onChangeText={(t) => setReservationAmount(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  style={{ fontFamily: "DMSans_400Regular", color: "#111827", fontSize: 15, flex: 1 }}
                />
              </View>

              {/* Add button */}
              <TouchableOpacity
                onPress={addReservation}
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
