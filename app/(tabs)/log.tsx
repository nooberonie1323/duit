import { useThemeColors } from '@/contexts/theme';
import { fromDateStr } from '@/lib/db';
import {
  getCycleSummaries,
  getDayEntries,
  getReviewedDays,
  type CycleSummary,
  type EntryRow,
  type ReviewedDay,
} from '@/services/entryService';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function fmtDay(dateStr: string) {
  return fromDateStr(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtCycleRange(start: string, end: string) {
  const s = fromDateStr(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = fromDateStr(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

interface DayDetail {
  day: ReviewedDay;
  entries: EntryRow[];
}

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const db = useSQLiteContext();

  const [summaries, setSummaries] = useState<CycleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [loadedDays, setLoadedDays] = useState<Map<number, ReviewedDay[]>>(new Map());
  const [loadingCycleId, setLoadingCycleId] = useState<number | null>(null);

  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    const s = await getCycleSummaries(db);
    setSummaries(s);
    if (s.length > 0) {
      const days = await getReviewedDays(db, s[0].cycle_id);
      setLoadedDays(new Map([[s[0].cycle_id, days]]));
      setExpandedIds(new Set([s[0].cycle_id]));
    }
    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  async function toggleCycle(cycleId: number) {
    if (expandedIds.has(cycleId)) {
      setExpandedIds(prev => { const s = new Set(prev); s.delete(cycleId); return s; });
      return;
    }
    if (!loadedDays.has(cycleId)) {
      setLoadingCycleId(cycleId);
      try {
        const days = await getReviewedDays(db, cycleId);
        setLoadedDays(prev => new Map(prev).set(cycleId, days));
      } catch (e) {
        console.error('[LogScreen toggleCycle]', e);
      } finally {
        setLoadingCycleId(null);
      }
    }
    setExpandedIds(prev => new Set(prev).add(cycleId));
  }

  async function openDay(day: ReviewedDay) {
    setLoadingDetail(true);
    try {
      const entries = await getDayEntries(db, day.id);
      setDetail({ day, entries });
    } catch (e) {
      console.error('[LogScreen openDay]', e);
    } finally {
      setLoadingDetail(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const navPillOffset = Math.max(insets.bottom, 16) + 76;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -0.5 }}>
          Log
        </Text>
      </View>

      {summaries.length === 0 ? (
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: navPillOffset + 24 }}
        >
          {summaries.map(summary => {
            const isExpanded = expandedIds.has(summary.cycle_id);
            const isLoadingThis = loadingCycleId === summary.cycle_id;
            const days = loadedDays.get(summary.cycle_id) ?? [];
            const net = summary.total_budget - summary.total_spent;
            const saved = net >= 0;

            return (
              <View key={summary.cycle_id} style={{ marginBottom: 16 }}>
                {/* Cycle header — always visible */}
                <Pressable
                  onPress={() => toggleCycle(summary.cycle_id)}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: isExpanded ? 20 : 16,
                    borderBottomLeftRadius: isExpanded ? 0 : 16,
                    borderBottomRightRadius: isExpanded ? 0 : 16,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                      {fmtCycleRange(summary.start_date, summary.end_date)}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 3 }}>
                      {summary.day_count} {summary.day_count === 1 ? 'day' : 'days'}
                      {'  ·  '}
                      <Text style={{ color: colors.textSecondary }}>spent ৳{Math.floor(summary.total_spent).toLocaleString()}</Text>
                      {'  ·  '}
                      <Text style={{ color: saved ? colors.primary : colors.error }}>
                        {saved ? `saved ৳${Math.floor(net).toLocaleString()}` : `over ৳${Math.floor(Math.abs(net)).toLocaleString()}`}
                      </Text>
                    </Text>
                  </View>
                  {isLoadingThis
                    ? <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
                    : <MaterialIcons
                        name={isExpanded ? 'expand-more' : 'chevron-right'}
                        size={22}
                        color={colors.textSecondary}
                        style={{ marginLeft: 4 }}
                      />
                  }
                </Pressable>

                {/* Expanded days list */}
                {isExpanded && days.length > 0 && (
                  <Animated.View
                    entering={FadeInDown.duration(220).springify()}
                    exiting={FadeOut.duration(180)}
                  >
                  <View style={{
                    backgroundColor: colors.card,
                    borderBottomLeftRadius: 20,
                    borderBottomRightRadius: 20,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                  }}>
                    <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />
                    {days.map((day, i) => {
                      const daySaved = day.daily_budget - day.total_spent;
                      const didSave = daySaved >= 0;
                      return (
                        <Pressable
                          key={day.id}
                          onPress={() => openDay(day)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            borderBottomWidth: i < days.length - 1 ? 1 : 0,
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
                              {didSave ? `+৳${Math.floor(daySaved).toLocaleString()}` : `-৳${Math.floor(Math.abs(daySaved)).toLocaleString()}`}
                            </Text>
                            <Text style={{ fontSize: 11, color: didSave ? colors.primary : colors.error, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 1 }}>
                              {didSave ? 'saved' : 'overspent'}
                            </Text>
                          </View>
                          <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />
                        </Pressable>
                      );
                    })}
                  </View>
                  </Animated.View>
                )}
              </View>
            );
          })}
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
          height: navPillOffset + 32,
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
