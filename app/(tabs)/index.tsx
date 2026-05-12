import { fromDateStr, toDateStr } from '@/lib/db';
import { getActiveCycle, getCycleTotalSpent, type ActiveCycleData } from '@/services/cycleService';
import {
  addEntry,
  deleteEntry,
  getOrCreateTodayDay,
  getTodayEntries,
  updateEntry,
  type EntryRow,
} from '@/services/entryService';
import { getSettings } from '@/services/settingsService';
import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HomeData {
  name: string;
  cycleData: ActiveCycleData;
  entries: EntryRow[];
  cycleTotalSpent: number;
  todayReviewed: boolean;
}

interface EditingEntry {
  id: number;
  note: string;
  amount: number;
}

type HomeStateType = 'normal' | 'waiting' | 'ended' | 'review' | 'post_review';

function getHomeState(cycleData: ActiveCycleData, todayReviewed: boolean, devState?: string): HomeStateType {
  if (devState === 'ended') return 'ended';
  if (devState === 'waiting') return 'waiting';
  if (devState === 'review') return 'review';
  if (devState === 'postReview') return 'post_review';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = fromDateStr(cycleData.cycle.start_date); start.setHours(0, 0, 0, 0);
  const end = fromDateStr(cycleData.cycle.end_date); end.setHours(0, 0, 0, 0);
  if (start > today) return 'waiting';
  if (end < today) return 'ended';
  if (todayReviewed) return 'post_review';
  // 'review' state set by Log tab when review is started — detected via DB flag added in that feature
  return 'normal';
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { devState } = useLocalSearchParams<{ devState?: string }>();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<EntryRow | null>(null);

  const load = useCallback(async () => {
    const [settings, cycleData] = await Promise.all([
      getSettings(db),
      getActiveCycle(db),
    ]);
    if (!settings || !cycleData) { setData(null); setLoading(false); return; }
    const [entries, cycleTotalSpent, todayDay] = await Promise.all([
      getTodayEntries(db, cycleData.cycle.id),
      getCycleTotalSpent(db, cycleData.cycle.id),
      db.getFirstAsync<{ reviewed_at: string | null }>(
        'SELECT reviewed_at FROM days WHERE cycle_id = ? AND date = ?',
        [cycleData.cycle.id, toDateStr(new Date())]
      ),
    ]);
    const todayReviewed = !!(todayDay?.reviewed_at);
    setData({ name: settings.name, cycleData, entries, cycleTotalSpent, todayReviewed });
    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingEntry(null);
    setModalNote('');
    setModalAmount('');
    setShowModal(true);
  }

  function openEdit(entry: EntryRow) {
    setEditingEntry({ id: entry.id, note: entry.note, amount: entry.amount });
    setModalNote(entry.note);
    setModalAmount(String(entry.amount));
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingEntry(null);
    setModalNote('');
    setModalAmount('');
  }

  async function handleSave() {
    if (!canSave || !data) return;
    const amount = parseFloat(modalAmount);
    setModalSaving(true);
    try {
      if (editingEntry) {
        await updateEntry(db, editingEntry.id, modalNote.trim(), amount);
      } else {
        const dayId = await getOrCreateTodayDay(db, data.cycleData.cycle.id, data.cycleData.dailyBudget);
        await addEntry(db, dayId, modalNote.trim(), amount);
      }
      closeModal();
      await load();
    } catch (e) {
      console.error('[spend save error]', e);
    } finally {
      setModalSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDeleteEntry) return;
    try {
      await deleteEntry(db, confirmDeleteEntry.id);
      setConfirmDeleteEntry(null);
      await load();
    } catch (e) {
      console.error('[spend delete error]', e);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#16A34A" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14 }}>
          No active cycle found.
        </Text>
      </View>
    );
  }

  const { cycleData, entries, todayReviewed } = data;
  const homeState = getHomeState(cycleData, todayReviewed, devState);

  // ── Cycle ended ──────────────────────────────────────────────────────────
  if (homeState === 'ended') {
    const { cycleTotalSpent } = data;
    const startFmt = fromDateStr(cycleData.cycle.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endFmt = fromDateStr(cycleData.cycle.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const spendable = cycleData.pool - cycleData.cycle.savings - cycleData.reservationsTotal;
    const avgPerDay = cycleData.totalDays > 0 ? cycleTotalSpent / cycleData.totalDays : 0;
    const netAmount = spendable - cycleTotalSpent;
    const didSave = netAmount >= 0;
    const hasProtected = cycleData.cycle.savings > 0 || cycleData.reservations.length > 0;

    const statRow = (label: string, value: string, valueColor = '#111827') => (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 }}>
        <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'PlusJakartaSans_400Regular' }}>{label}</Text>
        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: valueColor }}>{value}</Text>
      </View>
    );

    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 32), paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginLeft: 4 }}>
            {startFmt} – {endFmt}
          </Text>
          <Text style={{ fontSize: 34, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -1, marginBottom: 4, marginLeft: 4 }}>
            That's a wrap.
          </Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 24, marginLeft: 4 }}>
            Your cycle has ended. Start a new one to continue.
          </Text>

          {/* Spending summary */}
          <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
            {statRow('Total spent', `৳${Math.floor(cycleTotalSpent).toLocaleString()}`)}
            <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
            {statRow('Daily average', `৳${Math.floor(avgPerDay).toLocaleString()}`)}
            <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
            {statRow(
              didSave ? 'Underspent' : 'Overspent',
              `৳${Math.floor(Math.abs(netAmount)).toLocaleString()}`,
              didSave ? '#16A34A' : '#EF4444'
            )}
          </View>

          {/* Protected money */}
          {hasProtected && (
            <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
              {cycleData.cycle.savings > 0 && (
                <>
                  {statRow('Savings (untouched)', `৳${Math.floor(cycleData.cycle.savings).toLocaleString()}`, '#16A34A')}
                  {cycleData.reservations.length > 0 && <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />}
                </>
              )}
              {cycleData.reservations.map((r, i) => (
                <View key={r.id}>
                  {statRow(`${r.name} (reserved)`, `৳${Math.floor(r.amount).toLocaleString()}`, '#6B7280')}
                  {i < cycleData.reservations.length - 1 && <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />}
                </View>
              ))}
            </View>
          )}

          {/* Remaining pool */}
          {cycleData.leftInCycle > 0 && (
            <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
              {statRow('Left in pool', `৳${Math.floor(cycleData.leftInCycle).toLocaleString()}`)}
            </View>
          )}

          <Pressable style={{ backgroundColor: '#16A34A', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' }}>Start new cycle</Text>
          </Pressable>
          <Pressable style={{ borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB' }}>
            <Text style={{ color: '#6B7280', fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Wait — pay was delayed</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Waiting ───────────────────────────────────────────────────────────────
  if (homeState === 'waiting') {
    const startFmt = fromDateStr(cycleData.cycle.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const today2 = new Date(); today2.setHours(0, 0, 0, 0);
    const start2 = fromDateStr(cycleData.cycle.start_date); start2.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((start2.getTime() - today2.getTime()) / 86400000);
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>⏳</Text>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 }}>
          Waiting patiently.
        </Text>
        <Text style={{ fontSize: 14, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: 8 }}>
          Unlike your friends that leave when you're broke, we're still here.
        </Text>
        <Text style={{ fontSize: 13, color: '#16A34A', fontFamily: 'PlusJakartaSans_600SemiBold', textAlign: 'center', marginBottom: 40 }}>
          Cycle starts {startFmt} · {daysUntil} {daysUntil === 1 ? 'day' : 'days'} away
        </Text>
        <Pressable style={{ backgroundColor: '#16A34A', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' }}>Start new cycle</Text>
        </Pressable>
      </View>
    );
  }

  // ── Review in progress ───────────────────────────────────────────────────
  if (homeState === 'review') {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFBEB', paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 36, marginBottom: 20 }}>📋</Text>
        <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#92400E', textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 }}>
          Finish your review to continue.
        </Text>
        <Text style={{ fontSize: 14, color: '#B45309', fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', lineHeight: 22 }}>
          Head to the Log tab to complete today's review.
        </Text>
      </View>
    );
  }

  // ── Post-review, pre-midnight ─────────────────────────────────────────────
  if (homeState === 'post_review') {
    const todayTotalSpent = entries.reduce((s, e) => s + e.amount, 0);
    const todaySaved = Math.max(0, cycleData.dailyBudget - todayTotalSpent);

    const now = new Date();
    const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
    const msLeft = midnight.getTime() - now.getTime();
    const hoursLeft = Math.floor(msLeft / 3600000);
    const minsLeft = Math.floor((msLeft % 3600000) / 60000);
    const countdown = hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m until tomorrow` : `${minsLeft}m until tomorrow`;

    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 40, paddingBottom: Math.max(insets.bottom, 32) }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 36, marginBottom: 16 }}>✅</Text>
          <Text style={{ fontSize: 30, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.5, marginBottom: 8 }}>
            You're done for today.
          </Text>
          <Text style={{ fontSize: 15, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 32 }}>
            See you tomorrow.
          </Text>

          <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13 }}>
              <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'PlusJakartaSans_400Regular' }}>Spent today</Text>
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#111827' }}>৳{Math.floor(todayTotalSpent).toLocaleString()}</Text>
            </View>
            {todaySaved > 0 && (
              <>
                <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13 }}>
                  <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'PlusJakartaSans_400Regular' }}>Saved today</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#16A34A' }}>৳{Math.floor(todaySaved).toLocaleString()}</Text>
                </View>
              </>
            )}
            <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13 }}>
              <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'PlusJakartaSans_400Regular' }}>New daily budget</Text>
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#111827' }}>৳{Math.floor(cycleData.dailyBudget).toLocaleString()}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 12, color: '#D1D5DB', fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center' }}>
            {countdown}
          </Text>
        </ScrollView>
      </View>
    );
  }

  // ── Normal ────────────────────────────────────────────────────────────────
  const totalSpent = entries.reduce((s, e) => s + e.amount, 0);
  const leftToday = cycleData.dailyBudget - totalSpent;
  const overspentBy = totalSpent > cycleData.dailyBudget ? totalSpent - cycleData.dailyBudget : 0;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Remaining pool = total cycle pool minus what's already been staged today
  const remainingPool = cycleData.leftInCycle - totalSpent;
  // For edits, add back the old amount since it's being replaced
  const effectivePool = editingEntry
    ? cycleData.leftInCycle - totalSpent + editingEntry.amount
    : remainingPool;

  const modalAmountNum = parseFloat(modalAmount) || 0;
  const amountValid = modalAmountNum > 0;
  const poolExhausted = remainingPool <= 0 && !editingEntry;

  const hardCapError = amountValid && modalAmountNum > effectivePool
    ? `Exceeds remaining pool of ৳${Math.floor(effectivePool).toLocaleString()}`
    : null;

  const projectedDaily = !hardCapError && amountValid && cycleData.daysLeft > 0
    ? (effectivePool - modalAmountNum) / cycleData.daysLeft
    : null;

  const thresholdWarning = projectedDaily !== null
    && cycleData.cycle.budget_alert > 0
    && projectedDaily < cycleData.cycle.budget_alert
    ? `Daily budget will drop to ৳${Math.floor(projectedDaily).toLocaleString()}, below your ৳${Math.floor(cycleData.cycle.budget_alert).toLocaleString()} alert`
    : null;

  const canSave = amountValid && !hardCapError && !poolExhausted;

  const card = {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 16,
    shadowColor: '#000' as const,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  };

  const navPillOffset = Math.max(insets.bottom, 16) + 76;

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* ── Fixed top section ── */}
      <View style={{ paddingTop: insets.top + 16 }}>
        {/* ── Hero card ── */}
        <View style={{
          marginHorizontal: 16, borderRadius: 20,
          shadowColor: '#16A34A', shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
        }}>
          <View style={{ backgroundColor: '#16A34A', borderRadius: 20, padding: 22, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', top: -35, right: -35, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.07)' }} />
            <View style={{ position: 'absolute', bottom: -55, left: -25, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' }}>{dateStr}</Text>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                  Day {cycleData.dayOfCycle} of {cycleData.totalDays}
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
          </View>
        </View>

        <View style={{ height: 12 }} />

        {/* ── Cycle Overview ── */}
        <View style={card}>
          <View style={{ flexDirection: 'row', paddingVertical: 18 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827', marginBottom: 4 }}>
                ৳{Math.floor(Math.max(0, cycleData.leftInCycle - totalSpent)).toLocaleString()}
              </Text>
              <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' }}>Left in cycle</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#F3F4F6', marginVertical: 4 }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827', marginBottom: 4 }}>
                {cycleData.daysLeft}
              </Text>
              <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' }}>Days left</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#F3F4F6', marginVertical: 4 }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: '#9CA3AF', marginBottom: 4 }}>—</Text>
              <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' }}>Daily avg</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 12 }} />

        {/* ── Spending card ── */}
        <View style={card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827' }}>Spending</Text>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: totalSpent > 0 ? '#111827' : '#D1D5DB' }}>
              ৳{totalSpent.toLocaleString()}
            </Text>
          </View>
          <Pressable onPress={openAdd} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 }}>
            <Text style={{ fontSize: 20, color: '#16A34A', lineHeight: 22, includeFontPadding: false }}>+</Text>
            <Text style={{ fontSize: 14, color: '#16A34A', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Add spend</Text>
          </Pressable>
        </View>

      </View>

      {/* ── Log card — fills remaining space above NavPill ── */}
      {entries.length > 0 ? (
        <View style={{ flex: 1, marginTop: 12, marginHorizontal: 16, paddingBottom: navPillOffset }}>
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#6B7280' }}>Today's log</Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' }}>{entries.length} {entries.length === 1 ? 'item' : 'items'}</Text>
            </View>
            <FlatList
              data={entries}
              keyExtractor={item => String(item.id)}
              showsVerticalScrollIndicator={true}
              renderItem={({ item: entry, index: i }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: i < entries.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}>
                  <Pressable
                    onPress={() => openEdit(entry)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingLeft: 16, paddingRight: 8 }}
                  >
                    <Text style={{ flex: 1, fontSize: 14, color: '#374151', fontFamily: 'PlusJakartaSans_400Regular' }} numberOfLines={1}>
                      {entry.note || 'general spending'}
                    </Text>
                    <Text style={{ fontSize: 14, color: '#111827', fontFamily: 'PlusJakartaSans_600SemiBold', marginRight: 4 }}>
                      ৳{entry.amount.toLocaleString()}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setConfirmDeleteEntry(entry)} hitSlop={8} style={{ paddingVertical: 13, paddingRight: 16, paddingLeft: 8 }}>
                    <Text style={{ fontSize: 18, color: '#EF4444', lineHeight: 20, includeFontPadding: false }}>×</Text>
                  </Pressable>
                </View>
              )}
              ListFooterComponent={entries.length > 4 ? (
                <View style={{ paddingVertical: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                  <Text style={{ fontSize: 11, color: '#D1D5DB', fontFamily: 'PlusJakartaSans_400Regular', letterSpacing: 0.5 }}>scroll for more  ↕</Text>
                </View>
              ) : null}
            />
          </View>
        </View>
      ) : null}

      {/* ── Add / Edit modal ── */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={closeModal}
        >
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827' }}>
                    {editingEntry ? 'Edit spend' : 'Add spend'}
                  </Text>
                  <Pressable onPress={closeModal} hitSlop={8}>
                    <Text style={{ fontSize: 22, color: '#9CA3AF', lineHeight: 24, includeFontPadding: false }}>×</Text>
                  </Pressable>
                </View>

                {/* Note field */}
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
                  Note (optional)
                </Text>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 }}>
                  <TextInput
                    value={modalNote}
                    onChangeText={setModalNote}
                    placeholder="What did you spend on?"
                    placeholderTextColor="#D1D5DB"
                    style={{ fontSize: 15, color: '#111827', fontFamily: 'PlusJakartaSans_400Regular' }}
                    maxLength={60}
                    returnKeyType="next"
                  />
                </View>

                {/* Pool exhausted */}
                {poolExhausted && (
                  <View style={{ backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, color: '#EF4444', fontFamily: 'PlusJakartaSans_500Medium' }}>
                      Your pool is empty — no budget remaining this cycle.
                    </Text>
                  </View>
                )}

                {/* Amount field */}
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
                  Amount
                </Text>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1.5, borderColor: hardCapError ? '#EF4444' : amountValid ? '#16A34A' : '#E5E7EB', paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', marginBottom: hardCapError || thresholdWarning ? 8 : 20 }}>
                  <Text style={{ fontSize: 18, color: modalAmount ? '#111827' : '#D1D5DB', fontFamily: 'PlusJakartaSans_700Bold', marginRight: 4 }}>৳</Text>
                  <TextInput
                    value={modalAmount}
                    onChangeText={v => setModalAmount(v.replace(/[^0-9.]/g, ''))}
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                    keyboardType="decimal-pad"
                    editable={!poolExhausted}
                    style={{ flex: 1, fontSize: 22, color: '#111827', fontFamily: 'PlusJakartaSans_700Bold' }}
                  />
                </View>

                {/* Hard cap error */}
                {hardCapError && (
                  <View style={{ backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, color: '#EF4444', fontFamily: 'PlusJakartaSans_500Medium' }}>
                      {hardCapError}
                    </Text>
                  </View>
                )}

                {/* Threshold warning */}
                {thresholdWarning && (
                  <View style={{ backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, color: '#92400E', fontFamily: 'PlusJakartaSans_400Regular' }}>
                      ⚡ {thresholdWarning}
                    </Text>
                  </View>
                )}

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: hardCapError || thresholdWarning ? 8 : 0 }}>
                  <Pressable
                    onPress={closeModal}
                    style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB' }}
                  >
                    <Text style={{ fontSize: 15, color: '#6B7280', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    disabled={!canSave || modalSaving}
                    style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: canSave ? '#16A34A' : '#E5E7EB' }}
                  >
                    {modalSaving
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={{ fontSize: 15, color: canSave ? '#fff' : '#9CA3AF', fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                          {editingEntry ? 'Save' : 'Add'}
                        </Text>
                    }
                  </Pressable>
                </View>

            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {/* ── Confirm delete modal ── */}
      <Modal visible={!!confirmDeleteEntry} transparent animationType="fade" onRequestClose={() => setConfirmDeleteEntry(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={() => setConfirmDeleteEntry(null)}
        >
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
              <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827', marginBottom: 8 }}>
                Delete entry?
              </Text>
              <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 24 }}>
                "{confirmDeleteEntry?.note || 'general spending'}" — ৳{confirmDeleteEntry?.amount.toLocaleString()} will be removed.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setConfirmDeleteEntry(null)}
                  style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB' }}
                >
                  <Text style={{ fontSize: 15, color: '#6B7280', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleDelete}
                  style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: '#EF4444' }}
                >
                  <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
