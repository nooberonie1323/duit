import { useThemeColors } from '@/contexts/theme';
import { AddLoanModal } from '@/components/loans/AddLoanModal';
import { LoanDetailBorrowedModal } from '@/components/loans/LoanDetailBorrowedModal';
import { LoanDetailLentModal } from '@/components/loans/LoanDetailLentModal';
import { getActiveCycle } from '@/services/cycleService';
import {
  getLoanReceipts,
  getLoanRepaymentRecords,
  getLoans,
  type LoanReceiptRow,
  type LoanRepaymentRecordRow,
  type LoanWithComputed,
} from '@/services/loanService';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoansScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const db = useSQLiteContext();

  const [loans, setLoans] = useState<LoanWithComputed[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCycleId, setActiveCycleId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);

  // Lent detail modal
  const [selectedLent, setSelectedLent] = useState<LoanWithComputed | null>(null);
  const [lentReceipts, setLentReceipts] = useState<LoanReceiptRow[]>([]);

  // Borrowed detail modal
  const [selectedBorrowed, setSelectedBorrowed] = useState<LoanWithComputed | null>(null);
  const [borrowedRecords, setBorrowedRecords] = useState<LoanRepaymentRecordRow[]>([]);

  const load = useCallback(async () => {
    try {
      const [allLoans, cycleData] = await Promise.all([
        getLoans(db),
        getActiveCycle(db),
      ]);
      setLoans(allLoans);
      setActiveCycleId(cycleData?.cycle.id ?? null);
    } catch (e) {
      console.error('[LoansScreen load]', e);
      setErrorMsg('Failed to load loans.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state === 'active') load(); });
    return () => sub.remove();
  }, [load]);

  async function openLent(loan: LoanWithComputed) {
    try {
      const receipts = await getLoanReceipts(db, loan.id);
      setLentReceipts(receipts);
      setSelectedLent(loan);
    } catch (e) {
      console.error('[LoansScreen openLent]', e);
      setErrorMsg('Failed to load loan details.');
    }
  }

  async function refreshLentModal() {
    if (!selectedLent) return;
    try {
      const [allLoans, receipts] = await Promise.all([
        getLoans(db),
        getLoanReceipts(db, selectedLent.id),
      ]);
      setLoans(allLoans);
      setLentReceipts(receipts);
      const updated = allLoans.find(l => l.id === selectedLent.id);
      if (updated) setSelectedLent(updated);
    } catch (e) {
      console.error('[LoansScreen refreshLentModal]', e);
    }
  }

  async function openBorrowed(loan: LoanWithComputed) {
    try {
      const records = await getLoanRepaymentRecords(db, loan.id);
      setBorrowedRecords(records);
      setSelectedBorrowed(loan);
    } catch (e) {
      console.error('[LoansScreen openBorrowed]', e);
      setErrorMsg('Failed to load loan details.');
    }
  }

  const lentLoans = loans.filter(l => l.type === 'lent');
  const borrowedLoans = loans.filter(l => l.type === 'borrowed');
  const hasAnyLoan = loans.length > 0;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const navPillOffset = Math.max(insets.bottom, 16) + 76;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -0.5 }}>
          Loans
        </Text>
      </View>

      {errorMsg ? (
        <View style={{ marginHorizontal: 20, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <Text style={{ fontSize: 13, color: colors.error, fontFamily: 'PlusJakartaSans_500Medium' }}>{errorMsg}</Text>
        </View>
      ) : null}

      {!hasAnyLoan ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: navPillOffset }}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>💸</Text>
          <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary, marginBottom: 6, textAlign: 'center' }}>
            No loans tracked yet
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', lineHeight: 20 }}>
            Tap + to record money you gave or received.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: navPillOffset + 24 }}
        >
          {lentLoans.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={sectionLabel(colors)}>I Lent</Text>
              {lentLoans.map(loan => (
                <LoanCard key={loan.id} loan={loan} onPress={() => openLent(loan)} colors={colors} />
              ))}
            </View>
          )}

          {borrowedLoans.length > 0 && (
            <View>
              <Text style={sectionLabel(colors)}>I Borrowed</Text>
              {borrowedLoans.map(loan => (
                <LoanCard key={loan.id} loan={loan} onPress={() => openBorrowed(loan)} colors={colors} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <Pressable
        onPress={() => setShowAdd(true)}
        style={{
          position: 'absolute',
          bottom: navPillOffset + 16,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Text style={{ fontSize: 28, color: '#fff', lineHeight: 32, includeFontPadding: false }}>+</Text>
      </Pressable>

      <AddLoanModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => { setShowAdd(false); load(); }}
        db={db}
      />

      <LoanDetailLentModal
        loan={selectedLent}
        receipts={lentReceipts}
        activeCycleId={activeCycleId}
        onClose={() => setSelectedLent(null)}
        onMutated={() => { setSelectedLent(null); load(); }}
        onResolvedPending={refreshLentModal}
        db={db}
      />

      <LoanDetailBorrowedModal
        loan={selectedBorrowed}
        repaymentRecords={borrowedRecords}
        onClose={() => setSelectedBorrowed(null)}
        onMutated={() => { setSelectedBorrowed(null); load(); }}
        db={db}
      />
    </View>
  );
}

function LoanCard({
  loan, onPress, colors,
}: {
  loan: LoanWithComputed;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const isSettled = loan.status === 'settled';
  const plan = loan.repayment_plan;
  const progressPct = plan && plan.total_months > 0
    ? Math.min(1, loan.months_paid / plan.total_months)
    : null;
  const remaining = loan.original_amount - loan.amount_returned;

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary }}>
              {loan.person_name}
            </Text>
            {loan.has_pending_receipt && (
              <View style={{ backgroundColor: colors.warning, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Pending</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
            {new Date(loan.loaned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: isSettled ? colors.textSecondary : colors.textPrimary }}>
            ৳{Math.floor(loan.original_amount).toLocaleString()}
          </Text>
          {isSettled ? (
            <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold', marginTop: 2 }}>✓ settled</Text>
          ) : plan ? (
            <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
              {loan.months_paid}/{plan.total_months} paid
            </Text>
          ) : remaining < loan.original_amount ? (
            <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
              ৳{Math.floor(remaining).toLocaleString()} left
            </Text>
          ) : (
            <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>active</Text>
          )}
        </View>
      </View>

      {progressPct !== null && !isSettled && (
        <View style={{ marginTop: 10 }}>
          <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ height: 4, width: `${progressPct * 100}%`, backgroundColor: colors.primary, borderRadius: 2 }} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

function sectionLabel(colors: ReturnType<typeof useThemeColors>) {
  return {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold' as const,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    marginLeft: 4,
  };
}
