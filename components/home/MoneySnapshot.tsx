import { useThemeColors } from '@/contexts/theme';
import type { ReservationRow } from '@/services/cycleService';
import { Text, View } from 'react-native';

interface Props {
  /** Already clamped at 0 by the caller. */
  poolLeft: number;
  savingsBalance: number;
  reservations: ReservationRow[];
  /** Omit or pass null to hide the "Daily budget after" row. */
  dailyBudgetAfter?: number | null;
}

function money(value: number): string {
  return `৳${Math.floor(value).toLocaleString()}`;
}

function remainingOf(reservation: ReservationRow): number {
  return Math.max(0, reservation.amount - reservation.spent - reservation.released);
}

export function MoneySnapshot({ poolLeft, savingsBalance, reservations, dailyBudgetAfter }: Props) {
  const colors = useThemeColors();

  const reservationRows = reservations
    .map(reservation => ({ reservation, remaining: remainingOf(reservation) }))
    .filter(row => row.remaining > 0);
  const reservationsTotal = reservationRows.reduce((sum, row) => sum + row.remaining, 0);
  const grandTotal = poolLeft + savingsBalance + reservationsTotal;
  const hasDailyBudget = typeof dailyBudgetAfter === 'number';

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' }}>
        Where your money stands
      </Text>

      <Text style={{ fontSize: 40, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -1.5, marginTop: 6 }}>
        {money(grandTotal)}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
        Total across everything
      </Text>

      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 14 }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary }}>
          Left to spend
        </Text>
        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary }}>
          {money(poolLeft)}
        </Text>
      </View>

      {savingsBalance > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: colors.textSecondary }}>
            Savings
          </Text>
          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary }}>
            {money(savingsBalance)}
          </Text>
        </View>
      )}

      {reservationRows.map(({ reservation, remaining }) => (
        <View
          key={reservation.id}
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}
        >
          <Text style={{ flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: colors.textSecondary }} numberOfLines={1}>
            {reservation.name} (reserved)
          </Text>
          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary }}>
            {money(remaining)}
          </Text>
        </View>
      ))}

      {hasDailyBudget && (
        <>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 14 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>
              Daily budget after
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textPrimary }}>
              {money(dailyBudgetAfter as number)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
