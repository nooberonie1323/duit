import { fromDateStr, toDateStr } from '@/lib/db';
import { DeleteConfirmModal } from '@/components/home/DeleteConfirmModal';
import { MissedReviewState } from '@/components/home/MissedReviewState';
import { NormalState } from '@/components/home/NormalState';
import { ReservationModal } from '@/components/home/ReservationModal';
import { ReviewState } from '@/components/home/ReviewState';
import { SpendModal } from '@/components/home/SpendModal';
import {
  deleteReservation,
  getActiveCycle,
  getCycleTotalSpent,
  markReservationPaid,
  markReservationUnpaid,
  updateReservation,
  type ActiveCycleData,
  type ReservationRow,
} from '@/services/cycleService';
import {
  addEntry,
  deleteEntry,
  getOrCreateTodayDay,
  getTodayEntries,
  updateEntry,
  type EntryRow,
} from '@/services/entryService';
import { scheduleReviewNotifications, scheduleSnoozeNotification } from '@/services/notificationService';
import {
  confirmCatchUpReview,
  confirmReview,
  getMissedDays,
  getMissedEntries,
  type MissedDay,
} from '@/services/reviewService';
import { getSettings } from '@/services/settingsService';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorToast } from '@/components/ui/ErrorToast';
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HomeData {
  name: string;
  reviewTime: number;
  cycleData: ActiveCycleData;
  entries: EntryRow[];
  cycleTotalSpent: number;
  todayReviewed: boolean;
  missedDays: MissedDay[];
  missedEntries: EntryRow[];
}

interface EditingEntry {
  id: number;
  note: string;
  amount: number;
}

type HomeStateType = 'normal' | 'waiting' | 'ended' | 'review' | 'post_review' | 'missed_review';

function getHomeState(
  cycleData: ActiveCycleData,
  todayReviewed: boolean,
  isReviewMode: boolean,
  hasMissedDays: boolean,
  devState?: string
): HomeStateType {
  if (devState === 'ended') return 'ended';
  if (devState === 'waiting') return 'waiting';
  if (devState === 'review') return 'review';
  if (devState === 'postReview') return 'post_review';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = fromDateStr(cycleData.cycle.start_date); start.setHours(0, 0, 0, 0);
  const end = fromDateStr(cycleData.cycle.end_date); end.setHours(0, 0, 0, 0);
  if (start > today) return 'waiting';
  if (end < today) return 'ended';
  if (hasMissedDays) return 'missed_review';
  if (todayReviewed) return 'post_review';
  if (isReviewMode) return 'review';
  return 'normal';
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { devState } = useLocalSearchParams<{ devState?: string }>();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  // Review
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [confirmingReview, setConfirmingReview] = useState(false);

  // Spend modal
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<EntryRow | null>(null);

  // Reservation modal
  const [selectedReservation, setSelectedReservation] = useState<ReservationRow | null>(null);
  const [resNote, setResNote] = useState('');
  const [markingRes, setMarkingRes] = useState(false);
  const [resEditName, setResEditName] = useState('');
  const [resEditAmount, setResEditAmount] = useState('');
  const [resEditMode, setResEditMode] = useState(false);

  // Catch-up
  const [catchUpAmount, setCatchUpAmount] = useState('');
  const [catchUpNote, setCatchUpNote] = useState('');
  const [confirmingCatchUp, setConfirmingCatchUp] = useState(false);

  // Pay delayed
  const [isPayDelayed, setIsPayDelayed] = useState(false);

  // Review snooze
  const [reviewSnoozedUntil, setReviewSnoozedUntil] = useState<Date | null>(null);
  const reviewSnoozedUntilRef = useRef<Date | null>(null);

  // Error toast
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingEntry, setDeletingEntry] = useState(false);

  const load = useCallback(async () => {
    const [settings, cycleData] = await Promise.all([getSettings(db), getActiveCycle(db)]);
    if (!settings || !cycleData) { setData(null); setLoading(false); return; }
    const [entries, cycleTotalSpent, todayDay, missedDays] = await Promise.all([
      getTodayEntries(db, cycleData.cycle.id),
      getCycleTotalSpent(db, cycleData.cycle.id),
      db.getFirstAsync<{ reviewed_at: string | null }>(
        'SELECT reviewed_at FROM days WHERE cycle_id = ? AND date = ?',
        [cycleData.cycle.id, toDateStr(new Date())]
      ),
      getMissedDays(db, cycleData.cycle.id),
    ]);
    const missedEntries = await getMissedEntries(db, missedDays.map(d => d.id));
    const todayReviewed = !!(todayDay?.reviewed_at);
    const snooze = reviewSnoozedUntilRef.current;
    if (settings.notifications_enabled === 1 && (!snooze || new Date() >= snooze)) {
      scheduleReviewNotifications(settings.review_time).catch(() => {});
    }
    setData({ name: settings.name, reviewTime: settings.review_time, cycleData, entries, cycleTotalSpent, todayReviewed, missedDays, missedEntries });
    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  // Pre-fill catch-up amount with staged entries total so user doesn't have to retype what they already logged
  useEffect(() => {
    if (!data || data.missedEntries.length === 0 || catchUpAmount !== '') return;
    const staged = Math.floor(data.missedEntries.reduce((s, e) => s + e.amount, 0));
    if (staged > 0) setCatchUpAmount(String(staged));
  }, [data]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state === 'active') load(); });
    const now = new Date();
    const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
    const timer = setTimeout(() => load(), midnight.getTime() - now.getTime() + 500);
    return () => { sub.remove(); clearTimeout(timer); };
  }, [load]);

  // ── Spend handlers ──────────────────────────────────────────────────────────
  function openAdd() {
    setEditingEntry(null); setModalNote(''); setModalAmount(''); setShowModal(true);
  }

  function openEdit(entry: EntryRow) {
    setEditingEntry({ id: entry.id, note: entry.note, amount: entry.amount });
    setModalNote(entry.note);
    setModalAmount(String(entry.amount));
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false); setEditingEntry(null); setModalNote(''); setModalAmount('');
  }

  function showError(msg: string) {
    setErrorMsg(msg);
  }

  async function handleSave() {
    if (!canSave || !data || modalSaving) return;
    setModalSaving(true);
    try {
      if (editingEntry) {
        await updateEntry(db, editingEntry.id, modalNote.trim(), parseFloat(modalAmount));
      } else {
        const dayId = await getOrCreateTodayDay(db, data.cycleData.cycle.id, data.cycleData.dailyBudget);
        await addEntry(db, dayId, modalNote.trim(), parseFloat(modalAmount));
      }
      closeModal();
      await load();
    } catch (e) {
      console.error('[spend save error]', e);
      showError('Failed to save entry. Please try again.');
    } finally {
      setModalSaving(false);
    }
  }

  async function handleDeleteEntry() {
    if (!confirmDeleteEntry || deletingEntry) return;
    setDeletingEntry(true);
    try {
      await deleteEntry(db, confirmDeleteEntry.id);
      setConfirmDeleteEntry(null);
      await load();
    } catch (e) {
      console.error('[spend delete error]', e);
      showError('Failed to delete entry. Please try again.');
    } finally {
      setDeletingEntry(false);
    }
  }

  // ── Snooze handler ──────────────────────────────────────────────────────────
  function handleSnoozeReview(minutes: number) {
    const until = new Date(Date.now() + minutes * 60 * 1000);
    reviewSnoozedUntilRef.current = until;
    setReviewSnoozedUntil(until);
    if (data) scheduleSnoozeNotification(until, data.reviewTime).catch(() => {});
  }

  // ── Review handlers ─────────────────────────────────────────────────────────
  async function handleConfirmReview() {
    if (!data || confirmingReview) return;
    setConfirmingReview(true);
    try {
      await confirmReview(db, data.cycleData.cycle.id, data.cycleData.dailyBudget, data.cycleData.leftInCycle, data.entries, reviewNote);
      setIsReviewMode(false);
      setReviewNote('');
      await load();
    } catch (e) {
      console.error('[confirm review error]', e);
      showError('Failed to confirm review. Please try again.');
    } finally {
      setConfirmingReview(false);
    }
  }

  async function handleConfirmCatchUp() {
    if (!data || confirmingCatchUp) return;
    const stagedTotal = data.missedEntries.reduce((s, e) => s + e.amount, 0);
    const total = parseFloat(catchUpAmount) || stagedTotal;
    setConfirmingCatchUp(true);
    try {
      await confirmCatchUpReview(db, data.missedDays, total, data.cycleData.leftInCycle, catchUpNote);
      setCatchUpAmount('');
      setCatchUpNote('');
      await load();
    } catch (e) {
      console.error('[catch up review error]', e);
      showError('Failed to save catch-up review. Please try again.');
    } finally {
      setConfirmingCatchUp(false);
    }
  }

  // ── Reservation handlers ────────────────────────────────────────────────────
  function openReservation(r: ReservationRow) {
    setSelectedReservation(r); setResNote(''); setResEditMode(false);
  }

  function closeReservation() {
    setSelectedReservation(null); setResEditMode(false);
  }

  async function handleResMarkUsed() {
    if (!selectedReservation || markingRes) return;
    setMarkingRes(true);
    try {
      await markReservationPaid(db, selectedReservation.id, resNote);
      await load();
      closeReservation();
    } catch (e) {
      console.error('[reservation mark used error]', e);
      showError('Failed to update reservation.');
    } finally {
      setMarkingRes(false);
    }
  }

  async function handleResMarkUnused() {
    if (!selectedReservation || markingRes) return;
    setMarkingRes(true);
    try {
      await markReservationUnpaid(db, selectedReservation.id);
      await load();
      closeReservation();
    } catch (e) {
      console.error('[reservation mark unused error]', e);
      showError('Failed to update reservation.');
    } finally {
      setMarkingRes(false);
    }
  }

  async function handleResSaveEdit() {
    if (!selectedReservation || !resEditName.trim() || !(parseFloat(resEditAmount) > 0) || markingRes) return;
    setMarkingRes(true);
    try {
      await updateReservation(db, selectedReservation.id, resEditName.trim(), parseFloat(resEditAmount));
      await load();
      setResEditMode(false);
      closeReservation();
    } catch (e) {
      console.error('[reservation edit error]', e);
      showError('Failed to save changes.');
    } finally {
      setMarkingRes(false);
    }
  }

  async function handleResDelete() {
    if (!selectedReservation || markingRes) return;
    setMarkingRes(true);
    try {
      await deleteReservation(db, selectedReservation.id);
      await load();
      closeReservation();
    } catch (e) {
      console.error('[reservation delete error]', e);
      showError('Failed to delete reservation.');
    } finally {
      setMarkingRes(false);
    }
  }

  // ── Loading / no data ───────────────────────────────────────────────────────
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

  // ── Derived values ──────────────────────────────────────────────────────────
  const { cycleData, entries, todayReviewed, missedDays, missedEntries, cycleTotalSpent } = data;
  const navPillOffset = Math.max(insets.bottom, 16) + 76;
  const homeState = getHomeState(cycleData, todayReviewed, isReviewMode, missedDays.length > 0, devState);
  const snoozed = reviewSnoozedUntil !== null && new Date() < reviewSnoozedUntil;
  const reviewAvailable = new Date().getHours() >= data.reviewTime && !todayReviewed && homeState === 'normal' && !snoozed;

  const totalSpent = entries.reduce((s, e) => s + e.amount, 0);
  const remainingPool = cycleData.leftInCycle - totalSpent;
  const effectivePool = editingEntry ? cycleData.leftInCycle - totalSpent + editingEntry.amount : remainingPool;
  const modalAmountNum = parseFloat(modalAmount) || 0;
  const amountValid = modalAmountNum > 0;
  const poolExhausted = remainingPool <= 0 && !editingEntry;
  const hardCapError = amountValid && modalAmountNum > effectivePool
    ? `Exceeds remaining pool of ৳${Math.floor(effectivePool).toLocaleString()}`
    : null;
  const projectedDaily = !hardCapError && amountValid && cycleData.daysLeft > 0
    ? (effectivePool - modalAmountNum) / cycleData.daysLeft
    : null;
  const thresholdWarning = projectedDaily !== null && cycleData.cycle.budget_alert > 0 && projectedDaily < cycleData.cycle.budget_alert
    ? `Daily budget will drop to ৳${Math.floor(projectedDaily).toLocaleString()}, below your ৳${Math.floor(cycleData.cycle.budget_alert).toLocaleString()} alert`
    : null;
  const canSave = amountValid && !hardCapError && !poolExhausted;

  // ── Inline state helpers ────────────────────────────────────────────────────
  function statRow(label: string, value: string, valueColor = '#111827') {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 }}>
        <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'PlusJakartaSans_400Regular' }}>{label}</Text>
        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: valueColor }}>{value}</Text>
      </View>
    );
  }

  const cardShadow = {
    backgroundColor: '#fff' as const,
    borderRadius: 20,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000' as const,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  };

  // ── Single return ───────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>

      {/* Pay delayed */}
      {homeState === 'ended' && isPayDelayed && (
        <View style={{ flex: 1, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>⏳</Text>
          <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 }}>
            Waiting for pay.
          </Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: 40 }}>
            Come back when your pay arrives to start a new cycle.
          </Text>
          <Pressable
            onPress={() => router.push({ pathname: '/new-cycle', params: { leftover: String(Math.floor(cycleData.leftInCycle)), prevCycleId: String(cycleData.cycle.id) } })}
            style={{ backgroundColor: '#16A34A', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' }}>Pay arrived — start new cycle</Text>
          </Pressable>
        </View>
      )}

      {/* Cycle ended */}
      {homeState === 'ended' && !isPayDelayed && (() => {
        const startFmt = fromDateStr(cycleData.cycle.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endFmt = fromDateStr(cycleData.cycle.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const spendable = cycleData.pool - cycleData.cycle.savings - cycleData.reservationsTotal;
        const avgPerDay = cycleData.totalDays > 0 ? cycleTotalSpent / cycleData.totalDays : 0;
        const netAmount = spendable - cycleTotalSpent;
        const didSave = netAmount >= 0;
        const hasProtected = cycleData.cycle.savings > 0 || cycleData.reservations.length > 0;
        return (
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
            <View style={cardShadow}>
              {statRow('Total spent', `৳${Math.floor(cycleTotalSpent).toLocaleString()}`)}
              <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
              {statRow('Daily average', `৳${Math.floor(avgPerDay).toLocaleString()}`)}
              <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
              {statRow(didSave ? 'Underspent' : 'Overspent', `৳${Math.floor(Math.abs(netAmount)).toLocaleString()}`, didSave ? '#16A34A' : '#EF4444')}
            </View>
            {hasProtected && (
              <View style={cardShadow}>
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
            {cycleData.leftInCycle > 0 && (
              <View style={cardShadow}>
                {statRow('Left in pool', `৳${Math.floor(cycleData.leftInCycle).toLocaleString()}`)}
              </View>
            )}
            <Pressable
              onPress={() => router.push({ pathname: '/new-cycle', params: { leftover: String(cycleData.leftInCycle > 0 ? Math.floor(cycleData.leftInCycle) : 0), prevCycleId: String(cycleData.cycle.id) } })}
              style={{ backgroundColor: '#16A34A', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' }}>Start new cycle</Text>
            </Pressable>
            <Pressable
              onPress={() => setIsPayDelayed(true)}
              style={{ borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB' }}
            >
              <Text style={{ color: '#6B7280', fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Wait — pay was delayed</Text>
            </Pressable>
          </ScrollView>
        );
      })()}

      {/* Waiting */}
      {homeState === 'waiting' && (() => {
        const startFmt = fromDateStr(cycleData.cycle.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const today2 = new Date(); today2.setHours(0, 0, 0, 0);
        const start2 = fromDateStr(cycleData.cycle.start_date); start2.setHours(0, 0, 0, 0);
        const daysUntil = Math.round((start2.getTime() - today2.getTime()) / 86400000);
        return (
          <View style={{ flex: 1, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
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
            <Pressable
              onPress={() => router.push({ pathname: '/new-cycle', params: { leftover: '0', prevCycleId: String(cycleData.cycle.id) } })}
              style={{ backgroundColor: '#16A34A', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' }}>Start new cycle</Text>
            </Pressable>
          </View>
        );
      })()}

      {/* Missed review */}
      {homeState === 'missed_review' && (
        <MissedReviewState
          missedDays={missedDays}
          missedEntries={missedEntries}
          navPillOffset={navPillOffset}
          insets={insets}
          catchUpAmount={catchUpAmount}
          onChangeAmount={setCatchUpAmount}
          catchUpNote={catchUpNote}
          onChangeNote={setCatchUpNote}
          confirming={confirmingCatchUp}
          onConfirm={handleConfirmCatchUp}
        />
      )}

      {/* Review */}
      {homeState === 'review' && (
        <ReviewState
          cycleData={cycleData}
          entries={entries}
          navPillOffset={navPillOffset}
          insets={insets}
          reviewNote={reviewNote}
          onChangeNote={setReviewNote}
          confirming={confirmingReview}
          onConfirm={handleConfirmReview}
          onOpenAdd={openAdd}
          onOpenEdit={openEdit}
          onDeleteEntry={setConfirmDeleteEntry}
        />
      )}

      {/* Post-review */}
      {homeState === 'post_review' && (() => {
        const todayTotalSpent = entries.reduce((s, e) => s + e.amount, 0);
        const todaySaved = Math.max(0, cycleData.dailyBudget - todayTotalSpent);
        const now = new Date();
        const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
        const msLeft = midnight.getTime() - now.getTime();
        const hoursLeft = Math.floor(msLeft / 3600000);
        const minsLeft = Math.floor((msLeft % 3600000) / 60000);
        const countdown = hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m until tomorrow` : `${minsLeft}m until tomorrow`;
        return (
          <View style={{ flex: 1, paddingTop: insets.top }}>
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
              <Text style={{ fontSize: 12, color: '#D1D5DB', fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center' }}>{countdown}</Text>
            </ScrollView>
          </View>
        );
      })()}

      {/* Normal */}
      {homeState === 'normal' && (
        <NormalState
          cycleData={cycleData}
          entries={entries}
          cycleTotalSpent={cycleTotalSpent}
          navPillOffset={navPillOffset}
          insets={insets}
          reviewAvailable={reviewAvailable}
          onStartReview={() => setIsReviewMode(true)}
          onSnoozeReview={handleSnoozeReview}
          onOpenAdd={openAdd}
          onOpenEdit={openEdit}
          onDeleteEntry={setConfirmDeleteEntry}
          onSelectReservation={openReservation}
        />
      )}

      {/* Shared modals — rendered once, used by normal + review states */}
      <SpendModal
        visible={showModal}
        onClose={closeModal}
        editingEntry={editingEntry}
        note={modalNote}
        onChangeNote={setModalNote}
        amount={modalAmount}
        onChangeAmount={v => setModalAmount(v.replace(/[^0-9.]/g, ''))}
        saving={modalSaving}
        onSave={handleSave}
        canSave={canSave}
        poolExhausted={poolExhausted}
        hardCapError={hardCapError}
        thresholdWarning={thresholdWarning}
      />

      <DeleteConfirmModal
        entry={confirmDeleteEntry}
        onConfirm={handleDeleteEntry}
        onCancel={() => setConfirmDeleteEntry(null)}
        deleting={deletingEntry}
      />

      <ReservationModal
        reservation={selectedReservation}
        onClose={closeReservation}
        note={resNote}
        onChangeNote={setResNote}
        marking={markingRes}
        editMode={resEditMode}
        onStartEdit={() => { setResEditName(selectedReservation?.name ?? ''); setResEditAmount(String(selectedReservation?.amount ?? '')); setResEditMode(true); }}
        editName={resEditName}
        onChangeEditName={setResEditName}
        editAmount={resEditAmount}
        onChangeEditAmount={setResEditAmount}
        onMarkUsed={handleResMarkUsed}
        onMarkUnused={handleResMarkUnused}
        onSaveEdit={handleResSaveEdit}
        onDelete={handleResDelete}
      />
      <ErrorToast
        message={errorMsg}
        onDismiss={() => setErrorMsg(null)}
        bottomOffset={navPillOffset + 16}
      />
    </View>
  );
}
