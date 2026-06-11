import { useOnboarding } from '@/contexts/onboarding';
import type { Reservation } from '@/contexts/onboarding';
import { useThemeColors } from '@/contexts/theme';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { InteractionManager, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProtectScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { data, update } = useOnboarding();
  const [addingReservation, setAddingReservation] = useState(false);
  const [newResName, setNewResName] = useState('');
  const [newResAmount, setNewResAmount] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const income = parseFloat(data.income) || 0;
  const alreadySpent = parseFloat(data.alreadySpent) || 0;
  const stillHave = parseFloat(data.stillHave) || 0;
  const pool = data.positionMode === 'have' && stillHave > 0 ? stillHave : income - alreadySpent;
  const savings = parseFloat(data.savings) || 0;
  const totalReservations = data.reservations.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const daysInCycle = data.cycleStartDate && data.cycleEndDate
    ? Math.round((data.cycleEndDate.getTime() - data.cycleStartDate.getTime()) / 86400000) : 1;
  const divisor = data.startFromToday ? daysInCycle + 1 : daysInCycle;
  const dailyBudget = divisor > 0 ? (pool - savings - totalReservations) / divisor : 0;
  const budgetAlert = parseFloat(data.budgetAlert) || 0;

  const poolWouldHitZero = savings + totalReservations >= pool;
  const belowAlert = budgetAlert > 0 && dailyBudget < budgetAlert && !poolWouldHitZero;
  const isEmpty = !data.savings && data.reservations.length === 0;

  function removeReservation(id: string) {
    update({ reservations: data.reservations.filter(r => r.id !== id) });
  }
  function addReservation() {
    if (!newResName.trim() || !newResAmount) return;
    const res: Reservation = { id: Date.now().toString(), name: newResName.trim().slice(0, 30), amount: newResAmount };
    update({ reservations: [...data.reservations, res] });
    setNewResName(''); setNewResAmount(''); setAddingReservation(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 24, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 4, marginRight: 16 }}>
            <Text style={{ fontSize: 22, color: colors.textPrimary }}>←</Text>
          </Pressable>
          <View style={{ flex: 1, height: 4, backgroundColor: colors.primaryLight, borderRadius: 2 }}>
            <View style={{ width: '75%', height: 4, backgroundColor: colors.primary, borderRadius: 2 }} />
          </View>
          <Text style={{ marginLeft: 12, fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_500Medium' }}>3 of 4</Text>
        </View>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary }}>Protect your money</Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 4 }}>
          Set aside savings or reserve money for specific things.
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* Live daily budget */}
        <View style={{ backgroundColor: colors.primaryLight, borderRadius: 16, padding: 16, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_500Medium' }}>Your daily budget</Text>
          <Text style={{ fontSize: 22, color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }}>
            ৳{dailyBudget > 0 ? Math.floor(dailyBudget).toLocaleString() : '—'}
          </Text>
        </View>

        {poolWouldHitZero && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: colors.error, fontFamily: 'PlusJakartaSans_500Medium' }}>
              Savings + reservations can&apos;t exceed your available pool of ৳{Math.round(pool).toLocaleString()}.
            </Text>
          </View>
        )}
        {belowAlert && (
          <View style={{ backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <Text style={{ fontSize: 12, color: '#92400E', fontFamily: 'PlusJakartaSans_400Regular' }}>
              Your daily budget is below your ৳{budgetAlert.toLocaleString()} alert. You can still proceed.
            </Text>
          </View>
        )}

        {/* Savings */}
        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary, marginBottom: 4 }}>Savings</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 8 }}>
          Protected from spending. Never touched unless you pull from it.
        </Text>
        <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1.5, borderColor: focused === 'savings' ? colors.textPrimary : colors.border, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 16, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_600SemiBold', marginRight: 4 }}>৳</Text>
          <TextInput
            value={data.savings}
            onChangeText={v => update({ savings: v.replace(/[^0-9.]/g, '') })}
            onFocus={() => setFocused('savings')}
            onBlur={() => setFocused(null)}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            style={{ flex: 1, fontSize: 16, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }}
          />
        </View>

        {/* Reservations */}
        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary, marginBottom: 4 }}>Reservations</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 12 }}>
          Money set aside for specific planned expenses.
        </Text>

        {data.reservations.map(r => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 }}>
            <Text style={{ flex: 1, fontSize: 15, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_500Medium' }}>{r.name}</Text>
            <Text style={{ fontSize: 15, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold', marginRight: 12 }}>
              ৳{parseFloat(r.amount).toLocaleString()}
            </Text>
            <Pressable onPress={() => removeReservation(r.id)} hitSlop={8}>
              <Text style={{ fontSize: 20, color: colors.textSecondary }}>×</Text>
            </Pressable>
          </View>
        ))}

        {addingReservation ? (
          <View style={{ backgroundColor: colors.background, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, padding: 16, marginBottom: 8 }}>
            <TextInput
              value={newResName}
              onChangeText={v => setNewResName(v.slice(0, 30))}
              onFocus={() => {
                setFocused('resName');
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 350);
              }}
              onBlur={() => setFocused(null)}
              placeholder="Name (e.g. Groceries, Gym)"
              placeholderTextColor={colors.textSecondary}
              style={{ fontSize: 15, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 12, borderBottomWidth: 1.5, borderBottomColor: focused === 'resName' ? colors.textPrimary : colors.border, paddingBottom: 10 }}
              autoFocus
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1.5, borderBottomColor: focused === 'resAmount' ? colors.textPrimary : colors.border, paddingBottom: 10 }}>
              <Text style={{ fontSize: 16, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_600SemiBold', marginRight: 4 }}>৳</Text>
              <TextInput
                value={newResAmount}
                onChangeText={v => setNewResAmount(v.replace(/[^0-9.]/g, ''))}
                onFocus={() => setFocused('resAmount')}
                onBlur={() => setFocused(null)}
                placeholder="Amount"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                style={{ flex: 1, fontSize: 15, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => { setAddingReservation(false); setNewResName(''); setNewResAmount(''); }} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_500Medium' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={addReservation} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: newResName.trim() && newResAmount ? colors.primary : colors.border }}>
                <Text style={{ fontSize: 14, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Add</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setAddingReservation(true)}
            style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8 }}
          >
            <Text style={{ fontSize: 20, color: colors.textSecondary, marginRight: 8 }}>+</Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>Add reservation</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={{ backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 24, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 24) }}>
        <Pressable
          onPress={() => { if (!poolWouldHitZero) { Keyboard.dismiss(); InteractionManager.runAfterInteractions(() => router.push('/onboarding/summary')); } }}
          style={{ backgroundColor: poolWouldHitZero ? colors.border : colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ color: poolWouldHitZero ? colors.textSecondary : '#fff', fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
            {isEmpty ? 'Skip' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
