import type { Reservation } from '@/services/reservationService';
import { calcNewDailyBudget } from './budgetCalc';

/**
 * Hard cap check: reject the spend if the amount exceeds
 * pool + savings + all reservation balances combined.
 *
 * Returns true if the spend is BLOCKED (exceeds hard cap).
 */
export function hardCapCheck(
  amount: number,
  poolBalance: number,
  savingsBalance: number,
  reservations: Reservation[]
): boolean {
  const totalReservations = reservations.reduce((sum, r) => sum + r.current_balance, 0);
  const maxSpendable = poolBalance + savingsBalance + totalReservations;
  return amount > maxSpendable;
}

/**
 * Threshold check: would this spend drop the new daily budget below budget_alert?
 *
 * Returns true if the threshold IS triggered (modal should be shown).
 * Returns false if:
 *   - budget_alert is 0 (disabled)
 *   - daysAfterToday is 0 (last day — no future budget to protect)
 *   - the new daily budget would still be at or above budget_alert
 */
export function thresholdCheck(
  amount: number,
  poolBalance: number,
  daysAfterToday: number,
  budgetAlert: number
): boolean {
  if (budgetAlert <= 0) return false;
  if (daysAfterToday <= 0) return false;
  const newDailyBudget = calcNewDailyBudget(poolBalance - amount, daysAfterToday);
  return newDailyBudget < budgetAlert;
}
