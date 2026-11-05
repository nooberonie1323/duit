import { getSavingsBalance } from '@/services/savingsService';
import { toDateStr } from '@/lib/db';
import type { SQLiteDatabase } from 'expo-sqlite';

export type CloseItemType = 'pool' | 'reservation' | 'savings';
export type CarryoverDestination = 'pool' | 'savings' | 'reservation' | 'spent';

export interface CloseReservationLeftover {
  reservationId: number;
  name: string;
  amount: number;
}

export interface CloseCycleData {
  cycleId: number;
  startDate: string;
  endDate: string;
  poolLeftover: number;
  reservations: CloseReservationLeftover[];
  reservationsLeftover: number;
  savingsRemaining: number;
}

export interface CarryoverChoiceInput {
  itemType: CloseItemType;
  sourceReservationId: number | null;
  sourceName: string | null;
  amount: number;
  destination: CarryoverDestination;
  targetReservationName: string | null;
}

export interface SavedCarryoverChoice {
  item_type: CloseItemType;
  source_reservation_id: number | null;
  source_name: string | null;
  amount: number;
  destination: CarryoverDestination;
  target_reservation_name: string | null;
}

export interface SavedClosePlan {
  id: number;
  choices: SavedCarryoverChoice[];
}

// Matches the default length used by the new-cycle form (inclusive 30 days).
const DEFAULT_CYCLE_LENGTH_DAYS = 29;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeReservationName(name: string): string {
  return name.trim().toLowerCase();
}

export async function getCloseCycleData(
  db: SQLiteDatabase
): Promise<CloseCycleData | null> {
  const cycle = await db.getFirstAsync<{
    id: number;
    start_date: string;
    end_date: string;
    income: number;
    already_spent: number;
    savings: number;
    pool_leftover: number;
  }>(
    `SELECT id, start_date, end_date, income, already_spent, savings, pool_leftover
     FROM cycles ORDER BY id DESC LIMIT 1`
  );
  if (!cycle) return null;

  const lastReview = await db.getFirstAsync<{ pool_after_review: number | null }>(
    `SELECT pool_after_review FROM days
     WHERE cycle_id = ? AND reviewed_at IS NOT NULL AND pool_after_review IS NOT NULL
     ORDER BY date DESC LIMIT 1`,
    [cycle.id]
  );

  const reservationRows = await db.getAllAsync<{
    id: number;
    name: string;
    amount: number;
    spent: number;
    released: number;
    is_auto_loan: number;
  }>(
    `SELECT r.id, r.name, r.amount,
            COALESCE(SUM(CASE WHEN rt.type = 'spend' THEN rt.amount ELSE 0 END), 0) as spent,
            COALESCE(SUM(CASE WHEN rt.type = 'release' THEN rt.amount ELSE 0 END), 0) as released,
            CASE WHEN EXISTS (
              SELECT 1 FROM loan_repayment_records lrr WHERE lrr.reservation_id = r.id
            ) THEN 1 ELSE 0 END as is_auto_loan
     FROM reservations r
     LEFT JOIN reservation_transactions rt ON rt.reservation_id = r.id
     WHERE r.cycle_id = ?
     GROUP BY r.id
     ORDER BY r.id ASC`,
    [cycle.id]
  );

  // Auto loan-repayment reservations are rebuilt by the loan plan in the next
  // cycle, so they are not offered as leftovers. Any unused amount goes back to
  // the pool instead of disappearing.
  const autoLoanLeftover = reservationRows
    .filter(row => row.is_auto_loan === 1)
    .reduce((sum, row) => sum + Math.max(0, row.amount - row.spent - row.released), 0);

  const reservations = reservationRows
    .filter(row => row.is_auto_loan === 0)
    .map(row => ({
      reservationId: row.id,
      name: row.name,
      amount: Math.max(0, row.amount - row.spent - row.released),
    }))
    .filter(row => row.amount > 0);

  const savingsRemaining = Math.max(0, await getSavingsBalance(db));

  // Closing forces every day to be reviewed, so the last review holds the final pool.
  let poolLeftover = Math.max(0, lastReview?.pool_after_review ?? 0);
  if (!lastReview) {
    // No review has ever been confirmed: fall back to the full cycle maths.
    const spentRow = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(e.amount), 0) as total
       FROM entries e JOIN days d ON e.day_id = d.id
       WHERE d.cycle_id = ?`,
      [cycle.id]
    );
    const reservationsTotal = reservationRows.reduce(
      (sum, row) => sum + (row.amount - row.released),
      0
    );
    const spendable =
      cycle.income - cycle.already_spent + cycle.pool_leftover - cycle.savings - reservationsTotal;
    poolLeftover = Math.max(0, spendable - (spentRow?.total ?? 0));
  }

  // Unused auto loan repayment reservations return to the pool.
  poolLeftover += autoLoanLeftover;

  return {
    cycleId: cycle.id,
    startDate: cycle.start_date,
    endDate: cycle.end_date,
    poolLeftover,
    reservations,
    reservationsLeftover: reservations.reduce((sum, row) => sum + row.amount, 0),
    savingsRemaining,
  };
}

export async function getSavedClosePlan(
  db: SQLiteDatabase,
  sourceCycleId: number
): Promise<SavedClosePlan | null> {
  const plan = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM cycle_plans
     WHERE source_cycle_id = ? AND status IN ('draft', 'pending_confirmation')
     ORDER BY id DESC LIMIT 1`,
    [sourceCycleId]
  );
  if (!plan) return null;

  const choices = await db.getAllAsync<SavedCarryoverChoice>(
    `SELECT item_type, source_reservation_id, source_name, amount, destination, target_reservation_name
     FROM carryover_choices WHERE plan_id = ? ORDER BY id ASC`,
    [plan.id]
  );
  return { id: plan.id, choices };
}

export async function saveClosePlan(
  db: SQLiteDatabase,
  sourceCycleId: number,
  choices: CarryoverChoiceInput[]
): Promise<number> {
  for (const choice of choices) {
    if (!Number.isFinite(choice.amount) || choice.amount < 0) {
      throw new Error('Carryover amount must be a positive number');
    }
    if (choice.destination === 'reservation' && !choice.targetReservationName?.trim()) {
      throw new Error('A reservation destination needs a name');
    }
  }

  const destinationReservations = choices.filter(
    choice => choice.destination === 'reservation'
  );

  const reservationsByName = new Map<
    string,
    { name: string; amount: number; sourceReservationId: number | null }
  >();
  for (const choice of destinationReservations) {
    const name = choice.targetReservationName!.trim();
    const key = normalizeReservationName(name);
    const existing = reservationsByName.get(key);
    if (existing) {
      existing.amount += choice.amount;
    } else {
      reservationsByName.set(key, {
        name,
        amount: choice.amount,
        sourceReservationId: choice.sourceReservationId,
      });
    }
  }

  const carryPool = choices
    .filter(choice => choice.destination === 'pool')
    .reduce((sum, choice) => sum + choice.amount, 0);
  const carrySavings = choices
    .filter(choice => choice.destination === 'savings')
    .reduce((sum, choice) => sum + choice.amount, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = toDateStr(today);
  const endDate = toDateStr(addDays(today, DEFAULT_CYCLE_LENGTH_DAYS));

  let planId = 0;
  await db.execAsync('BEGIN');
  try {
    await db.runAsync(
      `DELETE FROM cycle_plans
       WHERE source_cycle_id = ? AND status IN ('draft', 'pending_confirmation')`,
      [sourceCycleId]
    );

    const planResult = await db.runAsync(
      `INSERT INTO cycle_plans
         (status, source_cycle_id, start_date, end_date, income, already_spent,
          savings_contribution, budget_alert, carry_pool, carry_savings)
       VALUES ('draft', ?, ?, ?, 0, 0, 0, 0, ?, ?)`,
      [sourceCycleId, startDate, endDate, carryPool, carrySavings]
    );
    planId = planResult.lastInsertRowId;

    for (const choice of choices) {
      await db.runAsync(
        `INSERT INTO carryover_choices
           (plan_id, source_cycle_id, item_type, source_reservation_id, source_name,
            amount, destination, target_reservation_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          planId,
          sourceCycleId,
          choice.itemType,
          choice.sourceReservationId,
          choice.sourceName,
          choice.amount,
          choice.destination,
          choice.targetReservationName,
        ]
      );
    }

    for (const merged of reservationsByName.values()) {
      const mergedChoiceCount = destinationReservations.filter(
        choice =>
          normalizeReservationName(choice.targetReservationName ?? '') ===
          normalizeReservationName(merged.name)
      ).length;
      await db.runAsync(
        `INSERT INTO cycle_plan_reservations
           (plan_id, name, amount, is_carried, source_reservation_id)
         VALUES (?, ?, ?, 1, ?)`,
        [
          planId,
          merged.name,
          merged.amount,
          mergedChoiceCount === 1 ? merged.sourceReservationId : null,
        ]
      );
    }

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }

  return planId;
}
