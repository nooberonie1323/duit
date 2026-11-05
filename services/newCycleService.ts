import { toDateStr } from '@/lib/db';
import { getSavingsBalance } from '@/services/savingsService';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface PlanReservation {
  name: string;
  amount: number;
  isCarried: boolean;
}

export interface EditableCyclePlan {
  id: number;
  status: 'draft' | 'pending_confirmation';
  sourceCycleId: number | null;
  startDate: string;
  endDate: string;
  income: number;
  alreadySpent: number;
  savingsContribution: number;
  budgetAlert: number;
  carryPool: number;
  carrySavings: number;
  carryReservations: number;
  reservations: PlanReservation[];
}

export interface NewCycleFormInput {
  startDate: string;
  endDate: string;
  income: number;
  alreadySpent: number;
  savingsContribution: number;
  budgetAlert: number;
  reservations: PlanReservation[];
}

export interface OpenCyclePlan {
  id: number;
  status: 'draft' | 'pending_confirmation';
  startDate: string;
  endDate: string;
  carryPool: number;
  carrySavings: number;
}

interface PlanRow {
  id: number;
  status: 'draft' | 'pending_confirmation' | 'applied' | 'abandoned';
  source_cycle_id: number | null;
  start_date: string;
  end_date: string;
  income: number;
  already_spent: number;
  savings_contribution: number;
  budget_alert: number;
}

interface PlanChoiceRow {
  item_type: 'pool' | 'reservation' | 'savings';
  source_reservation_id: number | null;
  amount: number;
  destination: 'pool' | 'savings' | 'reservation' | 'spent';
}

const MONEY_EPSILON = 0.005;

function assertValidMoney(amount: number, label: string): void {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label} must be a valid amount`);
  }
}

function sumChoices(choices: PlanChoiceRow[], destination: PlanChoiceRow['destination']): number {
  return choices
    .filter(choice => choice.destination === destination)
    .reduce((sum, choice) => sum + choice.amount, 0);
}

async function loadChoices(db: SQLiteDatabase, planId: number): Promise<PlanChoiceRow[]> {
  return db.getAllAsync<PlanChoiceRow>(
    `SELECT item_type, source_reservation_id, amount, destination
     FROM carryover_choices WHERE plan_id = ?`,
    [planId]
  );
}

export async function getEditablePlan(
  db: SQLiteDatabase,
  planId?: number
): Promise<EditableCyclePlan | null> {
  const plan = planId
    ? await db.getFirstAsync<PlanRow>(
        `SELECT id, status, source_cycle_id, start_date, end_date, income,
                already_spent, savings_contribution, budget_alert
         FROM cycle_plans WHERE id = ? AND status IN ('draft', 'pending_confirmation')`,
        [planId]
      )
    : await db.getFirstAsync<PlanRow>(
        `SELECT id, status, source_cycle_id, start_date, end_date, income,
                already_spent, savings_contribution, budget_alert
         FROM cycle_plans WHERE status IN ('draft', 'pending_confirmation')
         ORDER BY id DESC LIMIT 1`
      );
  if (!plan) return null;

  const [choices, reservationRows] = await Promise.all([
    loadChoices(db, plan.id),
    db.getAllAsync<{ name: string; amount: number; is_carried: number }>(
      `SELECT name, amount, is_carried FROM cycle_plan_reservations
       WHERE plan_id = ? ORDER BY id ASC`,
      [plan.id]
    ),
  ]);

  return {
    id: plan.id,
    status: plan.status as 'draft' | 'pending_confirmation',
    sourceCycleId: plan.source_cycle_id,
    startDate: plan.start_date,
    endDate: plan.end_date,
    income: plan.income,
    alreadySpent: plan.already_spent,
    savingsContribution: plan.savings_contribution,
    budgetAlert: plan.budget_alert,
    carryPool: sumChoices(choices, 'pool'),
    carrySavings: sumChoices(choices, 'savings'),
    carryReservations: sumChoices(choices, 'reservation'),
    reservations: reservationRows.map(row => ({
      name: row.name,
      amount: row.amount,
      isCarried: row.is_carried === 1,
    })),
  };
}

export async function getOpenCyclePlan(
  db: SQLiteDatabase
): Promise<OpenCyclePlan | null> {
  const plan = await db.getFirstAsync<{
    id: number;
    status: 'draft' | 'pending_confirmation';
    start_date: string;
    end_date: string;
    carry_pool: number;
    carry_savings: number;
  }>(
    `SELECT id, status, start_date, end_date, carry_pool, carry_savings
     FROM cycle_plans WHERE status IN ('draft', 'pending_confirmation')
     ORDER BY id DESC LIMIT 1`
  );
  if (!plan) return null;
  return {
    id: plan.id,
    status: plan.status,
    startDate: plan.start_date,
    endDate: plan.end_date,
    carryPool: plan.carry_pool,
    carrySavings: plan.carry_savings,
  };
}

function validateForm(input: NewCycleFormInput, startDate: string): void {
  if (!Number.isFinite(input.income) || input.income <= 0) {
    throw new Error('Enter a valid income amount');
  }
  assertValidMoney(input.alreadySpent, 'Already spent');
  assertValidMoney(input.savingsContribution, 'Savings contribution');
  assertValidMoney(input.budgetAlert, 'Budget alert');
  if (input.alreadySpent > input.income) {
    throw new Error('Already spent cannot be more than income');
  }
  if (input.endDate <= startDate) {
    throw new Error('Choose an end date after the start date');
  }
  for (const reservation of input.reservations) {
    if (!reservation.name.trim()) {
      throw new Error('Each reservation needs a name');
    }
    assertValidMoney(reservation.amount, `Reservation "${reservation.name.trim()}"`);
  }
  const names = input.reservations.map(reservation =>
    reservation.name.trim().toLowerCase()
  );
  if (new Set(names).size !== names.length) {
    throw new Error('Two reservations share a name — merge or rename them');
  }
}

export async function savePendingPlan(
  db: SQLiteDatabase,
  planId: number,
  input: NewCycleFormInput
): Promise<void> {
  const plan = await db.getFirstAsync<PlanRow & { source_cycle_id: number | null }>(
    `SELECT id, status, source_cycle_id, start_date, end_date, income,
            already_spent, savings_contribution, budget_alert
     FROM cycle_plans WHERE id = ?`,
    [planId]
  );
  if (!plan) throw new Error('This plan no longer exists');
  if (plan.status === 'pending_confirmation' && plan.start_date <= toDateStr(new Date())) {
    // On or after the planned start, the user must confirm instead of waiting again.
    validateForm(input, toDateStr(new Date()));
  } else {
    validateForm(input, input.startDate);
  }

  await db.execAsync('BEGIN');
  try {
    await db.runAsync(
      `UPDATE cycle_plans
       SET status = 'pending_confirmation', start_date = ?, end_date = ?, income = ?,
           already_spent = ?, savings_contribution = ?, budget_alert = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [
        input.startDate,
        input.endDate,
        input.income,
        input.alreadySpent,
        input.savingsContribution,
        input.budgetAlert,
        planId,
      ]
    );
    await db.runAsync(
      'DELETE FROM cycle_plan_reservations WHERE plan_id = ?',
      [planId]
    );
    for (const reservation of input.reservations) {
      await db.runAsync(
        `INSERT INTO cycle_plan_reservations (plan_id, name, amount, is_carried)
         VALUES (?, ?, ?, ?)`,
        [planId, reservation.name.trim(), reservation.amount, reservation.isCarried ? 1 : 0]
      );
    }
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

export async function applyPlan(
  db: SQLiteDatabase,
  planId: number,
  input: NewCycleFormInput
): Promise<number> {
  const todayStr = toDateStr(new Date());
  // A late confirmation starts the cycle on the day it is confirmed.
  const effectiveStart = input.startDate <= todayStr ? todayStr : null;
  if (!effectiveStart) {
    throw new Error('This plan is not due to start yet');
  }
  validateForm(input, effectiveStart);

  let cycleId = 0;
  await db.execAsync('BEGIN');
  try {
    const plan = await db.getFirstAsync<PlanRow>(
      `SELECT id, status, source_cycle_id, start_date, end_date, income,
              already_spent, savings_contribution, budget_alert
       FROM cycle_plans WHERE id = ?`,
      [planId]
    );
    if (!plan) throw new Error('This plan no longer exists');
    if (plan.status === 'applied') throw new Error('This plan was already applied');

    const choices = await loadChoices(db, planId);
    const carryPool = sumChoices(choices, 'pool');
    const carrySavings = sumChoices(choices, 'savings');
    const carryReservations = sumChoices(choices, 'reservation');

    const savingsTotal = carrySavings + input.savingsContribution;
    const reservationsTotal = input.reservations.reduce(
      (sum, reservation) => sum + reservation.amount,
      0
    );
    const carriedTotal = carryPool + carrySavings + carryReservations;
    const availableCash = input.income + carriedTotal;
    const pool = availableCash - savingsTotal - reservationsTotal - input.alreadySpent;
    if (pool < -MONEY_EPSILON) {
      throw new Error('Savings and reservations are more than the money available');
    }

    // Move savings by each choice instead of overwriting the balance, so money
    // added between closing and confirming is never lost.
    const savingsMovingIn = choices
      .filter(choice => choice.item_type !== 'savings' && choice.destination === 'savings')
      .reduce((sum, choice) => sum + choice.amount, 0);
    const savingsMovingOut = choices
      .filter(choice => choice.item_type === 'savings' && choice.destination !== 'savings')
      .reduce((sum, choice) => sum + choice.amount, 0);
    const currentSavings = await getSavingsBalance(db);
    const projectedSavings =
      currentSavings + input.savingsContribution + savingsMovingIn - savingsMovingOut;
    if (projectedSavings < -MONEY_EPSILON) {
      throw new Error('Savings balance would go below zero');
    }
    const newSavingsBalance = Math.max(0, projectedSavings);

    const cycleResult = await db.runAsync(
      `INSERT INTO cycles
         (start_date, end_date, income, already_spent, savings, budget_alert,
          start_from_today, pool_leftover, model_version)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, 2)`,
      [
        effectiveStart,
        input.endDate,
        input.income,
        input.alreadySpent,
        savingsTotal,
        input.budgetAlert,
        carriedTotal,
      ]
    );
    cycleId = cycleResult.lastInsertRowId;

    for (const reservation of input.reservations) {
      await db.runAsync(
        'INSERT INTO reservations (cycle_id, name, amount) VALUES (?, ?, ?)',
        [cycleId, reservation.name.trim(), reservation.amount]
      );
    }

    await db.runAsync(
      `INSERT INTO savings_account (id, balance, is_initialized, updated_at)
       VALUES (1, ?, 1, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET balance = excluded.balance, is_initialized = 1, updated_at = datetime('now')`,
      [newSavingsBalance]
    );
    if (input.savingsContribution > 0) {
      await db.runAsync(
        `INSERT INTO savings_ledger (cycle_id, type, amount, note) VALUES (?, 'contribution', ?, ?)`,
        [cycleId, input.savingsContribution, 'Savings added at cycle start']
      );
    }
    for (const choice of choices) {
      if (choice.item_type !== 'savings' && choice.destination === 'savings') {
        await db.runAsync(
          `INSERT INTO savings_ledger (cycle_id, type, amount, note) VALUES (?, 'carry_in', ?, ?)`,
          [cycleId, choice.amount, 'Leftover moved to savings at cycle close']
        );
        continue;
      }
      if (choice.item_type !== 'savings' || choice.destination === 'savings') continue;
      const isSpent = choice.destination === 'spent';
      await db.runAsync(
        `INSERT INTO savings_ledger (cycle_id, type, amount, note) VALUES (?, ?, ?, ?)`,
        [
          plan.source_cycle_id,
          isSpent ? 'spent' : 'carry_out',
          -choice.amount,
          isSpent ? 'Marked as already spent at cycle close' : 'Moved at cycle close',
        ]
      );
    }

    if (plan.source_cycle_id !== null) {
      const poolLeftoverTotal = choices
        .filter(choice => choice.item_type === 'pool')
        .reduce((sum, choice) => sum + choice.amount, 0);
      const reservationsLeftoverTotal = choices
        .filter(choice => choice.item_type === 'reservation')
        .reduce((sum, choice) => sum + choice.amount, 0);
      const savingsLeftoverTotal = choices
        .filter(choice => choice.item_type === 'savings')
        .reduce((sum, choice) => sum + choice.amount, 0);
      const closingResult = await db.runAsync(
        `INSERT OR IGNORE INTO cycle_closings
           (cycle_id, pool_leftover, reservations_leftover, savings_leftover, marked_spent_total)
         VALUES (?, ?, ?, ?, ?)`,
        [
          plan.source_cycle_id,
          poolLeftoverTotal,
          reservationsLeftoverTotal,
          savingsLeftoverTotal,
          choices
            .filter(choice => choice.destination === 'spent')
            .reduce((sum, choice) => sum + choice.amount, 0),
        ]
      );
      let closingId = closingResult.lastInsertRowId;
      if (!closingResult.changes) {
        const existing = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM cycle_closings WHERE cycle_id = ?',
          [plan.source_cycle_id]
        );
        closingId = existing?.id ?? 0;
      }

      for (const choice of choices) {
        if (choice.destination === 'spent' && closingId > 0) {
          await db.runAsync(
            `INSERT INTO cycle_close_spends
               (closing_id, source_type, reservation_id, amount, note)
             VALUES (?, ?, ?, ?, ?)`,
            [
              closingId,
              choice.item_type,
              choice.source_reservation_id,
              choice.amount,
              'Marked as already spent at cycle close',
            ]
          );
        }

        if (choice.item_type === 'savings' && choice.destination !== 'savings') {
          await db.runAsync(
            `INSERT INTO savings_withdrawals (cycle_id, amount, note)
             VALUES (?, ?, ?)`,
            [
              plan.source_cycle_id,
              choice.amount,
              choice.destination === 'spent'
                ? 'Marked as already spent at cycle close'
                : 'Moved at cycle close',
            ]
          );
        }

        if (choice.item_type === 'reservation' && choice.source_reservation_id !== null) {
          await db.runAsync(
            `INSERT INTO reservation_transactions (reservation_id, type, amount, note)
             VALUES (?, ?, ?, ?)`,
            [
              choice.source_reservation_id,
              choice.destination === 'spent' ? 'spend' : 'release',
              choice.amount,
              'Settled at cycle close',
            ]
          );
        }
      }

      // Auto loan-repayment reservations are rebuilt by the loan plan, so the
      // remaining amount is released instead of being carried twice.
      const autoLoanReservations = await db.getAllAsync<{ id: number; remaining: number }>(
        `SELECT r.id as id,
                r.amount - COALESCE(SUM(CASE WHEN rt.type IN ('spend', 'release') THEN rt.amount ELSE 0 END), 0) as remaining
         FROM reservations r
         JOIN loan_repayment_records lrr ON lrr.reservation_id = r.id
         LEFT JOIN reservation_transactions rt ON rt.reservation_id = r.id
         WHERE r.cycle_id = ?
         GROUP BY r.id`,
        [plan.source_cycle_id]
      );
      for (const auto of autoLoanReservations) {
        if (auto.remaining <= MONEY_EPSILON) continue;
        await db.runAsync(
          `INSERT INTO reservation_transactions (reservation_id, type, amount, note)
           VALUES (?, 'release', ?, ?)`,
          [auto.id, auto.remaining, 'Unused loan repayment returned at cycle close']
        );
      }
    }

    await db.runAsync(
      `UPDATE cycle_plans
       SET status = 'applied', start_date = ?, end_date = ?, income = ?,
           already_spent = ?, savings_contribution = ?, budget_alert = ?,
           applied_at = datetime('now'), applied_cycle_id = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        effectiveStart,
        input.endDate,
        input.income,
        input.alreadySpent,
        input.savingsContribution,
        input.budgetAlert,
        cycleId,
        planId,
      ]
    );

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }

  return cycleId;
}
