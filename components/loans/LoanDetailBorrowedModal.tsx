import { useThemeColors } from '@/contexts/theme';
import {
  deleteLoan,
  settleLoan,
  type LoanRepaymentRecordRow,
  type LoanWithComputed,
} from '@/services/loanService';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

interface Props {
  loan: LoanWithComputed | null;
  repaymentRecords: LoanRepaymentRecordRow[];
  onClose: () => void;
  onMutated: () => void;
  db: SQLiteDatabase;
}

export function LoanDetailBorrowedModal({ loan, repaymentRecords, onClose, onMutated, db }: Props) {
  const colors = useThemeColors();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!loan) return null;

  const plan = loan.repayment_plan;
  const monthsPaid = loan.months_paid;
  const totalMonths = plan?.total_months ?? 0;
  const progressPct = totalMonths > 0 ? Math.min(1, monthsPaid / totalMonths) : 0;
  const amountPaid = plan ? plan.amount_per_month * monthsPaid : 0;
  const amountRemaining = loan.original_amount - amountPaid;
  const isSettled = loan.status === 'settled';

  function handleClose() {
    setError('');
    onClose();
  }

  async function handleSettle() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await settleLoan(db, loan!.id);
      onMutated();
      handleClose();
    } catch (e) {
      console.error('[LoanDetailBorrowedModal settle]', e);
      setError('Failed to settle. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await deleteLoan(db, loan!.id);
      onMutated();
      handleClose();
    } catch (e) {
      console.error('[LoanDetailBorrowedModal delete]', e);
      setError('Failed to delete. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        onPress={handleClose}
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxHeight: '88%' }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary }}>
                  {loan.person_name}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
                  You borrowed ৳{Math.floor(loan.original_amount).toLocaleString()}
                </Text>
              </View>
              <Pressable onPress={handleClose} hitSlop={8}>
                <Text style={{ fontSize: 22, color: colors.textSecondary, lineHeight: 24, includeFontPadding: false }}>×</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {loan.note ? (
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 14 }}>
                  {loan.note}
                </Text>
              ) : null}

              {isSettled ? (
                <View style={{ backgroundColor: colors.primaryLight, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>✓ Settled</Text>
                </View>
              ) : null}

              {plan && !isSettled ? (
                <View style={{ backgroundColor: colors.background, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
                      ৳{Math.floor(plan.amount_per_month).toLocaleString()}/month · {monthsPaid} of {totalMonths} paid
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_700Bold' }}>
                      {Math.round(progressPct * 100)}%
                    </Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ height: 6, width: `${progressPct * 100}%`, backgroundColor: colors.primary, borderRadius: 3 }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
                      Paid: ৳{Math.floor(amountPaid).toLocaleString()}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
                      Left: ৳{Math.floor(Math.max(0, amountRemaining)).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ) : null}

              {repaymentRecords.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                    Repayment history
                  </Text>
                  {repaymentRecords.map((r, i) => {
                    const dateStr = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <View
                        key={r.id}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
                      >
                        <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
                          Reserved · {dateStr}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_700Bold' }}>
                          ৳{Math.floor(plan?.amount_per_month ?? 0).toLocaleString()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {error ? <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 8 }}>{error}</Text> : null}

              {!isSettled ? (
                <Pressable
                  onPress={handleSettle}
                  disabled={saving}
                  style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 }}
                >
                  {saving
                    ? <ActivityIndicator color={colors.textSecondary} />
                    : <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Mark as fully settled</Text>
                  }
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleDelete}
                  disabled={saving}
                  style={{ paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#FEF2F2' }}
                >
                  <Text style={{ fontSize: 13, color: colors.error, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Delete loan</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
