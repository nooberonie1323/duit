import { MissedReviewState } from '@/components/home/MissedReviewState';
import { ErrorToast } from '@/components/ui/ErrorToast';
import { useThemeColors } from '@/contexts/theme';
import { fromDateStr } from '@/lib/db';
import {
  getCloseCycleData,
  getSavedClosePlan,
  saveClosePlan,
  type CarryoverChoiceInput,
  type CarryoverDestination,
  type CloseCycleData,
  type CloseItemType,
  type SavedClosePlan,
} from '@/services/closeCycleService';
import { getActiveCycle, type ActiveCycleData } from '@/services/cycleService';
import { type EntryRow } from '@/services/entryService';
import {
  backfillMissingDays,
  confirmCatchUpReview,
  getMissedDays,
  getMissedEntries,
  type MissedDay,
} from '@/services/reviewService';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LeftoverItem {
  key: string;
  type: CloseItemType;
  reservationId: number | null;
  label: string;
  amount: number;
}

interface ChoiceState {
  destination: CarryoverDestination;
  targetName: string;
}

const DESTINATIONS: CarryoverDestination[] = ['pool', 'savings', 'reservation', 'spent'];

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function itemKey(itemType: CloseItemType, reservationId: number | null): string {
  if (itemType === 'reservation') return `reservation:${reservationId}`;
  return itemType;
}

function buildItems(data: CloseCycleData): LeftoverItem[] {
  const items: LeftoverItem[] = [];
  if (data.poolLeftover > 0) {
    items.push({
      key: 'pool',
      type: 'pool',
      reservationId: null,
      label: 'Left in pool',
      amount: data.poolLeftover,
    });
  }
  for (const reservation of data.reservations) {
    items.push({
      key: itemKey('reservation', reservation.reservationId),
      type: 'reservation',
      reservationId: reservation.reservationId,
      label: reservation.name,
      amount: reservation.amount,
    });
  }
  if (data.savingsRemaining > 0) {
    items.push({
      key: 'savings',
      type: 'savings',
      reservationId: null,
      label: 'Savings',
      amount: data.savingsRemaining,
    });
  }
  return items;
}

function buildChoices(
  items: LeftoverItem[],
  savedPlan: SavedClosePlan | null
): Record<string, ChoiceState> {
  const next: Record<string, ChoiceState> = {};
  for (const item of items) {
    if (item.type === 'reservation') {
      next[item.key] = { destination: 'reservation', targetName: item.label };
    } else if (item.type === 'savings') {
      next[item.key] = { destination: 'savings', targetName: '' };
    } else {
      next[item.key] = { destination: 'pool', targetName: '' };
    }
  }

  if (!savedPlan) return next;

  for (const saved of savedPlan.choices) {
    const key = itemKey(saved.item_type, saved.source_reservation_id);
    if (!next[key]) continue;
    next[key] = {
      destination: saved.destination,
      targetName: saved.target_reservation_name ?? '',
    };
  }
  return next;
}

function destinationLabel(
  destination: CarryoverDestination,
  itemType: CloseItemType
): string {
  switch (destination) {
    case 'pool':
      return 'Move to next cycle pool';
    case 'savings':
      return itemType === 'savings' ? 'Keep in savings' : 'Move to savings';
    case 'reservation':
      return itemType === 'reservation' ? 'Carry as a reservation' : 'Make it a reservation';
    case 'spent':
      return 'I already spent it';
  }
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = fromDateStr(startDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const end = fromDateStr(endDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${start} – ${end}`;
}

export default function CloseCycleScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const db = useSQLiteContext();

  const [loading, setLoading] = useState(true);
  const [activeData, setActiveData] = useState<ActiveCycleData | null>(null);
  const [closeData, setCloseData] = useState<CloseCycleData | null>(null);
  const [missedDays, setMissedDays] = useState<MissedDay[]>([]);
  const [missedEntries, setMissedEntries] = useState<EntryRow[]>([]);

  const [catchUpAmount, setCatchUpAmount] = useState('');
  const [catchUpNote, setCatchUpNote] = useState('');
  const [confirmingCatchUp, setConfirmingCatchUp] = useState(false);

  const [choices, setChoices] = useState<Record<string, ChoiceState>>({});
  const [savedPlanId, setSavedPlanId] = useState<number | null>(null);
  const [mergeApproved, setMergeApproved] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const active = await getActiveCycle(db);
    if (!active) {
      setActiveData(null);
      setCloseData(null);
      setLoading(false);
      return;
    }

    // A cycle can end without the app ever opening on its last days.
    await backfillMissingDays(
      db,
      active.cycle.id,
      active.cycle.start_date,
      active.dailyBudget
    );

    const [missed, data, savedPlan] = await Promise.all([
      getMissedDays(db, active.cycle.id),
      getCloseCycleData(db),
      getSavedClosePlan(db, active.cycle.id),
    ]);
    const entries = await getMissedEntries(db, missed.map(day => day.id));

    setActiveData(active);
    setMissedDays(missed);
    setMissedEntries(entries);
    setCloseData(data);
    setSavedPlanId(savedPlan?.id ?? null);
    setSaved(false);
    setConflicts([]);
    setMergeApproved([]);
    setChoices(buildChoices(data ? buildItems(data) : [], savedPlan));
    setLoading(false);
  }, [db]);

  useEffect(() => {
    load().catch(error => {
      console.error('[close cycle load error]', error);
      setErrorMsg('Could not load this cycle. Please try again.');
      setLoading(false);
    });
  }, [load]);

  async function handleConfirmCatchUp() {
    if (!activeData || missedDays.length === 0 || confirmingCatchUp) return;
    const stagedTotal = missedEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const total = parseFloat(catchUpAmount) || stagedTotal;
    setConfirmingCatchUp(true);
    try {
      await confirmCatchUpReview(
        db,
        missedDays,
        total,
        activeData.leftInCycle,
        catchUpNote
      );
      setCatchUpAmount('');
      setCatchUpNote('');
      await load();
    } catch (error) {
      console.error('[close cycle catch up error]', error);
      setErrorMsg('Failed to save catch-up review. Please try again.');
    } finally {
      setConfirmingCatchUp(false);
    }
  }

  function updateChoice(key: string, patch: Partial<ChoiceState>) {
    setChoices(previous => ({
      ...previous,
      [key]: { ...previous[key], ...patch },
    }));
  }

  function buildInputs(items: LeftoverItem[]): CarryoverChoiceInput[] {
    return items.map(item => {
      const choice = choices[item.key];
      const destination = choice?.destination ?? 'pool';
      return {
        itemType: item.type,
        sourceReservationId: item.reservationId,
        sourceName: item.label,
        amount: item.amount,
        destination,
        targetReservationName:
          destination === 'reservation' ? (choice?.targetName ?? '').trim() : null,
      };
    });
  }

  function findConflicts(
    inputs: CarryoverChoiceInput[],
    approved: string[]
  ): string[] {
    const names = new Map<string, string>();
    const counts = new Map<string, number>();
    for (const input of inputs) {
      if (input.destination !== 'reservation') continue;
      const normalized = normalizeName(input.targetReservationName ?? '');
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      names.set(normalized, input.targetReservationName!.trim());
    }
    return Array.from(counts.entries())
      .filter(([normalized, count]) => count > 1 && !approved.includes(normalized))
      .map(([normalized]) => names.get(normalized) ?? normalized);
  }

  async function persistChoices(items: LeftoverItem[], approved: string[]) {
    if (!closeData || saving) return;

    const inputs = buildInputs(items);
    if (inputs.some(input => input.destination === 'reservation' && !input.targetReservationName)) {
      setErrorMsg('Give each reservation a name before saving.');
      return;
    }

    const nextConflicts = findConflicts(inputs, approved);
    if (nextConflicts.length > 0) {
      setConflicts(nextConflicts);
      return;
    }

    setSaving(true);
    try {
      const planId = await saveClosePlan(db, closeData.cycleId, inputs);
      setSavedPlanId(planId);
      setMergeApproved(approved);
      setConflicts([]);
      setSaved(true);
    } catch (error) {
      console.error('[close cycle save error]', error);
      setErrorMsg('Failed to save your choices. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!closeData || !activeData) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center' }}>
          There is no cycle to close.
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 15, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (missedDays.length > 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ fontSize: 15, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>← Back</Text>
          </Pressable>
        </View>
        <MissedReviewState
          missedDays={missedDays}
          missedEntries={missedEntries}
          navPillOffset={0}
          insets={insets}
          catchUpAmount={catchUpAmount}
          onChangeAmount={setCatchUpAmount}
          catchUpNote={catchUpNote}
          onChangeNote={setCatchUpNote}
          confirming={confirmingCatchUp}
          onConfirm={handleConfirmCatchUp}
        />
        <ErrorToast message={errorMsg} onDismiss={() => setErrorMsg(null)} />
      </View>
    );
  }

  const items = buildItems(closeData);

  if (saved) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 44, marginBottom: 16 }}>✅</Text>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 }}>
          Choices saved.
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
          Nothing has moved yet. Next, plan the new cycle and confirm the numbers.
        </Text>
        <Pressable
          onPress={() =>
            savedPlanId !== null
              ? router.replace({ pathname: '/new-cycle', params: { planId: String(savedPlanId) } })
              : router.back()
          }
          style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center', marginBottom: 12 }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' }}>Plan the new cycle</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 12 }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_500Medium' }}>Back to home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 24) + 40 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 15, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>← Back</Text>
        </Pressable>

        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
          {formatDateRange(closeData.startDate, closeData.endDate)}
        </Text>
        <Text style={{ fontSize: 30, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -0.8, marginBottom: 6 }}>
          Close this cycle.
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 20 }}>
          Decide where each leftover goes. Nothing moves until you start the new cycle.
        </Text>

        <View style={{ backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 16, marginBottom: 20, ...shadowStyle }}>
          {summaryRow('Left in pool', closeData.poolLeftover, colors.textPrimary, colors.textSecondary)}
          <View style={{ height: 1, backgroundColor: colors.border }} />
          {summaryRow('Reservations left', closeData.reservationsLeftover, colors.textSecondary, colors.textSecondary)}
          <View style={{ height: 1, backgroundColor: colors.border }} />
          {summaryRow('Savings', closeData.savingsRemaining, colors.primary, colors.textSecondary)}
        </View>

        {items.length === 0 ? (
          <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 20, marginBottom: 20, ...shadowStyle }}>
            <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary, marginBottom: 6 }}>
              Nothing left over.
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
              You spent everything in this cycle. Save to continue.
            </Text>
          </View>
        ) : (
          items.map(item => {
            const choice = choices[item.key] ?? { destination: 'pool', targetName: '' };
            return (
              <View
                key={item.key}
                style={{ backgroundColor: colors.card, borderRadius: 20, padding: 16, marginBottom: 12, ...shadowStyle }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary }} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
                      {item.type === 'reservation' ? 'Reservation' : item.type === 'savings' ? 'Savings' : 'Pocket pool'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary }}>
                    ৳{Math.floor(item.amount).toLocaleString()}
                  </Text>
                </View>

                {DESTINATIONS.map(destination => {
                  const isSelected = choice.destination === destination;
                  return (
                    <Pressable
                      key={destination}
                      onPress={() => updateChoice(item.key, { destination })}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }}
                    >
                      <View style={{
                        width: 18, height: 18, borderRadius: 9, borderWidth: 2,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        marginRight: 10, alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' }} />}
                      </View>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_500Medium' }}>
                        {destinationLabel(destination, item.type)}
                      </Text>
                    </Pressable>
                  );
                })}

                {choice.destination === 'reservation' && (
                  <View style={{ marginTop: 8, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10 }}>
                    <TextInput
                      value={choice.targetName}
                      onChangeText={value => updateChoice(item.key, { targetName: value })}
                      placeholder="Reservation name"
                      placeholderTextColor={colors.textSecondary}
                      style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }}
                      maxLength={60}
                    />
                  </View>
                )}
              </View>
            );
          })
        )}

        {savedPlanId !== null && (
          <Text style={{ fontSize: 12, color: colors.primary, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center', marginTop: 4, marginBottom: 4 }}>
            Saved earlier — you can still change these choices.
          </Text>
        )}

        <Pressable
          onPress={() => persistChoices(items, mergeApproved)}
          disabled={saving}
          style={{
            marginTop: 16,
            backgroundColor: saving ? colors.textSecondary : colors.primary,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' }}>
              {savedPlanId !== null ? 'Update choices' : 'Save choices'}
            </Text>
          )}
        </Pressable>
      </ScrollView>

      <Modal visible={conflicts.length > 0} transparent animationType="fade" onRequestClose={() => setConflicts([])}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary, marginBottom: 8 }}>
              Same reservation name
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20, marginBottom: 16 }}>
              Two or more leftovers use the same name. Merge them into one reservation, or go back and rename one.
            </Text>
            {conflicts.map(conflict => (
              <View key={conflict} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ flex: 1, fontSize: 14, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_500Medium' }} numberOfLines={1}>
                  {conflict}
                </Text>
                <Pressable
                  onPress={() => persistChoices(items, [...mergeApproved, normalizeName(conflict)])}
                  style={{ borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.primary, marginLeft: 8 }}
                >
                  <Text style={{ fontSize: 13, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Merge</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() => {
                setConflicts([]);
                setErrorMsg('Change one of the duplicate names, then save again.');
              }}
              style={{ paddingVertical: 14, alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_500Medium' }}>Rename instead</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ErrorToast
        message={errorMsg}
        onDismiss={() => setErrorMsg(null)}
        bottomOffset={Math.max(insets.bottom, 16) + 24}
      />
    </View>
  );
}

function summaryRow(label: string, amount: number, valueColor: string, labelColor: string) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 }}>
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
