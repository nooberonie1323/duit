import { CalendarModal } from '@/components/ui/CalendarModal';
import { useThemeColors } from '@/contexts/theme';
import { fromDateStr, toDateStr } from '@/lib/db';
import {
  addLoanReceipt,
  getActiveBorrowedLoansForCycle,
  getLoans,
  recordRepaymentReservation,
  type ActiveBorrowedLoan,
  type LoanWithComputed,
  type ReceiptAction,
} from '@/services/loanService';
import {
  applyPlan,
  getEditablePlan,
  savePendingPlan,
  type EditableCyclePlan,
  type NewCycleFormInput,
  type PlanReservation,
} from '@/services/newCycleService';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type StepType = 'loans' | 'form';

interface FormReservation {
  id: string;
  name: string;
  amount: string;
  isCarried: boolean;
}

const MONEY_EPSILON = 0.005;
const DEFAULT_CYCLE_LENGTH_DAYS = 29;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function parseDate(value: string): Date {
  const parsed = fromDateStr(value);
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function inclusiveDays(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export default function NewCycleScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ planId?: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [plan, setPlan] = useState<EditableCyclePlan | null>(null);

  const [loans, setLoans] = useState<LoanWithComputed[]>([]);
  const [activeBorrowedLoans, setActiveBorrowedLoans] = useState<ActiveBorrowedLoan[]>([]);
  const [loanActions, setLoanActions] = useState<Record<number, { action: ReceiptAction; reservationName: string; returnAmount: string }>>({});
  const [step, setStep] = useState<StepType>('form');

  const [startDate, setStartDate] = useState<Date>(startOfToday);
  const [endDate, setEndDate] = useState<Date>(() => addDays(startOfToday(), DEFAULT_CYCLE_LENGTH_DAYS));
  const [income, setIncome] = useState('');
  const [alreadySpent, setAlreadySpent] = useState('');
  const [savings, setSavings] = useState('');
  const [budgetAlert, setBudgetAlert] = useState('');
  const [reservations, setReservations] = useState<FormReservation[]>([]);
  const [showStartCal, setShowStartCal] = useState(false);
  const [showEndCal, setShowEndCal] = useState(false);

  const [conflicts, setConflicts] = useState<string[]>([]);
  const [mergeApproved, setMergeApproved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const requestedPlanId = params.planId ? parseInt(params.planId) : undefined;
    const editable = await getEditablePlan(
      db,
      requestedPlanId !== undefined && Number.isFinite(requestedPlanId) ? requestedPlanId : undefined
    );
    if (!editable) {
      setLoadError('This cycle plan no longer exists. Go back and close the cycle again.');
      setLoading(false);
      return;
    }

    setPlan(editable);

    const today = startOfToday();
    const plannedStart = parseDate(editable.startDate);
    const start = plannedStart < today ? today : plannedStart;
    const plannedEnd = parseDate(editable.endDate);
    const end = plannedEnd <= start ? addDays(start, DEFAULT_CYCLE_LENGTH_DAYS) : plannedEnd;

    setStartDate(start);
    setEndDate(end);
    setIncome(editable.income > 0 ? String(editable.income) : '');
    setAlreadySpent(editable.alreadySpent > 0 ? String(editable.alreadySpent) : '');
    setSavings(editable.savingsContribution > 0 ? String(editable.savingsContribution) : '');
    setBudgetAlert(editable.budgetAlert > 0 ? String(editable.budgetAlert) : '');
    setReservations(
      editable.reservations.map((reservation, index) => ({
        id: `reservation-${index}`,
        name: reservation.name,
        amount: String(reservation.amount),
        isCarried: reservation.isCarried,
      }))
    );

    try {
      const [all, borrowed] = await Promise.all([
        getLoans(db),
        getActiveBorrowedLoansForCycle(db),
      ]);
      setLoans(all);
      setActiveBorrowedLoans(borrowed);
      const hasActive = all.some(loan => loan.status === 'active') || borrowed.length > 0;
      setStep(hasActive ? 'loans' : 'form');
    } catch (loanError) {
      console.error('[NewCycle loadLoans]', loanError);
    }

    setLoading(false);
  }, [db, params.planId]);

  useEffect(() => { load(); }, [load]);

  const today = startOfToday();
  const incomeNum = parseFloat(income) || 0;
  const alreadySpentNum = parseFloat(alreadySpent) || 0;
  const contributionNum = parseFloat(savings) || 0;
  const budgetAlertNum = parseFloat(budgetAlert) || 0;

  const carryPool = plan?.carryPool ?? 0;
  const carrySavings = plan?.carrySavings ?? 0;
  const carryReservations = plan?.carryReservations ?? 0;

  const reservationsTotal = reservations.reduce(
    (sum, reservation) => sum + (parseFloat(reservation.amount) || 0),
    0
  );
  const savingsTotal = carrySavings + contributionNum;
  const availableCash = incomeNum + carryPool + carrySavings + carryReservations;
  const pool = availableCash - savingsTotal - reservationsTotal - alreadySpentNum;
  const days = inclusiveDays(startDate, endDate);
  const dailyBudget = pool / days;
  const isFutureStart = startDate > today;

  const alreadySpentTooHigh = alreadySpentNum > incomeNum && alreadySpentNum > 0;
  const endDateInvalid = endDate <= startDate;
  const poolInvalid = pool < -MONEY_EPSILON;
  const incomeInvalid = incomeNum <= 0;
  const warning = budgetAlertNum > 0 && pool > 0 && dailyBudget < budgetAlertNum
    ? `Daily budget will be ৳${Math.floor(dailyBudget).toLocaleString()}, below your ৳${Math.floor(budgetAlertNum).toLocaleString()} alert`
    : null;
  const canSubmit =
    !saving && !incomeInvalid && !alreadySpentTooHigh && !endDateInvalid && !poolInvalid;

  function reservationRows(): FormReservation[] {
    return reservations.filter(
      reservation => reservation.name.trim().length > 0 || (parseFloat(reservation.amount) || 0) > 0
    );
  }

  function buildFinalReservations(approved: string[]): PlanReservation[] | null {
    const rows = reservationRows();
    for (const row of rows) {
      if (!row.name.trim()) {
        setError('Give every reservation a name.');
        return null;
      }
      if ((parseFloat(row.amount) || 0) <= 0) {
        setError(`Enter an amount for "${row.name.trim()}".`);
        return null;
      }
    }

    const groups = new Map<string, FormReservation[]>();
    for (const row of rows) {
      const key = normalizeName(row.name);
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }

    const unapproved = Array.from(groups.entries()).filter(
      ([key, group]) => group.length > 1 && !approved.includes(key)
    );
    if (unapproved.length > 0) {
      setConflicts(unapproved.map(([, group]) => group[0].name.trim()));
      return null;
    }

    return Array.from(groups.values()).map(group => ({
      name: group[0].name.trim(),
      amount: group.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0),
      isCarried: group.some(row => row.isCarried),
    }));
  }

  async function handleSubmit(approved: string[] = mergeApproved) {
    if (!plan || saving || !canSubmit) return;
    setError('');
    const finalReservations = buildFinalReservations(approved);
    if (!finalReservations) return;

    const input: NewCycleFormInput = {
      startDate: toDateStr(startDate),
      endDate: toDateStr(endDate),
      income: incomeNum,
      alreadySpent: alreadySpentNum,
      savingsContribution: contributionNum,
      budgetAlert: budgetAlertNum,
      reservations: finalReservations,
    };

    setSaving(true);
    try {
      if (isFutureStart) {
        await savePendingPlan(db, plan.id, input);
      } else {
        const cycleId = await applyPlan(db, plan.id, input);
        // Loans are out of scope for this flow; never let them block a started cycle.
        try {
          await runLoanActions(cycleId);
        } catch (loanError) {
          console.error('[NewCycle loan actions]', loanError);
        }
      }
      router.replace('/(tabs)');
    } catch (submitError) {
      console.error('[NewCycle error]', submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Something went wrong. Try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function runLoanActions(cycleId: number) {
    for (const borrowed of activeBorrowedLoans) {
      const result = await db.runAsync(
        'INSERT INTO reservations (cycle_id, name, amount) VALUES (?, ?, ?)',
        [
          cycleId,
          `৳${Math.floor(borrowed.amount_per_month).toLocaleString()} for ${borrowed.person_name} (loan repayment)`,
          borrowed.amount_per_month,
        ]
      );
      await recordRepaymentReservation(db, borrowed.loan_id, cycleId, result.lastInsertRowId);
    }

    for (const [loanIdStr, actionState] of Object.entries(loanActions)) {
      const loanId = parseInt(loanIdStr);
      const loan = loans.find(item => item.id === loanId);
      if (!loan || !actionState.action || actionState.action === 'pending') continue;
      const returnNum = parseFloat(actionState.returnAmount) || 0;
      if (returnNum <= 0) continue;
      await addLoanReceipt(db, {
        loanId,
        originalAmount: loan.original_amount,
        amount: returnNum,
        action: actionState.action,
        cycleId,
        reservationName:
          actionState.action === 'reservation' ? actionState.reservationName : undefined,
      });
    }
  }

  function addReservation() {
    setReservations(previous => [
      ...previous,
      { id: `new-${Date.now()}`, name: '', amount: '', isCarried: false },
    ]);
  }

  function updateReservation(id: string, patch: Partial<FormReservation>) {
    setReservations(previous =>
      previous.map(reservation =>
        reservation.id === id ? { ...reservation, ...patch } : reservation
      )
    );
  }

  function removeReservation(id: string) {
    setReservations(previous => previous.filter(reservation => reservation.id !== id));
  }

  const fmtDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', marginBottom: 20 }}>
          {loadError}
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 15, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Loans step ──────────────────────────────────────────────────────────────
  if (step === 'loans') {
    const activeLentLoans = loans.filter(loan => loan.type === 'lent' && loan.status === 'active');

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 16 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 15, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>← Back</Text>
          </Pressable>
          <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 4 }}>
            Your loans
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
            Handle any loan activity before starting your new cycle.
          </Text>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 24) + 40 }}
        >
          {activeLentLoans.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Money owed to you</Text>
              {activeLentLoans.map(loan => {
                const remaining = loan.original_amount - loan.amount_returned;
                const state = loanActions[loan.id];
                const gotItBack = !!state?.action;

                return (
                  <View
                    key={loan.id}
                    style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 10, ...shadowStyle }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: gotItBack ? 12 : 0 }}>
                      <View>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary }}>{loan.person_name}</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
                          ৳{Math.floor(remaining).toLocaleString()} remaining
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          if (gotItBack) {
                            setLoanActions(previous => {
                              const next = { ...previous };
                              delete next[loan.id];
                              return next;
                            });
                          } else {
                            setLoanActions(previous => ({
                              ...previous,
                              [loan.id]: { action: 'pending', reservationName: '', returnAmount: String(Math.floor(remaining)) },
                            }));
                          }
                        }}
                        style={{
                          borderRadius: 20,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          backgroundColor: gotItBack ? colors.primary : colors.background,
                          borderWidth: 1.5,
                          borderColor: gotItBack ? colors.primary : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: gotItBack ? '#fff' : colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                          {gotItBack ? '✓ Got it back' : 'Got it back?'}
                        </Text>
                      </Pressable>
                    </View>

                    {gotItBack && state && (
                      <View>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                          What to do with it?
                        </Text>
                        {(['savings', 'reservation', 'used', 'pending'] as ReceiptAction[]).map(action => (
                          <Pressable
                            key={action}
                            onPress={() => setLoanActions(previous => ({ ...previous, [loan.id]: { ...previous[loan.id], action } }))}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                          >
                            <View style={{
                              width: 18, height: 18, borderRadius: 9, borderWidth: 2,
                              borderColor: state.action === action ? colors.primary : colors.border,
                              backgroundColor: state.action === action ? colors.primary : 'transparent',
                              marginRight: 10, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
                            }}>
                              {state.action === action && <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' }} />}
                            </View>
                            <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_500Medium' }}>
                              {receiptActionLabel(action)}
                            </Text>
                          </Pressable>
                        ))}
                        {state.action === 'reservation' && (
                          <View style={{ marginTop: 8, backgroundColor: colors.background, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10 }}>
                            <TextInput
                              value={state.reservationName}
                              onChangeText={value => setLoanActions(previous => ({ ...previous, [loan.id]: { ...previous[loan.id], reservationName: value } }))}
                              placeholder="Reservation name"
                              placeholderTextColor={colors.textSecondary}
                              style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }}
                              maxLength={60}
                            />
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {activeBorrowedLoans.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Auto-reservations this cycle</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 10, marginLeft: 4 }}>
                These will be added as reservations automatically.
              </Text>
              {activeBorrowedLoans.map(borrowed => (
                <View
                  key={borrowed.loan_id}
                  style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', ...shadowStyle }}
                >
                  <Text style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_500Medium' }}>
                    For {borrowed.person_name}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }}>
                    ৳{Math.floor(borrowed.amount_per_month).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => setStep('form')}
            style={{ marginTop: 16, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' }}>Continue</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Form step ──────────────────────────────────────────────────────────────
  const carriedReservationsTotal = reservations
    .filter(reservation => reservation.isCarried)
    .reduce((sum, reservation) => sum + (parseFloat(reservation.amount) || 0), 0);
  const hasCarried =
    carryPool > 0 || carrySavings > 0 || carriedReservationsTotal > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 16 }}>
        <Pressable
          onPress={() => {
            const hasActiveLoans = loans.some(loan => loan.status === 'active') || activeBorrowedLoans.length > 0;
            if (hasActiveLoans) setStep('loans');
            else router.back();
          }}
          hitSlop={12}
          style={{ marginBottom: 20 }}
        >
          <Text style={{ fontSize: 15, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>← Back</Text>
        </Pressable>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -0.5 }}>
          {plan?.status === 'pending_confirmation' ? 'Confirm your cycle' : 'Plan your cycle'}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 24) + 40 }}
      >
        {hasCarried && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Carried over</Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              {carryPool > 0 && (
                <>
                  {summaryRow('Pocket pool', carryPool, colors.textPrimary, colors.textSecondary)}
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                </>
              )}
              {carrySavings > 0 && (
                <>
                  {summaryRow('Savings kept', carrySavings, colors.primary, colors.textSecondary)}
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                </>
              )}
              {carriedReservationsTotal > 0 && summaryRow('Reservations kept', carriedReservationsTotal, colors.textSecondary, colors.textSecondary)}
            </View>
          </>
        )}

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Pay period</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Pressable onPress={() => setShowStartCal(true)} style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Start date</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{fmtDate(startDate)}</Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable onPress={() => setShowEndCal(true)} style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>End date</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{fmtDate(endDate)}</Text>
          </Pressable>
        </View>
        {isFutureStart && (
          <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 8, marginLeft: 4, lineHeight: 18 }}>
            This cycle is saved now and waits until {fmtDate(startDate)}. Open the app on that day to confirm it.
          </Text>
        )}

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Income</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Paycheck</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.currency, { color: colors.textSecondary }]}>৳</Text>
              <TextInput
                value={income}
                onChangeText={setIncome}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.textPrimary }]}
              />
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Already spent</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>Optional — if payday was a few days ago</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.currency, { color: colors.textSecondary }]}>৳</Text>
              <TextInput
                value={alreadySpent}
                onChangeText={setAlreadySpent}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.textPrimary }]}
              />
            </View>
          </View>
        </View>
        {alreadySpentTooHigh && (
          <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 8, marginLeft: 4 }}>
            Already spent cannot be more than your income.
          </Text>
        )}

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Goals</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Add to savings</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {carrySavings > 0
                  ? `৳${Math.floor(carrySavings).toLocaleString()} carried + this amount`
                  : 'Set aside from this income, not spendable'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.currency, { color: colors.textSecondary }]}>৳</Text>
              <TextInput
                value={savings}
                onChangeText={setSavings}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.textPrimary }]}
              />
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Budget alert</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>Warn when daily budget drops below this</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.currency, { color: colors.textSecondary }]}>৳</Text>
              <TextInput
                value={budgetAlert}
                onChangeText={setBudgetAlert}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.textPrimary }]}
              />
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
          <Text style={[styles.sectionLabel, { flex: 1, marginTop: 0, marginBottom: 0, color: colors.textSecondary }]}>Reservations</Text>
          <Pressable onPress={addReservation}>
            <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>+ Add</Text>
          </Pressable>
        </View>

        {reservations.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginLeft: 4 }}>
            No reservations — tap + Add to create one
          </Text>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {reservations.map((reservation, index) => (
              <View key={reservation.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 }}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      value={reservation.name}
                      onChangeText={value => updateReservation(reservation.id, { name: value })}
                      placeholder="Name (e.g. Rent)"
                      placeholderTextColor={colors.textSecondary}
                      style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: colors.textPrimary }}
                      maxLength={60}
                    />
                    {reservation.isCarried && (
                      <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
                        Carried from last cycle
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginHorizontal: 6, fontFamily: 'PlusJakartaSans_400Regular' }}>৳</Text>
                  <TextInput
                    value={reservation.amount}
                    onChangeText={value => updateReservation(reservation.id, { amount: value.replace(/[^0-9.]/g, '') })}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    style={{ width: 80, textAlign: 'right', fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: colors.textPrimary }}
                  />
                  <Pressable onPress={() => removeReservation(reservation.id)} hitSlop={8} style={{ marginLeft: 12 }}>
                    <Text style={{ fontSize: 20, color: colors.error, lineHeight: 22 }}>×</Text>
                  </Pressable>
                </View>
                {index < reservations.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Preview</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {summaryRow('Money available', availableCash, colors.textPrimary, colors.textSecondary)}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {summaryRow('Savings', savingsTotal, colors.primary, colors.textSecondary)}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {summaryRow('Reservations', reservationsTotal, colors.textSecondary, colors.textSecondary)}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {summaryRow('Already spent', alreadySpentNum, colors.textSecondary, colors.textSecondary)}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {summaryRow('New pocket pool', pool, poolInvalid ? colors.error : colors.textPrimary, colors.textSecondary)}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {summaryRow('Daily budget', dailyBudget, dailyBudget < 0 ? colors.error : colors.primary, colors.textSecondary)}
        </View>

        {poolInvalid && (
          <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 8, marginLeft: 4, lineHeight: 18 }}>
            Savings, reservations, and already spent are more than the money available. Lower one of them to continue.
          </Text>
        )}
        {endDateInvalid && (
          <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 8, marginLeft: 4 }}>
            Choose an end date after the start date.
          </Text>
        )}
        {warning && !poolInvalid && (
          <Text style={{ fontSize: 12, color: colors.warning, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 8, marginLeft: 4, lineHeight: 18 }}>
            {warning}
          </Text>
        )}
        {error ? (
          <Text style={{ fontSize: 13, color: colors.error, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 16, textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={() => handleSubmit()}
          disabled={!canSubmit}
          style={{
            marginTop: 24,
            backgroundColor: canSubmit ? colors.primary : colors.border,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: canSubmit ? '#fff' : colors.textSecondary }}>
              {isFutureStart ? 'Save plan' : 'Start new cycle'}
            </Text>
          )}
        </Pressable>
      </ScrollView>

      <CalendarModal
        visible={showStartCal}
        onClose={() => setShowStartCal(false)}
        onSelect={date => { setStartDate(date); setShowStartCal(false); }}
        value={startDate}
        minimumDate={today}
        title="Start date"
      />
      <CalendarModal
        visible={showEndCal}
        onClose={() => setShowEndCal(false)}
        onSelect={date => { setEndDate(date); setShowEndCal(false); }}
        value={endDate}
        minimumDate={addDays(startDate, 1)}
        title="End date"
      />

      <Modal visible={conflicts.length > 0} transparent animationType="fade" onRequestClose={() => setConflicts([])}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary, marginBottom: 8 }}>
              Same reservation name
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20, marginBottom: 16 }}>
              Two reservations use the same name. Merge them into one, or go back and rename one.
            </Text>
            {conflicts.map(conflict => (
              <View key={conflict} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ flex: 1, fontSize: 14, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_500Medium' }} numberOfLines={1}>
                  {conflict}
                </Text>
                <Pressable
                  onPress={() => {
                    const approved = [...mergeApproved, normalizeName(conflict)];
                    setMergeApproved(approved);
                    setConflicts([]);
                    handleSubmit(approved);
                  }}
                  style={{ borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.primary, marginLeft: 8 }}
                >
                  <Text style={{ fontSize: 13, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Merge</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() => {
                setConflicts([]);
                setError('Change one of the duplicate names, then continue.');
              }}
              style={{ paddingVertical: 14, alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_500Medium' }}>Rename instead</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function summaryRow(label: string, amount: number, valueColor: string, labelColor: string) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 14, color: labelColor, fontFamily: 'PlusJakartaSans_400Regular' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: valueColor }}>
        ৳{Math.floor(amount).toLocaleString()}
      </Text>
    </View>
  );
}

const shadowStyle = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

function receiptActionLabel(action: ReceiptAction): string {
  switch (action) {
    case 'pool': return 'Add to pool';
    case 'savings': return 'Add to savings';
    case 'reservation': return 'Create a reservation';
    case 'used': return 'Already used it';
    case 'pending': return 'Decide later';
  }
}

const styles = {
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    marginTop: 20,
    marginLeft: 4,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden' as const,
    ...shadowStyle,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'space-between' as const,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium' as const,
  },
  rowValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular' as const,
  },
  currency: {
    fontSize: 14,
    marginRight: 4,
    fontFamily: 'PlusJakartaSans_400Regular' as const,
  },
  input: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular' as const,
    textAlign: 'right' as const,
    minWidth: 80,
  },
  hint: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular' as const,
    marginTop: 2,
  },
};
