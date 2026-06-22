import { useThemeColors } from '@/contexts/theme';
import type { ActiveCycleData, ReservationRow } from '@/services/cycleService';
import type { EntryRow } from '@/services/entryService';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

interface Props {
  cycleData: ActiveCycleData;
  entries: EntryRow[];
  cycleTotalSpent: number;
  navPillOffset: number;
  insets: EdgeInsets;
  reviewAvailable: boolean;
  onStartReview: () => void;
  onSnoozeReview: (minutes: number) => void;
  onOpenAdd: () => void;
  onOpenEdit: (entry: EntryRow) => void;
  onDeleteEntry: (entry: EntryRow) => void;
  onSelectReservation: (r: ReservationRow) => void;
  savingsWithdrawn: number;
  onPressSavings: () => void;
}

const ALL_SNOOZE_OPTIONS = [
  { label: 'In 30 min', minutes: 30 },
  { label: 'In 1 hour', minutes: 60 },
] as const;

export function NormalState({
  cycleData, entries, cycleTotalSpent,
  navPillOffset, insets,
  reviewAvailable, onStartReview, onSnoozeReview,
  onOpenAdd, onOpenEdit, onDeleteEntry,
  onSelectReservation,
  savingsWithdrawn,
  onPressSavings,
}: Props) {
  const colors = useThemeColors();
  const [showSnoozePicker, setShowSnoozePicker] = useState(false);
  const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
  const snoozeOptions = ALL_SNOOZE_OPTIONS.filter(
    ({ minutes }) => Date.now() + minutes * 60 * 1000 < midnight.getTime()
  );
  const totalSpent = entries.reduce((s, e) => s + e.amount, 0);
  const leftToday = cycleData.dailyBudget - totalSpent;
  const overspentBy = totalSpent > cycleData.dailyBudget ? totalSpent - cycleData.dailyBudget : 0;
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const card = {
    backgroundColor: colors.card,
    borderRadius: 20,
    marginHorizontal: 16,
    shadowColor: '#000' as const,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 16 }}>
        {/* Hero */}
        <View style={{ marginHorizontal: 16, borderRadius: 20, shadowColor: '#16A34A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 }}>
          <View style={{ backgroundColor: colors.primary, borderRadius: 20, padding: 22, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', top: -35, right: -35, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.07)' }} />
            <View style={{ position: 'absolute', bottom: -55, left: -25, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' }}>{dateStr}</Text>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                  {cycleData.daysLeft} {cycleData.daysLeft === 1 ? 'day' : 'days'} left
                </Text>
              </View>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
              Left today
            </Text>
            <Text style={{ color: '#fff', fontSize: 52, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -2, lineHeight: 56 }}>
              ৳{Math.max(0, Math.floor(leftToday)).toLocaleString()}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 8 }}>
              of ৳{Math.floor(cycleData.dailyBudget).toLocaleString()} daily budget
            </Text>
            {overspentBy > 0 && (
              <View style={{ marginTop: 10, backgroundColor: 'rgba(239,68,68,0.25)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' }}>
                <Text style={{ color: '#FCA5A5', fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                  over by ৳{Math.floor(overspentBy).toLocaleString()} today
                </Text>
              </View>
            )}
            <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' }}>Left in cycle</Text>
              <Text style={{ color: '#fff', fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' }}>
                ৳{Math.floor(Math.max(0, cycleData.leftInCycle - totalSpent)).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 12 }} />

        {/* Reservations row */}
        {(cycleData.reservations.length > 0 || cycleData.cycle.savings > 0) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            style={{ marginBottom: 12 }}
          >
            {cycleData.cycle.savings > 0 && (() => {
              const savingsRemaining = cycleData.cycle.savings - savingsWithdrawn;
              const fullyUsed = savingsRemaining <= 0;
              const partiallyUsed = savingsWithdrawn > 0 && !fullyUsed;
              return (
                <Pressable
                  onPress={onPressSavings}
                  style={{
                    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: colors.primaryLight,
                    borderWidth: fullyUsed ? 1 : 0,
                    borderColor: fullyUsed ? '#86EFAC' : 'transparent',
                    opacity: fullyUsed ? 0.6 : 1,
                  }}
                >
                  {fullyUsed && <Text style={{ fontSize: 11, color: colors.primary }}>✓</Text>}
                  <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Savings</Text>
                  {partiallyUsed ? (
                    <>
                      <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }}>
                        ৳{Math.floor(savingsRemaining).toLocaleString()}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'PlusJakartaSans_400Regular', opacity: 0.6 }}>
                        / ৳{Math.floor(cycleData.cycle.savings).toLocaleString()}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }}>
                      ৳{fullyUsed ? '0' : Math.floor(cycleData.cycle.savings).toLocaleString()}
                    </Text>
                  )}
                </Pressable>
              );
            })()}
            {cycleData.reservations.map(r => {
              const remaining = r.amount - r.spent - r.released;
              const done = remaining <= 0;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => onSelectReservation(r)}
                  style={{
                    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: done ? colors.primaryLight : colors.background,
                    borderWidth: 1, borderColor: done ? '#86EFAC' : colors.border,
                  }}
                >
                  {done && <Text style={{ fontSize: 11, color: colors.primary }}>✓</Text>}
                  <Text style={{ fontSize: 11, color: done ? colors.primary : colors.textSecondary, fontFamily: 'PlusJakartaSans_500Medium' }}>{r.name}</Text>
                  <Text style={{ fontSize: 11, color: done ? colors.primary : colors.textPrimary, fontFamily: 'PlusJakartaSans_700Bold' }}>৳{Math.floor(Math.max(0, remaining)).toLocaleString()}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Spending card */}
        <View style={card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary }}>Spending</Text>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: totalSpent > 0 ? colors.textPrimary : colors.textSecondary }}>
              ৳{totalSpent.toLocaleString()}
            </Text>
          </View>
          <Pressable onPress={onOpenAdd} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 }}>
            <Text style={{ fontSize: 20, color: colors.primary, lineHeight: 22, includeFontPadding: false }}>+</Text>
            <Text style={{ fontSize: 14, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Add spend</Text>
          </Pressable>
        </View>
      </View>

      {/* Log card */}
      {entries.length > 0 && (
        <View style={{ flex: 1, marginTop: 12, marginHorizontal: 16, paddingBottom: navPillOffset }}>
          <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary }}>Today&apos;s log</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
                {entries.length} {entries.length === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <FlatList
              data={entries}
              keyExtractor={item => String(item.id)}
              showsVerticalScrollIndicator
              renderItem={({ item: entry, index: i }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: i < entries.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                  <Pressable
                    onPress={() => onOpenEdit(entry)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingLeft: 16, paddingRight: 8 }}
                  >
                    <Text style={{ flex: 1, fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }} numberOfLines={1}>
                      {entry.note || 'general spending'}
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_600SemiBold', marginRight: 4 }}>
                      ৳{entry.amount.toLocaleString()}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => onDeleteEntry(entry)} hitSlop={8} style={{ paddingVertical: 13, paddingRight: 16, paddingLeft: 8 }}>
                    <Text style={{ fontSize: 18, color: colors.error, lineHeight: 20, includeFontPadding: false }}>×</Text>
                  </Pressable>
                </View>
              )}
              ListFooterComponent={entries.length > 4 ? (
                <View style={{ paddingVertical: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', letterSpacing: 0.5 }}>scroll for more  ↕</Text>
                </View>
              ) : null}
            />
          </View>
        </View>
      )}

      {/* Review banner */}
      {reviewAvailable && (
        <View style={{ position: 'absolute', bottom: navPillOffset + 10, left: 16, right: 16 }}>
          <Pressable
            onPress={onStartReview}
            style={{ backgroundColor: colors.warning, borderRadius: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 }}
          >
            <Text style={{ fontSize: 16 }}>⏰</Text>
            <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_700Bold' }}>Time to review your day</Text>
          </Pressable>
          {snoozeOptions.length > 0 && (
            !showSnoozePicker ? (
              <Pressable onPress={() => setShowSnoozePicker(true)} style={{ alignItems: 'center', paddingTop: 8 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_500Medium' }}>Remind me later</Text>
              </Pressable>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {snoozeOptions.map(({ label, minutes }) => (
                  <Pressable
                    key={label}
                    onPress={() => { onSnoozeReview(minutes); setShowSnoozePicker(false); }}
                    style={{ flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
                  >
                    <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_500Medium' }}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            )
          )}
        </View>
      )}
    </View>
  );
}
