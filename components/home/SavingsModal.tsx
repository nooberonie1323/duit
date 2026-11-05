import { useThemeColors } from '@/contexts/theme';
import type { SavingsLedgerRow, SavingsLedgerType } from '@/services/savingsService';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

const NOTE_MAX_LENGTH = 60;

interface Props {
  visible: boolean;
  onClose: () => void;
  savingsBalance: number;
  history: SavingsLedgerRow[];
  step: 1 | 2;
  amount: string;
  note: string;
  onChangeAmount: (v: string) => void;
  onChangeNote: (v: string) => void;
  amountError: string | null;
  canContinue: boolean;
  saving: boolean;
  onContinue: () => void;
  onBack: () => void;
  onConfirm: () => void;
}

function ledgerLabel(type: SavingsLedgerType): string {
  switch (type) {
    case 'opening_balance': return 'Opening balance';
    case 'contribution': return 'Added to savings';
    case 'withdrawal': return 'Used';
    case 'carry_in': return 'Carried in';
    case 'carry_out': return 'Moved out';
    case 'spent': return 'Spent from savings';
  }
}

function SavingsHistory({ history }: { history: SavingsLedgerRow[] }) {
  const colors = useThemeColors();
  if (history.length === 0) return null;
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
        History
      </Text>
      {history.map((entry, i) => {
        const dateStr = new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const isIncrease = entry.amount > 0;
        return (
          <View
            key={entry.id}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary }}>
                {ledgerLabel(entry.type)} · {dateStr}
              </Text>
              {entry.note ? (
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 1 }}>
                  {entry.note}
                </Text>
              ) : null}
            </View>
            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: isIncrease ? colors.primary : colors.warning }}>
              {isIncrease ? '+' : '−'}৳{Math.floor(Math.abs(entry.amount)).toLocaleString()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function SavingsModal({
  visible, onClose,
  savingsBalance, history,
  step, amount, note,
  onChangeAmount, onChangeNote,
  amountError, canContinue, saving,
  onContinue, onBack, onConfirm,
}: Props) {
  const colors = useThemeColors();
  const amountNum = parseFloat(amount) || 0;
  const fullyUsed = savingsBalance <= 0;

  const headerSubtitle = fullyUsed
    ? 'No savings yet'
    : `৳${Math.floor(savingsBalance).toLocaleString()} available`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxHeight: '85%' }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary }}>
                  {fullyUsed ? 'Savings' : step === 1 ? 'Use Savings' : 'Are you sure?'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
                  {headerSubtitle}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={{ fontSize: 22, color: colors.textSecondary, lineHeight: 24, includeFontPadding: false }}>×</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {fullyUsed ? (
                <EmptySavingsView history={history} />
              ) : step === 1 ? (
                <Step1View
                  savingsBalance={savingsBalance}
                  amount={amount}
                  note={note}
                  amountNum={amountNum}
                  amountError={amountError}
                  canContinue={canContinue}
                  history={history}
                  onChangeAmount={onChangeAmount}
                  onChangeNote={onChangeNote}
                  onContinue={onContinue}
                />
              ) : (
                <Step2View
                  amountNum={amountNum}
                  savingsBalance={savingsBalance}
                  saving={saving}
                  onConfirm={onConfirm}
                  onBack={onBack}
                />
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EmptySavingsView({ history }: { history: SavingsLedgerRow[] }) {
  const colors = useThemeColors();
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ backgroundColor: colors.primaryLight, borderRadius: 12, padding: 14, marginBottom: 4 }}>
        <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
          Your savings balance is empty
        </Text>
      </View>
      <SavingsHistory history={history} />
    </View>
  );
}

interface Step1ViewProps {
  savingsBalance: number;
  amount: string;
  note: string;
  amountNum: number;
  amountError: string | null;
  canContinue: boolean;
  history: SavingsLedgerRow[];
  onChangeAmount: (v: string) => void;
  onChangeNote: (v: string) => void;
  onContinue: () => void;
}

function Step1View({
  savingsBalance, amount, note, amountNum, amountError,
  canContinue, history, onChangeAmount, onChangeNote, onContinue,
}: Step1ViewProps) {
  const colors = useThemeColors();
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
        Note (optional)
      </Text>
      <View style={{ backgroundColor: colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 }}>
        <TextInput
          value={note}
          onChangeText={onChangeNote}
          placeholder="What did you use it for?"
          placeholderTextColor={colors.textSecondary}
          style={{ fontSize: 15, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }}
          maxLength={NOTE_MAX_LENGTH}
          returnKeyType="next"
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          Amount
        </Text>
        <Pressable onPress={() => onChangeAmount(String(Math.floor(savingsBalance)))} hitSlop={8}>
          <Text style={{ fontSize: 12, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
            Use full ৳{Math.floor(savingsBalance).toLocaleString()}
          </Text>
        </Pressable>
      </View>
      <View style={{
        flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
        borderColor: amountError ? colors.error : amountNum > 0 ? colors.primary : colors.border,
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
      }}>
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
      {amountError ? (
        <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 8 }}>
          {amountError}
        </Text>
      ) : null}

      <Pressable
        onPress={onContinue}
        disabled={!canContinue}
        style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: colors.primary, opacity: canContinue ? 1 : 0.4, marginTop: 8 }}
      >
        <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Continue →</Text>
      </Pressable>

      <SavingsHistory history={history} />
    </View>
  );
}

interface Step2ViewProps {
  amountNum: number;
  savingsBalance: number;
  saving: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

function Step2View({ amountNum, savingsBalance, saving, onConfirm, onBack }: Step2ViewProps) {
  const colors = useThemeColors();
  const remainingAfter = savingsBalance - amountNum;
  const pct = savingsBalance > 0 ? Math.round((amountNum / savingsBalance) * 100) : 0;

  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' }}>
        <Text style={{ fontSize: 14, color: '#92400E', fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 4 }}>
          You&apos;re dipping into your savings
        </Text>
        <Text style={{ fontSize: 13, color: '#92400E', fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 19 }}>
          This is recorded but does not affect your daily budget.
        </Text>
      </View>

      <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 14, marginBottom: 20, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>Using</Text>
          <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_700Bold' }}>৳{Math.floor(amountNum).toLocaleString()}</Text>
        </View>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>Remaining after</Text>
          <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_700Bold' }}>৳{Math.floor(Math.max(0, remainingAfter)).toLocaleString()}</Text>
        </View>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>That&apos;s</Text>
          <Text style={{ fontSize: 13, color: colors.warning, fontFamily: 'PlusJakartaSans_700Bold' }}>{pct}% of your savings</Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Pressable
          onPress={onConfirm}
          disabled={saving}
          style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: colors.warning }}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Yes, I used this ✓</Text>
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
