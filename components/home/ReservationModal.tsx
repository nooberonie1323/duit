import { useThemeColors } from '@/contexts/theme';
import type { ReservationRow } from '@/services/cycleService';
import type { ReservationTransactionRow } from '@/services/reservationService';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

const NOTE_MAX_LENGTH = 60;

interface Props {
  reservation: ReservationRow | null;
  transactions: ReservationTransactionRow[];
  onClose: () => void;
  amount: string;
  onChangeAmount: (v: string) => void;
  note: string;
  onChangeNote: (v: string) => void;
  amountError: string | null;
  canSubmit: boolean;
  saving: boolean;
  confirmingRelease: boolean;
  onSpend: () => void;
  onReleasePress: () => void;
  onConfirmRelease: () => void;
  onCancelRelease: () => void;
  onUseFullAmount: () => void;
  onUndoLast: () => void;
  onDeleteReservation: () => void;
}

export function ReservationModal({
  reservation, transactions, onClose,
  amount, onChangeAmount, note, onChangeNote,
  amountError, canSubmit, saving,
  confirmingRelease, onSpend, onReleasePress, onConfirmRelease, onCancelRelease,
  onUseFullAmount, onUndoLast, onDeleteReservation,
}: Props) {
  const colors = useThemeColors();
  if (!reservation) return null;

  const remaining = reservation.amount - reservation.spent - reservation.released;
  const done = remaining <= 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxHeight: '85%' }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary }}>
                  {reservation.name}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
                  ৳{Math.floor(Math.max(0, remaining)).toLocaleString()} of ৳{Math.floor(reservation.amount).toLocaleString()} left
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={{ fontSize: 22, color: colors.textSecondary, lineHeight: 24, includeFontPadding: false }}>×</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {done ? (
                <View style={{ backgroundColor: colors.primaryLight, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                    ✓ Fully used
                  </Text>
                </View>
              ) : confirmingRelease ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 16, lineHeight: 21 }}>
                    Send ৳{Math.floor(parseFloat(amount) || 0).toLocaleString()} back to your daily budget? This increases your left-in-cycle and daily budget.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      onPress={onCancelRelease}
                      disabled={saving}
                      style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border }}
                    >
                      <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={onConfirmRelease}
                      disabled={saving}
                      style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: colors.primary }}
                    >
                      {saving
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Confirm</Text>
                      }
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                      Amount
                    </Text>
                    <Pressable onPress={onUseFullAmount} hitSlop={8}>
                      <Text style={{ fontSize: 12, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                        Use full ৳{Math.floor(remaining).toLocaleString()}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: amountError ? colors.error : colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginRight: 6, fontFamily: 'PlusJakartaSans_400Regular' }}>৳</Text>
                    <TextInput
                      value={amount}
                      onChangeText={onChangeAmount}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: colors.textPrimary }}
                    />
                  </View>
                  {amountError && (
                    <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 8 }}>
                      {amountError}
                    </Text>
                  )}

                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
                    Note (optional)
                  </Text>
                  <View style={{ backgroundColor: colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 }}>
                    <TextInput
                      value={note}
                      onChangeText={onChangeNote}
                      placeholder="e.g. weekend treat"
                      placeholderTextColor={colors.textSecondary}
                      style={{ fontSize: 15, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }}
                      maxLength={NOTE_MAX_LENGTH}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      onPress={onReleasePress}
                      disabled={!canSubmit}
                      style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, opacity: canSubmit ? 1 : 0.5 }}
                    >
                      <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Send to pool</Text>
                    </Pressable>
                    <Pressable
                      onPress={onSpend}
                      disabled={!canSubmit}
                      style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: colors.primary, opacity: canSubmit ? 1 : 0.5 }}
                    >
                      {saving
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Spend</Text>
                      }
                    </Pressable>
                  </View>
                </View>
              )}

              {transactions.length > 0 && (
                <View>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                    History
                  </Text>
                  {transactions.map((t, i) => {
                    const isSpend = t.type === 'spend';
                    const dateStr = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <View
                        key={t.id}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
                      >
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary }}>
                            {isSpend ? 'Spent' : 'Sent to pool'} · {dateStr}
                          </Text>
                          {t.note && (
                            <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 1 }}>
                              {t.note}
                            </Text>
                          )}
                        </View>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: isSpend ? colors.textPrimary : colors.primary, marginRight: i === 0 ? 10 : 0 }}>
                          {isSpend ? '−' : '+'}৳{Math.floor(t.amount).toLocaleString()}
                        </Text>
                        {i === 0 && (
                          <Pressable onPress={onUndoLast} disabled={saving} hitSlop={8}>
                            <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Undo</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {transactions.length === 0 && (
                <Pressable
                  onPress={onDeleteReservation}
                  disabled={saving}
                  style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: '#FEF2F2', marginTop: 4 }}
                >
                  <Text style={{ fontSize: 13, color: colors.error, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Delete reservation</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
