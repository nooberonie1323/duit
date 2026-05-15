import { useOnboarding } from '@/contexts/onboarding';
import { saveSettings } from '@/services/settingsService';
import { createCycle } from '@/services/cycleService';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function fmtShort(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtFull(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const SectionLabel = ({ children }: { children: string }) => (
  <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2 }}>
    {children}
  </Text>
);

const Divider = () => <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />;

export default function SummaryScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { data } = useOnboarding();
  const [saving, setSaving] = useState(false);

  const income = parseFloat(data.income) || 0;
  const savings = parseFloat(data.savings) || 0;
  const alreadySpent = parseFloat(data.alreadySpent) || 0;
  const stillHave = parseFloat(data.stillHave) || 0;
  const pool = data.positionMode === 'have' && stillHave > 0 ? stillHave : income - alreadySpent;
  const totalReservations = data.reservations.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const daysInCycle = data.cycleStartDate && data.cycleEndDate
    ? Math.round((data.cycleEndDate.getTime() - data.cycleStartDate.getTime()) / 86400000) : 1;
  const divisor = data.startFromToday ? daysInCycle + 1 : daysInCycle;
  const dailyBudget = divisor > 0 ? (pool - savings - totalReservations) / divisor : 0;

  const startInFuture = (() => {
    if (!data.cycleStartDate) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const s = new Date(data.cycleStartDate); s.setHours(0, 0, 0, 0);
    return s > today;
  })();

  const poolWouldHitZero = savings + totalReservations >= pool;
  const budgetAlert = parseFloat(data.budgetAlert) || 0;
  const belowAlert = budgetAlert > 0 && dailyBudget < budgetAlert && !poolWouldHitZero;
  const canConfirm = !poolWouldHitZero && data.name.trim() && data.cycleStartDate && data.cycleEndDate && income >= 1;

  const hasPosition = data.positionMode !== null && (data.alreadySpent || data.stillHave);
  const hasProtect = savings > 0 || data.reservations.length > 0;

  const rowStyle = { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingVertical: 13, paddingHorizontal: 16 };
  const labelStyle = { fontSize: 13, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' };
  const valueStyle = { fontSize: 13, color: '#111827', fontFamily: 'PlusJakartaSans_600SemiBold' };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 24, paddingBottom: 14, backgroundColor: '#F9FAFB' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ marginRight: 16, backgroundColor: '#111827', borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 16, color: '#fff', fontFamily: 'PlusJakartaSans_700Bold', includeFontPadding: false, lineHeight: 16 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1, height: 3, backgroundColor: '#E5E7EB', borderRadius: 2 }}>
            <View style={{ width: '100%', height: 3, backgroundColor: '#16A34A', borderRadius: 2 }} />
          </View>
          <Text style={{ marginLeft: 12, fontSize: 11, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 0.5 }}>
            4 / 4
          </Text>
        </View>
        <Text style={{ fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.5 }}>
          Looks good?
        </Text>
        <Text style={{ fontSize: 14, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular', marginTop: 3 }}>
          Review everything before we begin.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={{ backgroundColor: '#16A34A', borderRadius: 20, padding: 24, marginBottom: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
            Your daily budget
          </Text>
          <Text style={{ fontSize: 48, color: '#fff', fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -1 }}>
            ৳{dailyBudget > 0 ? Math.floor(dailyBudget).toLocaleString() : '—'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontFamily: 'PlusJakartaSans_500Medium' }}>per day</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontFamily: 'PlusJakartaSans_500Medium' }}>{daysInCycle}-day cycle</Text>
            </View>
          </View>
        </View>

        {/* Errors */}
        {poolWouldHitZero && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 16 }}>⚠️</Text>
            <Text style={{ fontSize: 13, color: '#EF4444', fontFamily: 'PlusJakartaSans_500Medium', flex: 1 }}>
              Savings + reservations exceed your pool. Go back and adjust.
            </Text>
          </View>
        )}
        {belowAlert && (
          <View style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 16 }}>⚡</Text>
            <Text style={{ fontSize: 13, color: '#92400E', fontFamily: 'PlusJakartaSans_400Regular', flex: 1 }}>
              Daily budget is below your ৳{budgetAlert.toLocaleString()} alert.
            </Text>
          </View>
        )}

        {/* ── The basics ── */}
        <SectionLabel>The basics</SectionLabel>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 14, overflow: 'hidden' }}>
          <View style={rowStyle}>
            <Text style={labelStyle}>Name</Text>
            <Text style={valueStyle}>{data.name}</Text>
          </View>
          <Divider />
          <View style={rowStyle}>
            <Text style={labelStyle}>Cycle</Text>
            <Text style={valueStyle}>
              {data.cycleStartDate && data.cycleEndDate
                ? `${fmtShort(data.cycleStartDate)} – ${fmtFull(data.cycleEndDate)}`
                : '—'}
            </Text>
          </View>
          <Divider />
          <View style={rowStyle}>
            <Text style={labelStyle}>Income</Text>
            <Text style={valueStyle}>৳{income.toLocaleString()}</Text>
          </View>
          <Divider />
          <View style={rowStyle}>
            <Text style={labelStyle}>Budget alert</Text>
            <Text style={valueStyle}>{budgetAlert > 0 ? `৳${budgetAlert.toLocaleString()}` : 'Off'}</Text>
          </View>
        </View>

        {/* ── Starting position ── */}
        {(hasPosition || !startInFuture) && (
          <>
            <SectionLabel>Starting position</SectionLabel>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 14, overflow: 'hidden' }}>
              {hasPosition && (
                <>
                  <View style={rowStyle}>
                    <Text style={labelStyle}>{data.positionMode === 'spent' ? 'Already spent' : 'Still have'}</Text>
                    <Text style={valueStyle}>
                      ৳{(data.positionMode === 'spent'
                        ? parseFloat(data.alreadySpent)
                        : parseFloat(data.stillHave)).toLocaleString()}
                    </Text>
                  </View>
                  {!startInFuture && <Divider />}
                </>
              )}
              {!startInFuture && (
                <View style={rowStyle}>
                  <Text style={labelStyle}>Budgeting from</Text>
                  <Text style={valueStyle}>{data.startFromToday ? 'Today' : 'Tomorrow'}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* ── Protected money ── */}
        {hasProtect && (
          <>
            <SectionLabel>Protected money</SectionLabel>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 14, overflow: 'hidden' }}>
              {savings > 0 && (
                <>
                  <View style={rowStyle}>
                    <Text style={labelStyle}>Savings</Text>
                    <Text style={valueStyle}>৳{savings.toLocaleString()}</Text>
                  </View>
                  {data.reservations.length > 0 && <Divider />}
                </>
              )}
              {data.reservations.map((r, i) => (
                <View key={r.id}>
                  <View style={rowStyle}>
                    <Text style={labelStyle}>{r.name}</Text>
                    <Text style={valueStyle}>৳{parseFloat(r.amount).toLocaleString()}</Text>
                  </View>
                  {i < data.reservations.length - 1 && <Divider />}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={{ backgroundColor: '#F9FAFB', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingHorizontal: 20, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 24) }}>
        <Pressable
          onPress={async () => {
            if (!canConfirm || saving) return;
            setSaving(true);
            try {
              let alreadySpent = 0;
              if (data.positionMode === 'spent') {
                alreadySpent = parseFloat(data.alreadySpent) || 0;
              } else if (data.positionMode === 'have') {
                const stillHave = parseFloat(data.stillHave) || 0;
                alreadySpent = income - stillHave;
              }

              await saveSettings(db, data.name);
              await createCycle(db, {
                startDate: data.cycleStartDate!,
                endDate: data.cycleEndDate!,
                income,
                alreadySpent,
                savings,
                budgetAlert,
                startFromToday: data.startFromToday,
                poolLeftover: 0,
                reservations: data.reservations.map(r => ({
                  name: r.name,
                  amount: parseFloat(r.amount) || 0,
                })),
              });

              router.replace('/(tabs)');
            } catch (e) {
              console.error('[Finalize error]', e);
              setSaving(false);
            }
          }}
          style={{ backgroundColor: canConfirm ? '#16A34A' : '#E5E7EB', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: canConfirm ? '#fff' : '#9CA3AF', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 0.2 }}>Finalize</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}
