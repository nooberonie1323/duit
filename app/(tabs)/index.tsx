import { useThemeColors } from '@/contexts/theme';
import { fromDateStr, toDateStr } from '@/lib/db';
import { DeleteConfirmModal } from '@/components/home/DeleteConfirmModal';
import { MissedReviewState } from '@/components/home/MissedReviewState';
import { NormalState } from '@/components/home/NormalState';
import { ReservationModal } from '@/components/home/ReservationModal';
import { ReviewState } from '@/components/home/ReviewState';
import { SavingsModal } from '@/components/home/SavingsModal';
import {
  addSavingsWithdrawal,
  getSavingsWithdrawals,
  type SavingsWithdrawalRow,
} from '@/services/savingsService';
import { SpendModal } from '@/components/home/SpendModal';
import {
  deleteReservation,
  getActiveCycle,
  getCycleTotalSpent,
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
import {
  addReservationTransaction,
  deleteLastTransaction,
  getReservationTransactions,
  type ReservationTransactionRow,
} from '@/services/reservationService';
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
  savingsWithdrawals: SavingsWithdrawalRow[];
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
  const colors = useThemeColors();
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

  // Savings modal
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [savingsStep, setSavingsStep] = useState<1 | 2>(1);
  const [savingsAmount, setSavingsAmount] = useState('');
  const [savingsNote, setSavingsNote] = useState('');
  const [savingsSaving, setSavingsSaving] = useState(false);

  // Reservation modal
  const [selectedReservation, setSelectedReservation] = useState<ReservationRow | null>(null);
  const [resTransactions, setResTransactions] = useState<ReservationTransactionRow[]>([]);
  const [resAmount, setResAmount] = useState('');
  const [resNote, setResNote] = useState('');
  const [resSaving, setResSaving] = useState(false);
  const [resConfirmingRelease, setResConfirmingRelease] = useState(false);

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
    const [entries, cycleTotalSpent, todayDay, missedDays, savingsWithdrawals] = await Promise.all([
      getTodayEntries(db, cycleData.cycle.id),
      getCycleTotalSpent(db, cycleData.cycle.id),
      db.getFirstAsync<{ reviewed_at: string | null }>(
        'SELECT reviewed_at FROM days WHERE cycle_id = ? AND date = ?',
        [cycleData.cycle.id, toDateStr(new Date())]
      ),
      getMissedDays(db, cycleData.cycle.id),
      getSavingsWithdrawals(db, cycleData.cycle.id),
    ]);
    const missedEntries = await getMissedEntries(db, missedDays.map(d => d.id));
    const todayReviewed = !!(todayDay?.reviewed_at);
    const snooze = reviewSnoozedUntilRef.current;
    if (settings.notifications_enabled === 1 && (!snooze || new Date() >= snooze)) {
      scheduleReviewNotifications(settings.review_time).catch(() => {});
    }
    setData({ name: settings.name, reviewTime: settings.review_time, cycleData, entries, cycleTotalSpent, todayReviewed, missedDays, missedEntries, savingsWithdrawals });
    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  // Pre-fill catch-up amount with staged entries total so user doesn't have to retype what they already logged
  useEffect(() => {
    if (!data || data.missedEntries.length === 0 || catchUpAmount !== '') return;
    const staged = Math.floor(data.missedEntries.reduce((s, e) => s + e.amount, 0));
    if (staged > 0) setCatchUpAmount(String(staged));
  }, [data, catchUpAmount]);

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
  async function openReservation(r: ReservationRow) {
    setSelectedReservation(r);
    setResAmount(''); setResNote(''); setResConfirmingRelease(false);
    setResTransactions(await getReservationTransactions(db, r.id));
  }

  function closeReservation() {
    setSelectedReservation(null);
    setResTransactions([]);
    setResAmount(''); setResNote(''); setResConfirmingRelease(false);
  }

  async function refreshReservation(reservationId: number) {
    const [freshCycleData, transactions] = await Promise.all([
      getActiveCycle(db),
      getReservationTransactions(db, reservationId),
    ]);
    setSelectedReservation(freshCycleData?.reservations.find(r => r.id === reservationId) ?? null);
    setResTransactions(transactions);
  }

  async function handleResTransaction(type: 'spend' | 'release') {
    if (!selectedReservation || !resCanSubmit) return;
    setResSaving(true);
    try {
      await addReservationTransaction(db, selectedReservation.cycle_id, selectedReservation.id, type, resAmountNum, resNote);
      await Promise.all([load(), refreshReservation(selectedReservation.id)]);
      setResAmount(''); setResNote(''); setResConfirmingRelease(false);
    } catch (e) {
      console.error('[reservation transaction error]', e);
      showError('Failed to save. Please try again.');
    } finally {
      setResSaving(false);
    }
  }

  async function handleResUndoLast() {
    if (!selectedReservation || resTransactions.length === 0 || resSaving) return;
    setResSaving(true);
    try {
      await deleteLastTransaction(db, selectedReservation.cycle_id, selectedReservation.id);
      await Promise.all([load(), refreshReservation(selectedReservation.id)]);
    } catch (e) {
      console.error('[reservation undo error]', e);
      showError('Failed to undo. Please try again.');
    } finally {
      setResSaving(false);
    }
  }

  async function handleResDelete() {
    if (!selectedReservation || resSaving) return;
    setResSaving(true);
    try {
      await deleteReservation(db, selectedReservation.id);
      await load();
      closeReservation();
    } catch (e) {
      console.error('[reservation delete error]', e);
      showError('Failed to delete reservation.');
    } finally {
      setResSaving(false);
    }
  }

  // ── Savings handlers ────────────────────────────────────────────────────────
  function openSavings() {
    setSavingsStep(1);
    setSavingsAmount('');
    setSavingsNote('');
    setShowSavingsModal(true);
  }

  function closeSavings() {
    setShowSavingsModal(false);
    setSavingsStep(1);
    setSavingsAmount('');
    setSavingsNote('');
  }

  async function handleSavingsWithdraw() {
    if (!data || savingsSaving) return;
    const amount = parseFloat(savingsAmount);
    if (!amount || amount <= 0) return;
    setSavingsSaving(true);
    try {
      await addSavingsWithdrawal(db, data.cycleData.cycle.id, amount, savingsNote);
      await load();
      closeSavings();
    } catch (e) {
      console.error('[savings withdraw error]', e);
      showError('Failed to record savings use. Please try again.');
    } finally {
      setSavingsSaving(false);
    }
  }

  // ── Loading / no data ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14 }}>
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

  const resRemaining = selectedReservation
    ? selectedReservation.amount - selectedReservation.spent - selectedReservation.released
    : 0;
  const resAmountNum = parseFloat(resAmount) || 0;
  const resAmountValid = resAmountNum > 0;
  const resAmountError = resAmountValid && resAmountNum > resRemaining
    ? `Exceeds ৳${Math.floor(resRemaining).toLocaleString()} remaining`
    : null;
  const resCanSubmit = resAmountValid && !resAmountError && !resSaving;

  const savingsRemaining = cycleData.cycle.savings - cycleData.savingsWithdrawn;
  const savingsAmountValid = (parseFloat(savingsAmount) || 0) > 0;
  const savingsAmountError = savingsAmountValid && (parseFloat(savingsAmount) || 0) > savingsRemaining
    ? `Exceeds ৳${Math.floor(savingsRemaining).toLocaleString()} remaining`
    : null;
  const savingsCanContinue = savingsAmountValid && !savingsAmountError;

  // ── Inline state helpers ────────────────────────────────────────────────────
  function statRow(label: string, value: string, valueColor: string = colors.textPrimary) {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 }}>
        <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>{label}</Text>
        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: valueColor }}>{value}</Text>
      </View>
    );
  }

  const cardShadow = {
    backgroundColor: colors.card,
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* Pay delayed */}
      {homeState === 'ended' && isPayDelayed && (
        <View style={{ flex: 1, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>⏳</Text>
          <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 }}>
            Waiting for pay.
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: 40 }}>
            Come back when your pay arrives to start a new cycle.
          </Text>
          <Pressable
            onPress={() => router.push({ pathname: '/new-cycle', params: { leftover: String(Math.floor(cycleData.leftInCycle)), prevCycleId: String(cycleData.cycle.id) } })}
            style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center' }}
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
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginLeft: 4 }}>
              {startFmt} – {endFmt}
            </Text>
            <Text style={{ fontSize: 34, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -1, marginBottom: 4, marginLeft: 4 }}>
              That&apos;s a wrap.
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 24, marginLeft: 4 }}>
              Your cycle has ended. Start a new one to continue.
            </Text>
            <View style={cardShadow}>
              {statRow('Total spent', `৳${Math.floor(cycleTotalSpent).toLocaleString()}`)}
              <View style={{ height: 1, backgroundColor: colors.border }} />
              {statRow('Daily average', `৳${Math.floor(avgPerDay).toLocaleString()}`)}
              <View style={{ height: 1, backgroundColor: colors.border }} />
              {statRow(didSave ? 'Underspent' : 'Overspent', `৳${Math.floor(Math.abs(netAmount)).toLocaleString()}`, didSave ? colors.primary : colors.error)}
            </View>
            {hasProtected && (
              <View style={cardShadow}>
                {cycleData.cycle.savings > 0 && (
                  <>
                    {(() => {
                      const remaining = cycleData.cycle.savings - cycleData.savingsWithdrawn;
                      const label = cycleData.savingsWithdrawn > 0 ? 'Savings (partially used)' : 'Savings (untouched)';
                      return statRow(label, `৳${Math.floor(Math.max(0, remaining)).toLocaleString()}`, colors.primary);
                    })()}
                    {cycleData.reservations.length > 0 && <View style={{ height: 1, backgroundColor: colors.border }} />}
                  </>
                )}
                {cycleData.reservations.map((r, i) => (
                  <View key={r.id}>
                    {statRow(`${r.name} (reserved)`, `৳${Math.floor(r.amount - r.spent - r.released).toLocaleString()}`, colors.textSecondary)}
                    {i < cycleData.reservations.length - 1 && <View style={{ height: 1, backgroundColor: colors.border }} />}
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
              style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' }}>Start new cycle</Text>
            </Pressable>
            <Pressable
              onPress={() => setIsPayDelayed(true)}
              style={{ borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Wait — pay was delayed</Text>
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
            <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 }}>
              Waiting patiently.
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: 8 }}>
              Unlike your friends that leave when you&apos;re broke, we&apos;re still here.
            </Text>
            <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold', textAlign: 'center', marginBottom: 40 }}>
              Cycle starts {startFmt} · {daysUntil} {daysUntil === 1 ? 'day' : 'days'} away
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: '/new-cycle', params: { leftover: '0', prevCycleId: String(cycleData.cycle.id) } })}
              style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center' }}
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
              <Text style={{ fontSize: 30, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8 }}>
                You&apos;re done for today.
              </Text>
              <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 32 }}>
                See you tomorrow.
              </Text>
              <View style={{ backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>Spent today</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary }}>৳{Math.floor(todayTotalSpent).toLocaleString()}</Text>
                </View>
                {todaySaved > 0 && (
                  <>
                    <View style={{ height: 1, backgroundColor: colors.border }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13 }}>
                      <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>Saved today</Text>
                      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.primary }}>৳{Math.floor(todaySaved).toLocaleString()}</Text>
                    </View>
                  </>
                )}
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>New daily budget</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary }}>৳{Math.floor(cycleData.dailyBudget).toLocaleString()}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center' }}>{countdown}</Text>
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
          savingsWithdrawn={cycleData.savingsWithdrawn}
          onPressSavings={openSavings}
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
        transactions={resTransactions}
        onClose={closeReservation}
        amount={resAmount}
        onChangeAmount={v => setResAmount(v.replace(/[^0-9.]/g, ''))}
        note={resNote}
        onChangeNote={setResNote}
        amountError={resAmountError}
        canSubmit={resCanSubmit}
        saving={resSaving}
        confirmingRelease={resConfirmingRelease}
        onSpend={() => handleResTransaction('spend')}
        onReleasePress={() => setResConfirmingRelease(true)}
        onConfirmRelease={() => handleResTransaction('release')}
        onCancelRelease={() => setResConfirmingRelease(false)}
        onUseFullAmount={() => setResAmount(String(resRemaining))}
        onUndoLast={handleResUndoLast}
        onDeleteReservation={handleResDelete}
      />
      <SavingsModal
        visible={showSavingsModal}
        onClose={closeSavings}
        originalSavings={cycleData.cycle.savings}
        savingsRemaining={savingsRemaining}
        withdrawals={data.savingsWithdrawals}
        step={savingsStep}
        amount={savingsAmount}
        note={savingsNote}
        onChangeAmount={setSavingsAmount}
        onChangeNote={setSavingsNote}
        amountError={savingsAmountError}
        canContinue={savingsCanContinue}
        saving={savingsSaving}
        onContinue={() => setSavingsStep(2)}
        onBack={() => setSavingsStep(1)}
        onConfirm={handleSavingsWithdraw}
      />
      <ErrorToast
        message={errorMsg}
        onDismiss={() => setErrorMsg(null)}
        bottomOffset={navPillOffset + 16}
      />
    </View>
  );
}
