import type { Cycle } from '@/services/cycleService';

/**
 * Count the number of calendar days from today up to and including endDate.
 * Returns 0 if endDate is in the past.
 */
export function calcDaysRemaining(endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const diff = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff + 1); // +1 because today itself counts
}

/**
 * The main daily budget formula.
 *
 * numerator = income + pool_carryover − already_spent − savings_amount − sum(reservation original_amounts)
 * denominator:
 *   starts_from = 'today'     → daysRemaining + 1
 *   starts_from = 'tomorrow'  → daysRemaining
 *
 * daysRemaining here is the count of days AFTER today (i.e. calcDaysRemaining - 1
 * if calling at cycle-start, or whatever is appropriate at the time of the call).
 *
 * Returns 0 if denominator is 0 to avoid divide-by-zero.
 */
export function calcDailyBudget(cycle: Cycle, daysRemaining: number): number {
  const denominator =
    cycle.starts_from === 'today' ? daysRemaining + 1 : daysRemaining;
  if (denominator <= 0) return 0;
  return cycle.pool_balance / denominator;
}

/**
 * Used for threshold checks: what would the new daily budget be after a spend,
 * given the pool balance and how many days remain after today.
 */
export function calcNewDailyBudget(poolBalance: number, daysAfterToday: number): number {
  if (daysAfterToday <= 0) return 0;
  return poolBalance / daysAfterToday;
}

/**
 * The hero number shown on the home screen.
 * dailyBudget − sum of all staged (and committed) spend amounts for today.
 */
export function calcLeftToday(dailyBudget: number, totalSpentToday: number): number {
  return dailyBudget - totalSpentToday;
}
