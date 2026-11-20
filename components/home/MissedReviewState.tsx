import { DeleteConfirmModal } from '@/components/home/DeleteConfirmModal';
import { MoneySnapshot } from '@/components/home/MoneySnapshot';
import { SpendModal } from '@/components/home/SpendModal';
import { useThemeColors } from '@/contexts/theme';
import { fromDateStr } from '@/lib/db';
import type { ActiveCycleData } from '@/services/cycleService';
import { addEntry, deleteEntry, updateEntry, type EntryRow } from '@/services/entryService';
import type { MissedDay } from '@/services/reviewService';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

interface Props {
  cycleData: ActiveCycleData;
  savingsBalance: number;
  missedDays: MissedDay[];
  missedEntries: EntryRow[];
  navPillOffset: number;
  insets: EdgeInsets;
  note: string;
  onChangeNote: (v: string) => void;
  confirming: boolean;
  onConfirm: () => void;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
}

interface EditingEntry {
  id: number;
  note: string;
  amount: number;
}

function formatDate(dateStr: string): string {
  return fromDateStr(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function money(value: number): string {
  return `৳${Math.floor(value).toLocaleString()}`;
}

export function MissedReviewState({
  cycleData, savingsBalance,
  missedDays, missedEntries,
  navPillOffset, insets,
  note, onChangeNote,
  confirming, onConfirm,
  onReload, onError,
}: Props) {
  const colors = useThemeColors();
  const db = useSQLiteContext();

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<EntryRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const firstDate = formatDate(missedDays[0].date);
  const lastDate = formatDate(missedDays[missedDays.length - 1].date);
  const dateLabel = missedDays.length === 1 ? firstDate : `${firstDate} – ${lastDate}`;
  const latestDayId = missedDays[missedDays.length - 1].id;

  const missedTotal = missedEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const poolLeft = Math.max(0, cycleData.leftInCycle - missedTotal);
  const dailyBudgetAfter = cycleData.daysLeft > 0 ? poolLeft / cycleData.daysLeft : 0;

  const modalAmountNum = parseFloat(modalAmount) || 0;
  const canSave = modalAmountNum > 0;

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
    if (!canSave || modalSaving) return;
    setModalSaving(true);
    try {
      if (editingEntry) {
        await updateEntry(db, editingEntry.id, modalNote.trim(), modalAmountNum);
      } else {
        await addEntry(db, latestDayId, modalNote.trim(), modalAmountNum);
      }
      closeModal();
      await onReload();
    } catch (error) {
      console.error('[catch-up save error]', error);
      onError('Failed to save entry. Please try again.');
    } finally {
      setModalSaving(false);
    }
  }

  async function handleDeleteEntry() {
    if (!confirmDeleteEntry || deleting) return;
    setDeleting(true);
    try {
      await deleteEntry(db, confirmDeleteEntry.id);
      setConfirmDeleteEntry(null);
      await onReload();
    } catch (error) {
      console.error('[catch-up delete error]', error);
      onError('Failed to delete entry. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 24) + navPillOffset + 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.warning, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
          Missed review
        </Text>
        <Text style={{ fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 }}>
          Catch up first.
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 24 }}>
          {missedDays.length === 1
            ? `You missed your review on ${dateLabel}.`
            : `You missed ${missedDays.length} reviews (${dateLabel}).`
          } Check what&apos;s logged and add anything you forgot.
        </Text>

        <View style={{ marginBottom: 16 }}>
          <MoneySnapshot
            poolLeft={poolLeft}
            savingsBalance={savingsBalance}
            reservations={cycleData.reservations}
            dailyBudgetAfter={dailyBudgetAfter}
          />
        </View>

        <View style={{ backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary }}>Spending</Text>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: missedTotal > 0 ? colors.textPrimary : colors.textSecondary }}>
              ৳{missedTotal.toLocaleString()}
            </Text>
          </View>
          {missedEntries.map(entry => (
            <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Pressable
                onPress={() => openEdit(entry)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingLeft: 16, paddingRight: 8 }}
              >
                <Text style={{ flex: 1, fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }} numberOfLines={1}>
                  {entry.note || 'general spending'}
                </Text>
                <Text style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_600SemiBold', marginRight: 6 }}>
                  ৳{entry.amount.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 16, color: colors.textSecondary, lineHeight: 18, includeFontPadding: false }}>›</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmDeleteEntry(entry)} hitSlop={8} style={{ paddingVertical: 13, paddingRight: 16, paddingLeft: 8 }}>
                <Text style={{ fontSize: 18, color: colors.error, lineHeight: 20, includeFontPadding: false }}>×</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={openAdd} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 }}>
            <Text style={{ fontSize: 20, color: colors.primary, lineHeight: 22, includeFontPadding: false }}>+</Text>
            <Text style={{ fontSize: 14, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Add spend</Text>
          </Pressable>
        </View>

        {missedDays.length > 1 && (
          <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 16 }}>
            {money(missedTotal)} over {missedDays.length} days ≈ {money(Math.floor(missedTotal / missedDays.length))}/day
          </Text>
        )}

        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
          Note (optional)
        </Text>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 24 }}>
          <TextInput
            value={note}
            onChangeText={onChangeNote}
            placeholder="Add a note…"
            placeholderTextColor={colors.textSecondary}
            style={{ fontSize: 15, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }}
            multiline
          />
        </View>

      </ScrollView>

      <View style={{ position: 'absolute', bottom: navPillOffset + 8, left: 20, right: 20 }}>
        <Pressable
          onPress={onConfirm}
          disabled={confirming}
          style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
        >
          {confirming
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' }}>Confirm & continue</Text>
          }
        </Pressable>
      </View>

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
        poolExhausted={false}
        hardCapError={null}
        thresholdWarning={null}
      />

      <DeleteConfirmModal
        entry={confirmDeleteEntry}
        onConfirm={handleDeleteEntry}
        onCancel={() => setConfirmDeleteEntry(null)}
        deleting={deleting}
      />
    </KeyboardAvoidingView>
  );
}
