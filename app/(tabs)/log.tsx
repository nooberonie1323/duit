import { useThemeColors } from '@/contexts/theme';
import { fromDateStr } from '@/lib/db';
import { getAllReviewedDays, getDayEntries, type EntryRow, type ReviewedDayWithCycle } from '@/services/entryService';
import { LinearGradient } from 'expo-linear-gradient';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function fmtDay(dateStr: string) {
  return fromDateStr(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtCycleRange(start: string, end: string) {
  const s = fromDateStr(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = fromDateStr(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

interface CycleGroup {
  cycleId: number;
  cycleStart: string;
  cycleEnd: string;
  days: ReviewedDayWithCycle[];
}

interface DayDetail {
  day: ReviewedDayWithCycle;
  entries: EntryRow[];
}

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const db = useSQLiteContext();
  const [groups, setGroups] = useState<CycleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    const allDays = await getAllReviewedDays(db);
    const map = new Map<number, CycleGroup>();
    for (const day of allDays) {
      if (!map.has(day.cycle_id)) {
        map.set(day.cycle_id, { cycleId: day.cycle_id, cycleStart: day.cycle_start, cycleEnd: day.cycle_end, days: [] });
      }
      map.get(day.cycle_id)!.days.push(day);
    }
    // newest cycle first
    setGroups(Array.from(map.values()).sort((a, b) => b.cycleId - a.cycleId));
    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  async function openDay(day: ReviewedDayWithCycle) {
    setLoadingDetail(true);
    const entries = await getDayEntries(db, day.id);
    setDetail({ day, entries });
    setLoadingDetail(false);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const hasAny = groups.some(g => g.days.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -0.5 }}>
          Log
        </Text>
      </View>

      {!hasAny ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>📭</Text>
          <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary, marginBottom: 6 }}>
            Nothing here yet
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', paddingHorizontal: 40 }}>
            Reviewed days will appear here after you confirm your daily review.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16) + 76 + 24 }}
          scrollIndicatorInsets={{ bottom: Math.max(insets.bottom, 16) + 76 }}
        >
          {groups.map((group, gi) => (
            <View key={group.cycleId} style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>
                {fmtCycleRange(group.cycleStart, group.cycleEnd)}
              </Text>
              <View style={{ backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
                {group.days.map((day, i) => {
                  const saved = day.daily_budget - day.total_spent;
                  const didSave = saved >= 0;
                  return (
                    <Pressable
                      key={day.id}
                      onPress={() => openDay(day)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        borderBottomWidth: i < group.days.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary, marginBottom: 3 }}>
                          {fmtDay(day.date)}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
                          spent ৳{Math.floor(day.total_spent).toLocaleString()}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: didSave ? colors.primary : colors.error }}>
                          {didSave ? `+৳${Math.floor(saved).toLocaleString()}` : `-৳${Math.floor(Math.abs(saved)).toLocaleString()}`}
                        </Text>
                        <Text style={{ fontSize: 11, color: didSave ? colors.primary : colors.error, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 1 }}>
                          {didSave ? 'saved' : 'overspent'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 16, color: colors.textSecondary }}>›</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Bottom fade */}
      <LinearGradient
        colors={['transparent', colors.background]}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: Math.max(insets.bottom, 16) + 76 + 32,
          pointerEvents: 'none',
        }}
      />

      {/* Day detail modal */}
      <Modal visible={!!detail || loadingDetail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={() => setDetail(null)}
        >
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            <View style={{ backgroundColor: colors.card, borderRadius: 20, paddingTop: 22, paddingBottom: 8, maxHeight: '80%' }}>
              {loadingDetail || !detail ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, marginBottom: 16 }}>
                    <View>
                      <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary }}>
                        {fmtDay(detail.day.date)}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
                        ৳{Math.floor(detail.day.total_spent).toLocaleString()} spent · budget ৳{Math.floor(detail.day.daily_budget).toLocaleString()}
                      </Text>
                    </View>
                    <Pressable onPress={() => setDetail(null)} hitSlop={8}>
                      <Text style={{ fontSize: 22, color: colors.textSecondary, lineHeight: 24, includeFontPadding: false }}>×</Text>
                    </Pressable>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                    {detail.entries.length === 0 ? (
                      <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', paddingVertical: 24 }}>
                        No entries for this day.
                      </Text>
                    ) : (
                      detail.entries.map((entry, i) => (
                        <View
                          key={entry.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 12,
                            paddingHorizontal: 20,
                            borderTopWidth: i === 0 ? 1 : 0,
                            borderBottomWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text style={{ flex: 1, fontSize: 14, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }} numberOfLines={1}>
                            {entry.note || 'general spending'}
                          </Text>
                          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary }}>
                            ৳{entry.amount.toLocaleString()}
                          </Text>
                        </View>
                      ))
                    )}
                  </ScrollView>

                  {detail.day.notes ? (
                    <View style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: colors.background, borderRadius: 12, padding: 12 }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Note</Text>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }}>{detail.day.notes}</Text>
                    </View>
                  ) : null}

                  {(() => {
                    const saved = detail.day.daily_budget - detail.day.total_spent;
                    const didSave = saved >= 0;
                    return (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 }}>
                        <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
                          {didSave ? 'Saved' : 'Overspent'}
                        </Text>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: didSave ? colors.primary : colors.error }}>
                          ৳{Math.floor(Math.abs(saved)).toLocaleString()}
                        </Text>
                      </View>
                    );
                  })()}
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
