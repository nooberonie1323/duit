import { useThemeColors } from '@/contexts/theme';
import { toDateStr } from '@/lib/db';
import { createLoan, type LoanType } from '@/services/loanService';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

const NOTE_MAX_LENGTH = 80;

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  db: SQLiteDatabase;
}

export function AddLoanModal({ visible, onClose, onCreated, db }: Props) {
  const colors = useThemeColors();
  const [direction, setDirection] = useState<LoanType | null>(null);
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [hasRepaymentPlan, setHasRepaymentPlan] = useState(false);
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [totalMonths, setTotalMonths] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setDirection(null);
    setPersonName('');
    setAmount('');
    setNote('');
    setHasRepaymentPlan(false);
    setMonthlyAmount('');
    setTotalMonths('');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  const amountNum = parseFloat(amount) || 0;
  const monthlyNum = parseFloat(monthlyAmount) || 0;
  const monthsNum = parseFloat(totalMonths) || 0;

  function handleMonthlyChange(v: string) {
    setMonthlyAmount(v);
    const monthly = parseFloat(v) || 0;
    if (monthly > 0 && amountNum > 0) {
      setTotalMonths(String(Math.ceil(amountNum / monthly)));
    }
  }

  function handleMonthsChange(v: string) {
    setTotalMonths(v);
    const months = parseFloat(v) || 0;
    if (months > 0 && amountNum > 0) {
      setMonthlyAmount(String(Math.ceil(amountNum / months)));
    }
  }

  const canSave =
    direction !== null &&
    personName.trim().length > 0 &&
    amountNum > 0 &&
    (!hasRepaymentPlan || (monthlyNum > 0 && monthsNum > 0));

  async function handleSave() {
    if (!canSave || saving || !direction) return;
    setError('');
    setSaving(true);
    try {
      await createLoan(db, {
        type: direction,
        person_name: personName.trim(),
        original_amount: amountNum,
        note,
        loaned_at: toDateStr(new Date()),
        repayment_plan:
          direction === 'borrowed' && hasRepaymentPlan
            ? { amount_per_month: monthlyNum, total_months: monthsNum }
            : undefined,
      });
      reset();
      onCreated();
    } catch (e) {
      console.error('[AddLoanModal save]', e);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        onPress={handleClose}
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxHeight: '90%' }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary }}>
                New loan
              </Text>
              <Pressable onPress={handleClose} hitSlop={8}>
                <Text style={{ fontSize: 22, color: colors.textSecondary, lineHeight: 24, includeFontPadding: false }}>×</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Direction picker */}
              <Text style={labelStyle(colors)}>Direction</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {(['lent', 'borrowed'] as LoanType[]).map(d => (
                  <Pressable
                    key={d}
                    onPress={() => setDirection(d)}
                    style={{
                      flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12,
                      backgroundColor: direction === d ? colors.primary : colors.background,
                      borderWidth: 1.5,
                      borderColor: direction === d ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{
                      fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold',
                      color: direction === d ? '#fff' : colors.textSecondary,
                    }}>
                      {d === 'lent' ? 'I lent' : 'I borrowed'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Person */}
              <Text style={labelStyle(colors)}>Person</Text>
              <View style={inputWrapper(colors, personName.length > 0)}>
                <TextInput
                  value={personName}
                  onChangeText={setPersonName}
                  placeholder="Who?"
                  placeholderTextColor={colors.textSecondary}
                  style={inputStyle(colors)}
                  maxLength={60}
                />
              </View>

              {/* Amount */}
              <Text style={labelStyle(colors)}>Amount</Text>
              <View style={[inputWrapper(colors, amountNum > 0), { flexDirection: 'row', alignItems: 'center' }]}>
                <Text style={{ fontSize: 16, color: colors.textSecondary, marginRight: 6, fontFamily: 'PlusJakartaSans_400Regular' }}>৳</Text>
                <TextInput
                  value={amount}
                  onChangeText={v => {
                    setAmount(v);
                    if (hasRepaymentPlan) {
                      const a = parseFloat(v) || 0;
                      if (monthlyNum > 0 && a > 0) setTotalMonths(String(Math.ceil(a / monthlyNum)));
                      else if (monthsNum > 0 && a > 0) setMonthlyAmount(String(Math.ceil(a / monthsNum)));
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  style={[inputStyle(colors), { flex: 1 }]}
                />
              </View>

              {/* Note */}
              <Text style={labelStyle(colors)}>Note (optional)</Text>
              <View style={inputWrapper(colors, false)}>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="What's it for?"
                  placeholderTextColor={colors.textSecondary}
                  style={inputStyle(colors)}
                  maxLength={NOTE_MAX_LENGTH}
                />
              </View>

              {/* Repayment plan — only for borrowed */}
              {direction === 'borrowed' && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary }}>
                      Set up repayment plan
                    </Text>
                    <Switch
                      value={hasRepaymentPlan}
                      onValueChange={setHasRepaymentPlan}
                      trackColor={{ true: colors.primary, false: colors.border }}
                      thumbColor={'#fff'}
                    />
                  </View>

                  {hasRepaymentPlan && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={labelStyle(colors)}>৳ / month</Text>
                        <View style={[inputWrapper(colors, monthlyNum > 0), { flexDirection: 'row', alignItems: 'center' }]}>
                          <Text style={{ fontSize: 14, color: colors.textSecondary, marginRight: 4, fontFamily: 'PlusJakartaSans_400Regular' }}>৳</Text>
                          <TextInput
                            value={monthlyAmount}
                            onChangeText={handleMonthlyChange}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.textSecondary}
                            style={[inputStyle(colors), { flex: 1 }]}
                          />
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={labelStyle(colors)}>Months</Text>
                        <View style={inputWrapper(colors, monthsNum > 0)}>
                          <TextInput
                            value={totalMonths}
                            onChangeText={handleMonthsChange}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.textSecondary}
                            style={inputStyle(colors)}
                          />
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {error ? (
                <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 8 }}>
                  {error}
                </Text>
              ) : null}

              <Pressable
                onPress={handleSave}
                disabled={!canSave || saving}
                style={{
                  paddingVertical: 15, alignItems: 'center', borderRadius: 14,
                  backgroundColor: colors.primary, opacity: canSave ? 1 : 0.4,
                  marginTop: 4,
                }}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Save</Text>
                }
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function labelStyle(colors: ReturnType<typeof useThemeColors>) {
  return {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold' as const,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  };
}

function inputWrapper(colors: ReturnType<typeof useThemeColors>, active: boolean) {
  return {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: active ? colors.primary : colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  };
}

function inputStyle(colors: ReturnType<typeof useThemeColors>) {
  return {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: 'PlusJakartaSans_400Regular' as const,
  };
}
