import { useThemeColors } from '@/contexts/theme';
import {
  addLoanReceipt,
  deleteLoan,
  resolvePendingReceipt,
  settleLoan,
  type LoanReceiptRow,
  type LoanWithComputed,
  type ReceiptAction,
} from '@/services/loanService';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

interface Props {
  loan: LoanWithComputed | null;
  receipts: LoanReceiptRow[];
  activeCycleId: number | null;
  onClose: () => void;
  onMutated: () => void;
  onResolvedPending: () => void;
  db: SQLiteDatabase;
}

type ModalView = 'detail' | 'return' | 'action' | 'resolve';

export function LoanDetailLentModal({ loan, receipts, activeCycleId, onClose, onMutated, onResolvedPending, db }: Props) {
  const colors = useThemeColors();
  const [view, setView] = useState<ModalView>('detail');
  const [returnAmount, setReturnAmount] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [selectedAction, setSelectedAction] = useState<ReceiptAction | null>(null);
  const [reservationName, setReservationName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Resolve pending
  const [resolvingReceipt, setResolvingReceipt] = useState<LoanReceiptRow | null>(null);
  const [resolveAction, setResolveAction] = useState<ReceiptAction | null>(null);
  const [resolveReservationName, setResolveReservationName] = useState('');

  if (!loan) return null;

  const remaining = loan.original_amount - loan.amount_returned;
  const returnAmountNum = parseFloat(returnAmount) || 0;
  const canContinueReturn = returnAmountNum > 0 && returnAmountNum <= remaining;

  const actionOptions: { action: ReceiptAction; label: string; description: string }[] = [
    { action: 'pool', label: 'Add to pool', description: 'Increases your daily budget for remaining days.' },
    { action: 'savings', label: 'Add to savings', description: 'Adds to your cycle savings balance.' },
    { action: 'reservation', label: 'Create a reservation', description: 'Lock it away for something specific.' },
    { action: 'used', label: 'Already used it', description: 'Just mark it as accounted for.' },
    { action: 'pending', label: 'Decide later', description: 'Record the return now, act on it later.' },
  ];

  function resetAndClose() {
    setView('detail');
    setReturnAmount('');
    setReturnNote('');
    setSelectedAction(null);
    setReservationName('');
    setResolvingReceipt(null);
    setResolveAction(null);
    setResolveReservationName('');
    setError('');
    onClose();
  }

  function handleBackdropPress() {
    if (view !== 'detail') {
      setView('detail');
      setError('');
    } else {
      resetAndClose();
    }
  }

  function openResolve(receipt: LoanReceiptRow) {
    setResolvingReceipt(receipt);
    setResolveAction(null);
    setResolveReservationName('');
    setError('');
    setView('resolve');
  }

  async function handleResolveConfirm() {
    if (!resolvingReceipt || !resolveAction || saving) return;
    if (resolveAction === 'reservation' && !resolveReservationName.trim()) {
      setError('Enter a reservation name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await resolvePendingReceipt(db, {
        receiptId: resolvingReceipt.id,
        loanId: loan!.id,
        originalAmount: loan!.original_amount,
        newAction: resolveAction as Exclude<ReceiptAction, 'pending'>,
        cycleId: activeCycleId,
        reservationName: resolveAction === 'reservation' ? resolveReservationName : undefined,
      });
      setResolvingReceipt(null);
      setResolveAction(null);
      setResolveReservationName('');
      setError('');
      setView('detail');
      onResolvedPending();
    } catch (e) {
      console.error('[LoanDetailLentModal resolveConfirm]', e);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmAction() {
    if (!selectedAction || saving) return;
    if (selectedAction === 'reservation' && !reservationName.trim()) {
      setError('Enter a reservation name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addLoanReceipt(db, {
        loanId: loan!.id,
        originalAmount: loan!.original_amount,
        amount: returnAmountNum,
        action: selectedAction,
        cycleId: activeCycleId,
        reservationName: selectedAction === 'reservation' ? reservationName : undefined,
      });
      onMutated();
      resetAndClose();
    } catch (e) {
      console.error('[LoanDetailLentModal confirm]', e);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSettle() {
    if (saving) return;
    setSaving(true);
    try {
      await settleLoan(db, loan!.id);
      onMutated();
      resetAndClose();
    } catch (e) {
      console.error('[LoanDetailLentModal settle]', e);
      setError('Failed to settle. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (saving) return;
    setSaving(true);
    try {
      await deleteLoan(db, loan!.id);
      onMutated();
      resetAndClose();
    } catch (e) {
      console.error('[LoanDetailLentModal delete]', e);
      setError('Failed to delete. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleBackdropPress}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        onPress={handleBackdropPress}
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxHeight: '88%' }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary }}>
                  {loan.person_name}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
                  You lent ৳{Math.floor(loan.original_amount).toLocaleString()}
                  {remaining > 0 ? ` · ৳${Math.floor(remaining).toLocaleString()} remaining` : ' · fully returned'}
                </Text>
              </View>
              <Pressable onPress={handleBackdropPress} hitSlop={8}>
                <Text style={{ fontSize: 22, color: colors.textSecondary, lineHeight: 24, includeFontPadding: false }}>×</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {view === 'detail' && (
                <DetailView
                  loan={loan}
                  receipts={receipts}
                  remaining={remaining}
                  saving={saving}
                  error={error}
                  onRecordReturn={() => { setView('return'); setError(''); }}
                  onSettle={handleSettle}
                  onDelete={handleDelete}
                  onResolvePending={openResolve}
                  colors={colors}
                />
              )}
              {view === 'return' && (
                <ReturnAmountView
                  remaining={remaining}
                  returnAmount={returnAmount}
                  returnAmountNum={returnAmountNum}
                  returnNote={returnNote}
                  canContinue={canContinueReturn}
                  error={error}
                  onChangeAmount={setReturnAmount}
                  onChangeNote={setReturnNote}
                  onBack={() => { setView('detail'); setError(''); }}
                  onContinue={() => { setView('action'); setError(''); }}
                  colors={colors}
                />
              )}
              {view === 'action' && (
                <ActionView
                  returnAmountNum={returnAmountNum}
                  actionOptions={actionOptions}
                  selectedAction={selectedAction}
                  reservationName={reservationName}
                  saving={saving}
                  error={error}
                  activeCycleId={activeCycleId}
                  onSelectAction={setSelectedAction}
                  onChangeReservationName={setReservationName}
                  onBack={() => { setView('return'); setError(''); }}
                  onConfirm={handleConfirmAction}
                  colors={colors}
                />
              )}
              {view === 'resolve' && resolvingReceipt && (
                <ResolveView
                  receipt={resolvingReceipt}
                  selectedAction={resolveAction}
                  reservationName={resolveReservationName}
                  saving={saving}
                  error={error}
                  activeCycleId={activeCycleId}
                  onSelectAction={setResolveAction}
                  onChangeReservationName={setResolveReservationName}
                  onBack={() => { setView('detail'); setError(''); }}
                  onConfirm={handleResolveConfirm}
                  colors={colors}
                />
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailView({
  loan, receipts, remaining, saving, error,
  onRecordReturn, onSettle, onDelete, onResolvePending, colors,
}: {
  loan: LoanWithComputed;
  receipts: LoanReceiptRow[];
  remaining: number;
  saving: boolean;
  error: string;
  onRecordReturn: () => void;
  onSettle: () => void;
  onDelete: () => void;
  onResolvePending: (receipt: LoanReceiptRow) => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const isSettled = loan.status === 'settled';
  return (
    <View>
      {loan.note ? (
        <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 16 }}>
          {loan.note}
        </Text>
      ) : null}

      {isSettled ? (
        <View style={{ backgroundColor: colors.primaryLight, borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>✓ Settled</Text>
        </View>
      ) : (
        <View style={{ gap: 10, marginBottom: 16 }}>
          {remaining > 0 && (
            <Pressable
              onPress={onRecordReturn}
              disabled={saving}
              style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: colors.primary }}
            >
              <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Record return</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onSettle}
            disabled={saving}
            style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border }}
          >
            <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Mark as settled</Text>
          </Pressable>
        </View>
      )}

      {receipts.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
            History
          </Text>
          {receipts.map((r, i) => {
            const isPending = r.action === 'pending';
            const dateStr = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (isPending) {
              return (
                <Pressable
                  key={r.id}
                  onPress={() => onResolvePending(r)}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 10,
                    borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.warning, flexShrink: 0 }} />
                    <View>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_500Medium' }}>
                        Pending · {dateStr}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.warning, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 1 }}>
                        Tap to resolve
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_700Bold' }}>
                      +৳{Math.floor(r.amount).toLocaleString()}
                    </Text>
                    <Text style={{ fontSize: 16, color: colors.textSecondary, includeFontPadding: false }}>›</Text>
                  </View>
                </Pressable>
              );
            }
            return (
              <View
                key={r.id}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
              >
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
                  {actionLabel(r.action)} · {dateStr}
                </Text>
                <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }}>
                  +৳{Math.floor(r.amount).toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {error ? <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 8 }}>{error}</Text> : null}

      {isSettled && (
        <Pressable
          onPress={onDelete}
          disabled={saving}
          style={{ paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#FEF2F2' }}
        >
          <Text style={{ fontSize: 13, color: colors.error, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Delete loan</Text>
        </Pressable>
      )}
    </View>
  );
}

function ReturnAmountView({
  remaining, returnAmount, returnAmountNum, returnNote, canContinue, error,
  onChangeAmount, onChangeNote, onBack, onContinue, colors,
}: {
  remaining: number;
  returnAmount: string;
  returnAmountNum: number;
  returnNote: string;
  canContinue: boolean;
  error: string;
  onChangeAmount: (v: string) => void;
  onChangeNote: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const amountError = returnAmountNum > remaining
    ? `Exceeds ৳${Math.floor(remaining).toLocaleString()} remaining`
    : null;

  return (
    <View>
      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
        Note (optional)
      </Text>
      <View style={{ backgroundColor: colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 }}>
        <TextInput
          value={returnNote}
          onChangeText={onChangeNote}
          placeholder="Any notes?"
          placeholderTextColor={colors.textSecondary}
          style={{ fontSize: 15, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }}
          maxLength={80}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          Amount returned
        </Text>
        <Pressable onPress={() => onChangeAmount(String(Math.floor(remaining)))} hitSlop={8}>
          <Text style={{ fontSize: 12, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
            Full ৳{Math.floor(remaining).toLocaleString()}
          </Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: amountError ? colors.error : returnAmountNum > 0 ? colors.primary : colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 }}>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginRight: 6, fontFamily: 'PlusJakartaSans_400Regular' }}>৳</Text>
        <TextInput
          value={returnAmount}
          onChangeText={onChangeAmount}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: colors.textPrimary }}
        />
      </View>
      {amountError ? <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 8 }}>{amountError}</Text> : <View style={{ height: 14 }} />}
      {error ? <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 8 }}>{error}</Text> : null}

      <View style={{ gap: 10, marginTop: 4 }}>
        <Pressable
          onPress={onContinue}
          disabled={!canContinue}
          style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: colors.primary, opacity: canContinue ? 1 : 0.4 }}
        >
          <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Continue →</Text>
        </Pressable>
        <Pressable onPress={onBack} style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border }}>
          <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Go back</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ActionView({
  returnAmountNum, actionOptions, selectedAction, reservationName,
  saving, error, activeCycleId,
  onSelectAction, onChangeReservationName, onBack, onConfirm, colors,
}: {
  returnAmountNum: number;
  actionOptions: { action: ReceiptAction; label: string; description: string }[];
  selectedAction: ReceiptAction | null;
  reservationName: string;
  saving: boolean;
  error: string;
  activeCycleId: number | null;
  onSelectAction: (a: ReceiptAction) => void;
  onChangeReservationName: (v: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const canConfirm =
    selectedAction !== null &&
    (selectedAction !== 'reservation' || reservationName.trim().length > 0);

  // Pool and savings only available if there's an active cycle
  const available = activeCycleId !== null
    ? actionOptions
    : actionOptions.filter(o => o.action !== 'pool' && o.action !== 'savings' && o.action !== 'reservation');

  return (
    <View>
      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary, marginBottom: 16 }}>
        ৳{Math.floor(returnAmountNum).toLocaleString()} returned. What do you want to do with it?
      </Text>

      {activeCycleId === null && (
        <View style={{ backgroundColor: colors.primaryLight, borderRadius: 10, padding: 10, marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: colors.primary, fontFamily: 'PlusJakartaSans_500Medium' }}>
            No active cycle — pool and savings options unavailable.
          </Text>
        </View>
      )}

      {available.map(opt => (
        <Pressable
          key={opt.action}
          onPress={() => onSelectAction(opt.action)}
          style={{
            flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 12,
            borderWidth: 1.5, marginBottom: 8,
            borderColor: selectedAction === opt.action ? colors.primary : colors.border,
            backgroundColor: selectedAction === opt.action ? colors.primaryLight : colors.background,
          }}
        >
          <View style={{
            width: 20, height: 20, borderRadius: 10, borderWidth: 2,
            borderColor: selectedAction === opt.action ? colors.primary : colors.border,
            backgroundColor: selectedAction === opt.action ? colors.primary : 'transparent',
            marginRight: 12, marginTop: 1, flexShrink: 0,
            alignItems: 'center', justifyContent: 'center',
          }}>
            {selectedAction === opt.action && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary }}>{opt.label}</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>{opt.description}</Text>
          </View>
        </Pressable>
      ))}

      {selectedAction === 'reservation' && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
            Reservation name
          </Text>
          <View style={{ backgroundColor: colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: reservationName.trim() ? colors.primary : colors.border, paddingHorizontal: 14, paddingVertical: 12 }}>
            <TextInput
              value={reservationName}
              onChangeText={onChangeReservationName}
              placeholder="e.g. Grocery fund"
              placeholderTextColor={colors.textSecondary}
              style={{ fontSize: 15, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }}
              maxLength={60}
            />
          </View>
        </View>
      )}

      {error ? <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 8 }}>{error}</Text> : null}

      <View style={{ gap: 10, marginTop: 4 }}>
        <Pressable
          onPress={onConfirm}
          disabled={!canConfirm || saving}
          style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: colors.primary, opacity: canConfirm ? 1 : 0.4 }}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Confirm</Text>
          }
        </Pressable>
        <Pressable onPress={onBack} disabled={saving} style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border }}>
          <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Go back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const RESOLVE_ACTION_OPTIONS: { action: Exclude<ReceiptAction, 'pending'>; label: string; description: string }[] = [
  { action: 'pool', label: 'Add to pool', description: 'Increases your daily budget for remaining days.' },
  { action: 'savings', label: 'Add to savings', description: 'Adds to your cycle savings balance.' },
  { action: 'reservation', label: 'Create a reservation', description: 'Lock it away for something specific.' },
  { action: 'used', label: 'Already used it', description: 'Mark it as accounted for.' },
];

function ResolveView({
  receipt, selectedAction, reservationName, saving, error, activeCycleId,
  onSelectAction, onChangeReservationName, onBack, onConfirm, colors,
}: {
  receipt: LoanReceiptRow;
  selectedAction: ReceiptAction | null;
  reservationName: string;
  saving: boolean;
  error: string;
  activeCycleId: number | null;
  onSelectAction: (a: ReceiptAction) => void;
  onChangeReservationName: (v: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const dateStr = new Date(receipt.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const available = activeCycleId !== null
    ? RESOLVE_ACTION_OPTIONS
    : RESOLVE_ACTION_OPTIONS.filter(o => o.action !== 'pool' && o.action !== 'savings' && o.action !== 'reservation');
  const canConfirm =
    selectedAction !== null &&
    (selectedAction !== 'reservation' || reservationName.trim().length > 0);

  return (
    <View>
      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary, marginBottom: 4 }}>
        ৳{Math.floor(receipt.amount).toLocaleString()} returned on {dateStr}
      </Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 16 }}>
        Where should this money go?
      </Text>

      {activeCycleId === null && (
        <View style={{ backgroundColor: colors.primaryLight, borderRadius: 10, padding: 10, marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: colors.primary, fontFamily: 'PlusJakartaSans_500Medium' }}>
            No active cycle — pool and savings options unavailable.
          </Text>
        </View>
      )}

      {available.map(opt => (
        <Pressable
          key={opt.action}
          onPress={() => onSelectAction(opt.action)}
          style={{
            flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 12,
            borderWidth: 1.5, marginBottom: 8,
            borderColor: selectedAction === opt.action ? colors.primary : colors.border,
            backgroundColor: selectedAction === opt.action ? colors.primaryLight : colors.background,
          }}
        >
          <View style={{
            width: 20, height: 20, borderRadius: 10, borderWidth: 2,
            borderColor: selectedAction === opt.action ? colors.primary : colors.border,
            backgroundColor: selectedAction === opt.action ? colors.primary : 'transparent',
            marginRight: 12, marginTop: 1, flexShrink: 0,
            alignItems: 'center', justifyContent: 'center',
          }}>
            {selectedAction === opt.action && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary }}>{opt.label}</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>{opt.description}</Text>
          </View>
        </Pressable>
      ))}

      {selectedAction === 'reservation' && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
            Reservation name
          </Text>
          <View style={{ backgroundColor: colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: reservationName.trim() ? colors.primary : colors.border, paddingHorizontal: 14, paddingVertical: 12 }}>
            <TextInput
              value={reservationName}
              onChangeText={onChangeReservationName}
              placeholder="e.g. Grocery fund"
              placeholderTextColor={colors.textSecondary}
              style={{ fontSize: 15, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }}
              maxLength={60}
            />
          </View>
        </View>
      )}

      {error ? <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 8 }}>{error}</Text> : null}

      <View style={{ gap: 10, marginTop: 4 }}>
        <Pressable
          onPress={onConfirm}
          disabled={!canConfirm || saving}
          style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: colors.primary, opacity: canConfirm ? 1 : 0.4 }}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Confirm</Text>
          }
        </Pressable>
        <Pressable
          onPress={onBack}
          disabled={saving}
          style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border }}
        >
          <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Go back</Text>
        </Pressable>
      </View>
    </View>
  );
}

function actionLabel(action: ReceiptAction): string {
  switch (action) {
    case 'pool': return 'Added to pool';
    case 'savings': return 'Added to savings';
    case 'reservation': return 'Reserved';
    case 'used': return 'Already used';
    case 'pending': return 'Pending';
  }
}
