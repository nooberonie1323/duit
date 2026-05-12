import { CalendarModal } from '@/components/ui/CalendarModal';
import { toDateStr } from '@/lib/db';
import { archiveLeftoverAsSavings, createCycle } from '@/services/cycleService';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
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
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ leftover?: string; prevCycleId?: string }>();

  const leftover = parseFloat(params.leftover ?? '0');
  const prevCycleId = params.prevCycleId ? parseInt(params.prevCycleId) : null;
  const hasLeftover = leftover > 0;

  const [step, setStep] = useState<'leftover' | 'form'>(hasLeftover ? 'leftover' : 'form');

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

  function handleLeftoverContinue() {
    if (leftoverDest === 'reservation') {
      if (!newResName.trim()) return;
      setReservations(prev => [...prev, { name: newResName.trim(), amount: String(leftover) }]);
    }
    setStep('form');
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

      await createCycle(db, {
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
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 16 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 15, color: '#16A34A', fontFamily: 'PlusJakartaSans_600SemiBold' }}>← Back</Text>
          </Pressable>
          <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.5, marginBottom: 6 }}>
            You have leftover.
          </Text>
          <Text style={{ fontSize: 14, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' }}>
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
            <View style={{ marginTop: 6, marginBottom: 4, backgroundColor: '#fff', borderRadius: 16, padding: 16, ...shadowStyle }}>
              <Text style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 8 }}>
                Reservation name
              </Text>
              <TextInput
                value={newResName}
                onChangeText={setNewResName}
                placeholder="e.g. Rent, internet bill…"
                placeholderTextColor="#D1D5DB"
                autoFocus
                style={{
                  borderWidth: 1.5,
                  borderColor: newResName.trim() ? '#16A34A' : '#E5E7EB',
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  fontSize: 14,
                  fontFamily: 'PlusJakartaSans_400Regular',
                  color: '#111827',
                }}
              />
              <Text style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular', marginTop: 8 }}>
                Amount: ৳{Math.floor(leftover).toLocaleString()} (the full leftover)
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleLeftoverContinue}
            disabled={!canContinue}
            style={{
              marginTop: 24,
              backgroundColor: canContinue ? '#16A34A' : '#E5E7EB',
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: canContinue ? '#fff' : '#9CA3AF' }}>
              Continue
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Form step ──────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F9FAFB' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 16 }}>
        <Pressable
          onPress={() => (hasLeftover ? setStep('leftover') : router.back())}
          hitSlop={12}
          style={{ marginBottom: 20 }}
        >
          <Text style={{ fontSize: 15, color: '#16A34A', fontFamily: 'PlusJakartaSans_600SemiBold' }}>← Back</Text>
        </Pressable>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.5 }}>
          New cycle
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 24) + 40 }}
      >
        {/* Pay period */}
        <Text style={styles.sectionLabel}>Pay period</Text>
        <View style={styles.card}>
          <Pressable onPress={() => setShowStartCal(true)} style={styles.row}>
            <Text style={styles.rowLabel}>Start date</Text>
            <Text style={styles.rowValue}>{fmtDate(startDate)}</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable onPress={() => setShowEndCal(true)} style={styles.row}>
            <Text style={styles.rowLabel}>End date</Text>
            <Text style={styles.rowValue}>{fmtDate(endDate)}</Text>
          </Pressable>
        </View>

        {/* Income */}
        <Text style={styles.sectionLabel}>Income</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Paycheck</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.currency}>৳</Text>
              <TextInput
                value={income}
                onChangeText={setIncome}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#D1D5DB"
                style={styles.input}
              />
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.rowLabel}>Already spent</Text>
              <Text style={styles.hint}>Optional — if payday was a few days ago</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.currency}>৳</Text>
              <TextInput
                value={alreadySpent}
                onChangeText={setAlreadySpent}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#D1D5DB"
                style={styles.input}
              />
            </View>
          </View>
        </View>

        {/* Goals */}
        <Text style={styles.sectionLabel}>Goals</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.rowLabel}>Savings</Text>
              <Text style={styles.hint}>Set aside, not spendable</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.currency}>৳</Text>
              <TextInput
                value={savings}
                onChangeText={setSavings}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#D1D5DB"
                style={styles.input}
              />
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.rowLabel}>Budget alert</Text>
              <Text style={styles.hint}>Warn when daily budget drops below this</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.currency}>৳</Text>
              <TextInput
                value={budgetAlert}
                onChangeText={setBudgetAlert}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#D1D5DB"
                style={styles.input}
              />
            </View>
          </View>
        </View>

        {/* Reservations */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
          <Text style={[styles.sectionLabel, { flex: 1, marginTop: 0, marginBottom: 0 }]}>Reservations</Text>
          <Pressable onPress={() => setReservations(prev => [...prev, { name: '', amount: '' }])}>
            <Text style={{ fontSize: 13, color: '#16A34A', fontFamily: 'PlusJakartaSans_600SemiBold' }}>+ Add</Text>
          </Pressable>
        </View>
        {reservations.length === 0 ? (
          <Text style={{ fontSize: 13, color: '#D1D5DB', fontFamily: 'PlusJakartaSans_400Regular', marginLeft: 4 }}>
            No reservations — tap + Add to create one
          </Text>
        ) : (
          <View style={styles.card}>
            {reservations.map((r, i) => (
              <View key={i}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 }}>
                  <TextInput
                    value={r.name}
                    onChangeText={v => setReservations(prev => prev.map((x, j) => (j === i ? { ...x, name: v } : x)))}
                    placeholder="Name (e.g. Rent)"
                    placeholderTextColor="#D1D5DB"
                    style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#111827' }}
                  />
                  <Text style={{ fontSize: 14, color: '#9CA3AF', marginHorizontal: 6, fontFamily: 'PlusJakartaSans_400Regular' }}>৳</Text>
                  <TextInput
                    value={r.amount}
                    onChangeText={v => setReservations(prev => prev.map((x, j) => (j === i ? { ...x, amount: v } : x)))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                    style={{ width: 80, textAlign: 'right', fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#111827' }}
                  />
                  <Pressable
                    onPress={() => setReservations(prev => prev.filter((_, j) => j !== i))}
                    hitSlop={8}
                    style={{ marginLeft: 12 }}
                  >
                    <Text style={{ fontSize: 20, color: '#EF4444', lineHeight: 22 }}>×</Text>
                  </Pressable>
                </View>
                {i < reservations.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        )}

        {/* Leftover summary */}
        {hasLeftover && (
          <View style={{ backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, marginTop: 20 }}>
            <Text style={{ fontSize: 13, color: '#16A34A', fontFamily: 'PlusJakartaSans_400Regular' }}>
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
          <Text style={{ color: '#EF4444', fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 16, textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={saving}
          style={{
            marginTop: 24,
            backgroundColor: saving ? '#9CA3AF' : '#16A34A',
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
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 2,
        borderColor: selected ? '#16A34A' : 'transparent',
        ...shadowStyle,
      }}
    >
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2,
        borderColor: selected ? '#16A34A' : '#D1D5DB',
        backgroundColor: selected ? '#16A34A' : 'transparent',
        marginRight: 14,
        marginTop: 1,
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {selected && <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#fff' }} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#111827', marginBottom: 3 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' }}>
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

const styles = {
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold' as const,
    color: '#9CA3AF',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    marginTop: 20,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
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
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium' as const,
    color: '#111827',
  },
  rowValue: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans_400Regular' as const,
  },
  currency: {
    fontSize: 14,
    color: '#9CA3AF',
    marginRight: 4,
    fontFamily: 'PlusJakartaSans_400Regular' as const,
  },
  input: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular' as const,
    color: '#111827',
    textAlign: 'right' as const,
    minWidth: 80,
  },
  hint: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'PlusJakartaSans_400Regular' as const,
    marginTop: 2,
  },
};
