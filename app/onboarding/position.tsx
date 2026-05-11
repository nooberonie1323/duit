import { useOnboarding } from '@/contexts/onboarding';
import { router } from 'expo-router';
import { InteractionManager, Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

export default function PositionScreen() {
  const insets = useSafeAreaInsets();
  const { data, update } = useOnboarding();
  const [focused, setFocused] = useState(false);

  const income = parseFloat(data.income) || 0;
  const rawAmount = data.positionMode === 'spent' ? data.alreadySpent : data.stillHave;
  const amount = parseFloat(rawAmount) || 0;
  const isEmpty = !data.positionMode || (!data.alreadySpent && !data.stillHave);

  const startDateInFuture = (() => {
    if (!data.cycleStartDate) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(data.cycleStartDate); start.setHours(0, 0, 0, 0);
    return start > today;
  })();

  let poolRemaining = income;
  if (data.positionMode === 'spent' && data.alreadySpent) poolRemaining = income - amount;
  if (data.positionMode === 'have' && data.stillHave) poolRemaining = amount;

  const isHardBlock = data.positionMode !== null && (
    (data.positionMode === 'spent' && amount >= income) ||
    (data.positionMode === 'have' && rawAmount !== '' && amount <= 0)
  );

  const budgetAlert = parseFloat(data.budgetAlert) || 0;
  const daysInCycle = data.cycleStartDate && data.cycleEndDate
    ? Math.round((data.cycleEndDate.getTime() - data.cycleStartDate.getTime()) / 86400000) : 1;
  const divisor = data.startFromToday ? daysInCycle + 1 : daysInCycle;
  const projectedDaily = divisor > 0 ? poolRemaining / divisor : 0;
  const showSoftWarning = !isHardBlock && budgetAlert > 0 && projectedDaily < budgetAlert && data.positionMode !== null && amount > 0;
  const canNext = !isEmpty && !isHardBlock;

  function handleModeSelect(mode: 'spent' | 'have') {
    update({ positionMode: mode, alreadySpent: '', stillHave: '' });
  }
  function handleAmountChange(v: string) {
    const clean = v.replace(/[^0-9.]/g, '');
    if (data.positionMode === 'spent') update({ alreadySpent: clean });
    else update({ stillHave: clean });
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 24, paddingBottom: 16, backgroundColor: '#F9FAFB' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 4, marginRight: 16 }}>
            <Text style={{ fontSize: 22, color: '#111827' }}>←</Text>
          </Pressable>
          <View style={{ flex: 1, height: 3, backgroundColor: '#E5E7EB', borderRadius: 2 }}>
            <View style={{ width: '50%', height: 3, backgroundColor: '#16A34A', borderRadius: 2 }} />
          </View>
          <Text style={{ marginLeft: 12, fontSize: 11, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 0.5 }}>
            2 / 4
          </Text>
        </View>
        <Text style={{ fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.5 }}>
          Where are you now?
        </Text>
        <Text style={{ fontSize: 14, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular', marginTop: 3 }}>
          Starting mid-cycle? Tell us your current position.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* ── Mode selector ── */}
        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#6B7280', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2 }}>
          How do you want to tell us?
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {(['spent', 'have'] as const).map(mode => {
            const selected = data.positionMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => handleModeSelect(mode)}
                style={{
                  flex: 1,
                  backgroundColor: selected ? '#16A34A' : '#fff',
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: selected ? '#16A34A' : '#E5E7EB',
                  paddingVertical: 16,
                  paddingHorizontal: 14,
                  alignItems: 'flex-start',
                }}
              >
                <Text style={{
                  fontSize: 18,
                  marginBottom: 6,
                }}>
                  {mode === 'spent' ? '💸' : '💰'}
                </Text>
                <Text style={{
                  fontSize: 14,
                  fontFamily: 'PlusJakartaSans_700Bold',
                  color: selected ? '#fff' : '#111827',
                  marginBottom: 2,
                }}>
                  {mode === 'spent' ? 'Already spent' : 'Still have'}
                </Text>
                <Text style={{
                  fontSize: 11,
                  fontFamily: 'PlusJakartaSans_400Regular',
                  color: selected ? 'rgba(255,255,255,0.75)' : '#9CA3AF',
                }}>
                  {mode === 'spent' ? 'How much you spent' : 'How much is left'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Amount input ── */}
        {data.positionMode && (
          <>
            <View style={{
              backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5,
              borderColor: isHardBlock ? '#EF4444' : focused ? '#111827' : '#E5E7EB',
              paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10,
            }}>
              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                {data.positionMode === 'spent' ? 'Amount spent' : 'Amount remaining'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 22, color: rawAmount ? '#111827' : '#D1D5DB', fontFamily: 'PlusJakartaSans_700Bold', marginRight: 3, lineHeight: 30 }}>৳</Text>
                <TextInput
                  value={rawAmount}
                  onChangeText={handleAmountChange}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="0"
                  placeholderTextColor="#D1D5DB"
                  keyboardType="decimal-pad"
                  style={{ flex: 1, fontSize: 28, color: '#111827', fontFamily: 'PlusJakartaSans_700Bold', lineHeight: 34 }}
                />
              </View>
            </View>

            {isHardBlock && (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <Text style={{ fontSize: 13, color: '#EF4444', fontFamily: 'PlusJakartaSans_500Medium' }}>
                  {data.positionMode === 'spent' ? 'Cannot exceed your total income of ৳' + income.toLocaleString() : 'Amount must be more than ৳0.'}
                </Text>
              </View>
            )}

            {!isHardBlock && amount > 0 && (
              <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 16 }}>✓</Text>
                <Text style={{ fontSize: 13, color: '#16A34A', fontFamily: 'PlusJakartaSans_500Medium', flex: 1 }}>
                  {data.positionMode === 'spent'
                    ? `৳${(income - amount).toLocaleString()} remaining in your pool`
                    : `৳${(income - amount).toLocaleString()} already spent`}
                </Text>
              </View>
            )}

            {showSoftWarning && (
              <View style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <Text style={{ fontSize: 12, color: '#92400E', fontFamily: 'PlusJakartaSans_400Regular' }}>
                  Projected daily budget drops below your ৳{budgetAlert.toLocaleString()} alert.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── Start from today/tomorrow ── always shown when date is not future */}
        {!startDateInFuture && (
          <>
            <View style={{ height: data.positionMode ? 8 : 0 }} />
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#6B7280', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2 }}>
              Start budgeting from
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {([true, false] as const).map(val => {
                const selected = data.startFromToday === val;
                return (
                  <Pressable
                    key={String(val)}
                    onPress={() => update({ startFromToday: val })}
                    style={{
                      flex: 1,
                      backgroundColor: selected ? '#F0FDF4' : '#fff',
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: selected ? '#16A34A' : '#E5E7EB',
                      paddingVertical: 16,
                      paddingHorizontal: 14,
                      alignItems: 'flex-start',
                    }}
                  >
                    <Text style={{ fontSize: 18, marginBottom: 6 }}>
                      {val ? '📅' : '⏭️'}
                    </Text>
                    <Text style={{
                      fontSize: 15,
                      fontFamily: 'PlusJakartaSans_700Bold',
                      color: selected ? '#16A34A' : '#111827',
                      marginBottom: 2,
                    }}>
                      {val ? 'Today' : 'Tomorrow'}
                    </Text>
                    <Text style={{
                      fontSize: 11,
                      fontFamily: 'PlusJakartaSans_400Regular',
                      color: selected ? '#16A34A' : '#9CA3AF',
                    }}>
                      {val ? 'Count today as day 1' : 'Skip today'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={{ backgroundColor: '#F9FAFB', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingHorizontal: 20, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 24) }}>
        <Pressable
          onPress={() => {
            if (isEmpty || canNext) {
              Keyboard.dismiss();
              InteractionManager.runAfterInteractions(() => router.push('/onboarding/protect'));
            }
          }}
          style={{ backgroundColor: (!isEmpty && !canNext) ? '#E5E7EB' : '#16A34A', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ color: (!isEmpty && !canNext) ? '#9CA3AF' : '#fff', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 0.2 }}>
            {isEmpty ? 'Skip' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
