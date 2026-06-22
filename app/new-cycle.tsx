import { CalendarModal } from '@/components/ui/CalendarModal';
import { useThemeColors } from '@/contexts/theme';
import { toDateStr } from '@/lib/db';
import { archiveLeftoverAsSavings, createCycle } from '@/services/cycleService';
import {
  addLoanReceipt,
  getActiveBorrowedLoansForCycle,
  getLoans,
  recordRepaymentReservation,
  type ActiveBorrowedLoan,
  type LoanWithComputed,
  type ReceiptAction,
} from '@/services/loanService';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type LeftoverDest = 'pool' | 'savings' | 'reservation';

interface FormReservation {
  name: string;
  amount: string;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function NewCycleScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ leftover?: string; prevCycleId?: string }>();

  const leftover = parseFloat(params.leftover ?? '0');
  const prevCycleId = params.prevCycleId ? parseInt(params.prevCycleId) : null;
  const hasLeftover = leftover > 0;

  const [loans, setLoans] = useState<LoanWithComputed[]>([]);
  const [activeBorrowedLoans, setActiveBorrowedLoans] = useState<ActiveBorrowedLoan[]>([]);
  const [loansLoaded, setLoansLoaded] = useState(false);

  // Per-loan receipt action state: loanId → { action, reservationName, returnAmount }
  const [loanActions, setLoanActions] = useState<Record<number, { action: ReceiptAction; reservationName: string; returnAmount: string }>>({});

  type StepType = 'leftover' | 'loans' | 'form';

  const [step, setStep] = useState<StepType>(hasLeftover ? 'leftover' : 'form');

  // Leftover step
  const [leftoverDest, setLeftoverDest] = useState<LeftoverDest>('pool');
  const [newResName, setNewResName] = useState('');

  // Form step — reservations always start empty for a new cycle
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(addDays(today, 29));
  const [income, setIncome] = useState('');
  const [alreadySpent, setAlreadySpent] = useState('');
  const [savings, setSavings] = useState('');
  const [budgetAlert, setBudgetAlert] = useState('');
  const [reservations, setReservations] = useState<FormReservation[]>([]);
  const [showStartCal, setShowStartCal] = useState(false);
  const [showEndCal, setShowEndCal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadLoans = useCallback(async () => {
    try {
      const [all, borrowed] = await Promise.all([
        getLoans(db),
        getActiveBorrowedLoansForCycle(db),
      ]);
      setLoans(all);
      setActiveBorrowedLoans(borrowed);
    } catch (e) {
      console.error('[NewCycle loadLoans]', e);
    } finally {
      setLoansLoaded(true);
    }
  }, [db]);

  useEffect(() => { loadLoans(); }, [loadLoans]);

  // Once loans are loaded, set the correct initial step
  useEffect(() => {
    if (!loansLoaded) return;
    const hasActive = loans.some(l => l.status === 'active') || activeBorrowedLoans.length > 0;
    if (!hasLeftover && hasActive) setStep('loans');
  }, [loansLoaded, loans, activeBorrowedLoans, hasLeftover]);

  function handleLeftoverContinue() {
    if (leftoverDest === 'reservation') {
      if (!newResName.trim()) return;
      setReservations(prev => [...prev, { name: newResName.trim(), amount: String(leftover) }]);
    }
    const hasActive = loans.some(l => l.status === 'active') || activeBorrowedLoans.length > 0;
    setStep(hasActive ? 'loans' : 'form');
  }

  async function handleSubmit() {
    setError('');
    const incomeNum = parseFloat(income);
    if (!income || isNaN(incomeNum) || incomeNum <= 0) {
      setError('Enter a valid income amount.');
      return;
    }
    if (endDate <= startDate) {
      setError('End date must be after start date.');
      return;
    }

    setSaving(true);
    try {
      let poolLeftover = 0;
      if (hasLeftover) {
        if (leftoverDest === 'pool') {
          poolLeftover = leftover;
        } else if (leftoverDest === 'savings' && prevCycleId) {
          await archiveLeftoverAsSavings(db, prevCycleId, leftover);
        }
        // 'reservation': already added to reservations array in handleLeftoverContinue
      }

      const validReservations = reservations
        .filter(r => r.name.trim() && parseFloat(r.amount) > 0)
        .map(r => ({ name: r.name.trim(), amount: parseFloat(r.amount) }));

      const cycleId = await createCycle(db, {
        startDate,
        endDate,
        income: incomeNum,
        alreadySpent: parseFloat(alreadySpent) || 0,
        savings: parseFloat(savings) || 0,
        budgetAlert: parseFloat(budgetAlert) || 0,
        startFromToday: toDateStr(startDate) === toDateStr(new Date()),
        poolLeftover,
        reservations: validReservations,
      });

      // Auto-create repayment reservations for active borrowed loans with plans
      for (const borrowed of activeBorrowedLoans) {
        const resResult = await db.runAsync(
          'INSERT INTO reservations (cycle_id, name, amount) VALUES (?, ?, ?)',
          [cycleId, `৳${Math.floor(borrowed.amount_per_month).toLocaleString()} for ${borrowed.person_name} (loan repayment)`, borrowed.amount_per_month]
        );
        await recordRepaymentReservation(db, borrowed.loan_id, cycleId, resResult.lastInsertRowId);
      }

      // Process loan receipt actions chosen in the loans step
      for (const [loanIdStr, actionState] of Object.entries(loanActions)) {
        const loanId = parseInt(loanIdStr);
        const loan = loans.find(l => l.id === loanId);
        if (!loan || !actionState.action || actionState.action === 'pending') continue;
        const returnNum = parseFloat(actionState.returnAmount) || 0;
        if (returnNum <= 0) continue;
        await addLoanReceipt(db, {
          loanId,
          originalAmount: loan.original_amount,
          amount: returnNum,
          action: actionState.action,
          cycleId,
          reservationName: actionState.action === 'reservation' ? actionState.reservationName : undefined,
        });
      }

      router.replace('/(tabs)');
    } catch (e) {
      setError('Something went wrong. Try again.');
      console.error('[NewCycle error]', e);
    } finally {
      setSaving(false);
    }
  }

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  // ── Leftover step ──────────────────────────────────────────────────────────
  if (step === 'leftover') {
    const canContinue = leftoverDest !== 'reservation' || newResName.trim().length > 0;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 16 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 15, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>← Back</Text>
          </Pressable>
          <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 }}>
            You have leftover.
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
            ৳{Math.floor(leftover).toLocaleString()} left from your last cycle. What do you want to do with it?
          </Text>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 24) + 40 }}
        >
          <LeftoverOption
            selected={leftoverDest === 'pool'}
            onPress={() => setLeftoverDest('pool')}
            title="Add to next cycle's pool"
            description="More daily spending budget for your new cycle."
          />
          <LeftoverOption
            selected={leftoverDest === 'savings'}
            onPress={() => setLeftoverDest('savings')}
            title="Move to savings"
            description="Archive it as money you've saved. Won't affect daily budget."
          />
          <LeftoverOption
            selected={leftoverDest === 'reservation'}
            onPress={() => setLeftoverDest('reservation')}
            title="Create a reservation"
            description={`Set aside ৳${Math.floor(leftover).toLocaleString()} as a new reservation for this cycle.`}
          />

          {leftoverDest === 'reservation' && (
            <View style={{ marginTop: 6, marginBottom: 4, backgroundColor: colors.card, borderRadius: 16, padding: 16, ...shadowStyle }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 8 }}>
                Reservation name
              </Text>
              <TextInput
                value={newResName}
                onChangeText={setNewResName}
                placeholder="e.g. Rent, internet bill…"
                placeholderTextColor={colors.textSecondary}
                autoFocus
                style={{
                  borderWidth: 1.5,
                  borderColor: newResName.trim() ? colors.primary : colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  fontSize: 14,
                  fontFamily: 'PlusJakartaSans_400Regular',
                  color: colors.textPrimary,
                }}
              />
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 8 }}>
                Amount: ৳{Math.floor(leftover).toLocaleString()} (the full leftover)
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleLeftoverContinue}
            disabled={!canContinue}
            style={{
              marginTop: 24,
              backgroundColor: canContinue ? colors.primary : colors.border,
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: canContinue ? '#fff' : colors.textSecondary }}>
              Continue
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Loans step ──────────────────────────────────────────────────────────────
  if (step === 'loans') {
    const activeLentLoans = loans.filter(l => l.type === 'lent' && l.status === 'active');
    const hasSomething = activeLentLoans.length > 0 || activeBorrowedLoans.length > 0;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 16 }}>
          <Pressable
            onPress={() => setStep(hasLeftover ? 'leftover' : 'form')}
            hitSlop={12}
            style={{ marginBottom: 20 }}
          >
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
                            setLoanActions(prev => {
                              const next = { ...prev };
                              delete next[loan.id];
                              return next;
                            });
                          } else {
                            setLoanActions(prev => ({
                              ...prev,
                              [loan.id]: { action: 'pending', reservationName: '', returnAmount: String(Math.floor(remaining)) },
                            }));
                          }
                        }}
                        style={{
                          borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
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
                            onPress={() => setLoanActions(prev => ({ ...prev, [loan.id]: { ...prev[loan.id], action } }))}
                            style={{
                              flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
                              borderBottomWidth: 1, borderBottomColor: colors.border,
                            }}
                          >
                            <View style={{
                              width: 18, height: 18, borderRadius: 9, borderWidth: 2,
                              borderColor: state.action === action ? colors.primary : colors.border,
                              backgroundColor: state.action === action ? colors.primary : 'transparent',
                              marginRight: 10, flexShrink: 0,
                              alignItems: 'center', justifyContent: 'center',
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
                              onChangeText={v => setLoanActions(prev => ({ ...prev, [loan.id]: { ...prev[loan.id], reservationName: v } }))}
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
              {activeBorrowedLoans.map(bl => (
                <View
                  key={bl.loan_id}
                  style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', ...shadowStyle }}
                >
                  <Text style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_500Medium' }}>
                    For {bl.person_name}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }}>
                    ৳{Math.floor(bl.amount_per_month).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {!hasSomething && (
            <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', marginTop: 40 }}>
              No active loan activity this cycle.
            </Text>
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
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 16 }}>
        <Pressable
          onPress={() => (hasLeftover ? setStep('leftover') : router.back())}
          hitSlop={12}
          style={{ marginBottom: 20 }}
        >
          <Text style={{ fontSize: 15, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>← Back</Text>
        </Pressable>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -0.5 }}>
          New cycle
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 24) + 40 }}
      >
        {/* Pay period */}
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

        {/* Income */}
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

        {/* Goals */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Goals</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Savings</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>Set aside, not spendable</Text>
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

        {/* Reservations */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
          <Text style={[styles.sectionLabel, { flex: 1, marginTop: 0, marginBottom: 0, color: colors.textSecondary }]}>Reservations</Text>
          <Pressable onPress={() => setReservations(prev => [...prev, { name: '', amount: '' }])}>
            <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>+ Add</Text>
          </Pressable>
        </View>
        {reservations.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginLeft: 4 }}>
            No reservations — tap + Add to create one
          </Text>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {reservations.map((r, i) => (
              <View key={i}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 }}>
                  <TextInput
                    value={r.name}
                    onChangeText={v => setReservations(prev => prev.map((x, j) => (j === i ? { ...x, name: v } : x)))}
                    placeholder="Name (e.g. Rent)"
                    placeholderTextColor={colors.textSecondary}
                    style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: colors.textPrimary }}
                  />
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginHorizontal: 6, fontFamily: 'PlusJakartaSans_400Regular' }}>৳</Text>
                  <TextInput
                    value={r.amount}
                    onChangeText={v => setReservations(prev => prev.map((x, j) => (j === i ? { ...x, amount: v } : x)))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    style={{ width: 80, textAlign: 'right', fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: colors.textPrimary }}
                  />
                  <Pressable
                    onPress={() => setReservations(prev => prev.filter((_, j) => j !== i))}
                    hitSlop={8}
                    style={{ marginLeft: 12 }}
                  >
                    <Text style={{ fontSize: 20, color: colors.error, lineHeight: 22 }}>×</Text>
                  </Pressable>
                </View>
                {i < reservations.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              </View>
            ))}
          </View>
        )}

        {/* Leftover summary */}
        {hasLeftover && (
          <View style={{ backgroundColor: colors.primaryLight, borderRadius: 14, padding: 14, marginTop: 20 }}>
            <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_400Regular' }}>
              ৳{Math.floor(leftover).toLocaleString()} leftover →{' '}
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                {leftoverDest === 'pool'
                  ? 'added to pool'
                  : leftoverDest === 'savings'
                  ? 'moved to savings'
                  : `reserved as "${newResName}"`}
              </Text>
            </Text>
          </View>
        )}

        {error ? (
          <Text style={{ color: colors.error, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 16, textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={saving}
          style={{
            marginTop: 24,
            backgroundColor: saving ? colors.textSecondary : colors.primary,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' }}>
            {saving ? 'Starting…' : 'Start new cycle'}
          </Text>
        </Pressable>
      </ScrollView>

      <CalendarModal
        visible={showStartCal}
        onClose={() => setShowStartCal(false)}
        onSelect={d => { setStartDate(d); setShowStartCal(false); }}
        value={startDate}
        title="Start date"
      />
      <CalendarModal
        visible={showEndCal}
        onClose={() => setShowEndCal(false)}
        onSelect={d => { setEndDate(d); setShowEndCal(false); }}
        value={endDate}
        minimumDate={addDays(startDate, 1)}
        title="End date"
      />
    </KeyboardAvoidingView>
  );
}

function LeftoverOption({
  selected,
  onPress,
  title,
  description,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  description: string;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 2,
        borderColor: selected ? colors.primary : 'transparent',
        ...shadowStyle,
      }}
    >
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary : 'transparent',
        marginRight: 14,
        marginTop: 1,
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {selected && <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#fff' }} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary, marginBottom: 3 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
          {description}
        </Text>
      </View>
    </Pressable>
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
