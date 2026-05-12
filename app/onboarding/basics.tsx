import { CalendarModal } from '@/components/ui/CalendarModal';
import { useOnboarding } from '@/contexts/onboarding';
import { router } from 'expo-router';
import { useState } from 'react';
import { InteractionManager, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function fmt(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

export default function BasicsScreen() {
  const insets = useSafeAreaInsets();
  const { data, update } = useOnboarding();
  const [showStartCal, setShowStartCal] = useState(false);
  const [showEndCal, setShowEndCal] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const daysInCycle = data.cycleStartDate && data.cycleEndDate
    ? Math.round((data.cycleEndDate.getTime() - data.cycleStartDate.getTime()) / 86400000) : 0;
  const income = parseFloat(data.income) || 0;
  const budgetAlert = data.budgetAlert === '' ? null : parseFloat(data.budgetAlert);
  const estimatedDaily = daysInCycle > 0 ? income / daysInCycle : 0;

  const nameOk = data.name.trim().length > 0;
  const datesOk = !!data.cycleStartDate && !!data.cycleEndDate && daysInCycle >= 2;
  const incomeOk = income >= 1;
  const alertOk = budgetAlert !== null && budgetAlert >= 0;
  const canNext = nameOk && datesOk && incomeOk && alertOk;

  const showEndDateError = !!data.cycleEndDate && daysInCycle < 2 && daysInCycle > 0;
  const showIncomeError = !!data.income && !incomeOk;
  const showAlertZeroMsg = data.budgetAlert === '0';
  const showAlertHighWarning = budgetAlert !== null && budgetAlert > 0 && estimatedDaily > 0 && budgetAlert > estimatedDaily;

  const bc = (field: string) => focused === field ? '#111827' : '#E5E7EB';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 24, paddingBottom: 16, backgroundColor: '#F9FAFB' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 4, marginRight: 16 }}>
            <Text style={{ fontSize: 22, color: '#111827' }}>←</Text>
          </Pressable>
          <View style={{ flex: 1, height: 3, backgroundColor: '#E5E7EB', borderRadius: 2 }}>
            <View style={{ width: '25%', height: 3, backgroundColor: '#16A34A', borderRadius: 2 }} />
          </View>
          <Text style={{ marginLeft: 12, fontSize: 11, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 0.5 }}>
            1 / 4
          </Text>
        </View>
        <Text style={{ fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.5 }}>
          The basics
        </Text>
        <Text style={{ fontSize: 14, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular', marginTop: 3 }}>
          Let's set up your first pay cycle.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* ── Name ── */}
        <View style={{ marginBottom: 12 }}>
          <View style={{
            backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5,
            borderColor: bc('name'), paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
          }}>
            <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
              Your name
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                value={data.name}
                onChangeText={v => update({ name: v.slice(0, 20) })}
                onFocus={() => setFocused('name')}
                onBlur={() => setFocused(null)}
                placeholder="What should we call you?"
                placeholderTextColor="#D1D5DB"
                style={{ flex: 1, fontSize: 17, color: '#111827', fontFamily: 'PlusJakartaSans_500Medium' }}
                maxLength={20}
                autoCapitalize="words"
              />
              <Text style={{ fontSize: 11, color: '#D1D5DB', fontFamily: 'PlusJakartaSans_400Regular' }}>
                {data.name.length}/20
              </Text>
            </View>
          </View>
        </View>

        {/* ── Pay cycle ── */}
        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#6B7280', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2 }}>
            Pay cycle
          </Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', overflow: 'hidden' }}>
            {/* Date range row */}
            <View style={{ flexDirection: 'row' }}>
              <Pressable
                onPress={() => setShowStartCal(true)}
                style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 14 }}
              >
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 }}>
                  Start
                </Text>
                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: data.cycleStartDate ? '#111827' : '#D1D5DB' }}>
                  {data.cycleStartDate ? fmt(data.cycleStartDate) : 'Pick date'}
                </Text>
              </Pressable>

              {/* Divider with arrow */}
              <View style={{ width: 36, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 1, backgroundColor: '#F3F4F6', position: 'absolute', top: 0, bottom: 0 }} />
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, zIndex: 1 }}>
                  <Text style={{ fontSize: 13, color: '#16A34A', fontFamily: 'PlusJakartaSans_600SemiBold' }}>→</Text>
                </View>
              </View>

              <Pressable
                onPress={() => setShowEndCal(true)}
                style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 14 }}
              >
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 }}>
                  End
                </Text>
                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: data.cycleEndDate ? '#111827' : '#D1D5DB' }}>
                  {data.cycleEndDate ? fmt(data.cycleEndDate) : 'Pick date'}
                </Text>
              </Pressable>
            </View>

            {/* Cycle length badge */}
            {(daysInCycle >= 2 || showEndDateError) && (
              <View style={{
                paddingHorizontal: 16, paddingVertical: 10,
                borderTopWidth: 1, borderTopColor: '#F3F4F6',
                backgroundColor: showEndDateError ? '#FEF2F2' : '#F0FDF4',
                flexDirection: 'row', alignItems: 'center', gap: 6,
              }}>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: showEndDateError ? '#EF4444' : '#16A34A' }}>
                  {showEndDateError
                    ? '⚠ End date must be at least 2 days after start'
                    : `✓  ${daysInCycle}-day cycle`}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 16 }} />

        {/* ── Finances card ── */}
        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#6B7280', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2 }}>
          Finances
        </Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', overflow: 'hidden' }}>
          {/* Income */}
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
              Income this cycle
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 22, color: data.income ? '#111827' : '#D1D5DB', fontFamily: 'PlusJakartaSans_700Bold', marginRight: 3, lineHeight: 30 }}>৳</Text>
              <TextInput
                value={data.income}
                onChangeText={v => update({ income: v.replace(/[^0-9.]/g, '') })}
                onFocus={() => setFocused('income')}
                onBlur={() => setFocused(null)}
                placeholder="0"
                placeholderTextColor="#D1D5DB"
                keyboardType="decimal-pad"
                style={{ flex: 1, fontSize: 28, color: '#111827', fontFamily: 'PlusJakartaSans_700Bold', lineHeight: 34 }}
              />
            </View>
            {showIncomeError && (
              <Text style={{ fontSize: 12, color: '#EF4444', fontFamily: 'PlusJakartaSans_400Regular', marginTop: 4 }}>
                Income must be at least ৳1.
              </Text>
            )}
          </View>

          {/* Budget alert */}
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                Budget alert
              </Text>
              <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular', flex: 1, textAlign: 'right', marginLeft: 8 }}>
                Warn when daily budget drops below
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: data.budgetAlert ? '#111827' : '#D1D5DB', fontFamily: 'PlusJakartaSans_600SemiBold', marginRight: 3 }}>৳</Text>
              <TextInput
                value={data.budgetAlert}
                onChangeText={v => update({ budgetAlert: v.replace(/[^0-9.]/g, '') })}
                onFocus={() => setFocused('alert')}
                onBlur={() => setFocused(null)}
                placeholder="0 — no warnings"
                placeholderTextColor="#D1D5DB"
                keyboardType="decimal-pad"
                style={{ flex: 1, fontSize: 18, color: '#111827', fontFamily: 'PlusJakartaSans_600SemiBold' }}
              />
            </View>
          </View>

          {/* Inline messages */}
          {showAlertZeroMsg && (
            <View style={{ marginHorizontal: 12, marginBottom: 12, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12 }}>
              <Text style={{ fontSize: 12, color: '#16A34A', fontFamily: 'PlusJakartaSans_400Regular' }}>
                No warnings — the app won't flag low daily budgets.
              </Text>
            </View>
          )}
          {showAlertHighWarning && (
            <View style={{ marginHorizontal: 12, marginBottom: 12, backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12 }}>
              <Text style={{ fontSize: 12, color: '#92400E', fontFamily: 'PlusJakartaSans_400Regular' }}>
                Higher than your estimated daily budget of ৳{Math.round(estimatedDaily).toLocaleString()}. Consider lowering it.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={{ backgroundColor: '#F9FAFB', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingHorizontal: 20, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 24) }}>
        <Pressable
          onPress={() => { if (canNext) { Keyboard.dismiss(); InteractionManager.runAfterInteractions(() => router.push('/onboarding/position')); } }}
          style={{ backgroundColor: canNext ? '#16A34A' : '#E5E7EB', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ color: canNext ? '#fff' : '#9CA3AF', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 0.2 }}>
            Next
          </Text>
        </Pressable>
      </View>

      <CalendarModal
        visible={showStartCal}
        onClose={() => setShowStartCal(false)}
        onSelect={d => { update({ cycleStartDate: d, cycleEndDate: null }); setShowStartCal(false); }}
        value={data.cycleStartDate}
        title="Cycle start date"
      />
      <CalendarModal
        visible={showEndCal}
        onClose={() => setShowEndCal(false)}
        onSelect={d => { update({ cycleEndDate: d }); setShowEndCal(false); }}
        value={data.cycleEndDate}
        minimumDate={data.cycleStartDate ? addDays(data.cycleStartDate, 2) : undefined}
        title="Cycle end date"
      />
    </KeyboardAvoidingView>
  );
}
