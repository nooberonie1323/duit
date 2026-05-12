import { toDateStr } from '@/lib/db';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface CycleRow {
  id: number;
  start_date: string;
  end_date: string;
  income: number;
  already_spent: number;
  savings: number;
  budget_alert: number;
  start_from_today: number;
  pool_leftover: number;
  created_at: string;
}

export interface ReservationRow {
  id: number;
  cycle_id: number;
  name: string;
  amount: number;
}

export interface CreateCycleInput {
  startDate: Date;
  endDate: Date;
  income: number;
  alreadySpent: number;
  savings: number;
  budgetAlert: number;
  startFromToday: boolean;
  reservations: Array<{ name: string; amount: number }>;
}

export interface ActiveCycleData {
  cycle: CycleRow;
  reservations: ReservationRow[];
  pool: number;
  reservationsTotal: number;
  dailyBudget: number;
  daysLeft: number;
  dayOfCycle: number;
  totalDays: number;
  leftInCycle: number;
}

export async function createCycle(db: SQLiteDatabase, input: CreateCycleInput): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO cycles (start_date, end_date, income, already_spent, savings, budget_alert, start_from_today)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      toDateStr(input.startDate),
      toDateStr(input.endDate),
      input.income,
      input.alreadySpent,
      input.savings,
      input.budgetAlert,
      input.startFromToday ? 1 : 0,
    ]
  );

  const cycleId = result.lastInsertRowId;

  for (const r of input.reservations) {
    await db.runAsync(
      'INSERT INTO reservations (cycle_id, name, amount) VALUES (?, ?, ?)',
      [cycleId, r.name, r.amount]
    );
  }

  return cycleId;
}

export async function getActiveCycle(db: SQLiteDatabase): Promise<ActiveCycleData | null> {
  const cycle = await db.getFirstAsync<CycleRow>(
    'SELECT * FROM cycles ORDER BY id DESC LIMIT 1'
  );
  if (!cycle) return null;

  const reservations = await db.getAllAsync<ReservationRow>(
    'SELECT * FROM reservations WHERE cycle_id = ?',
    [cycle.id]
  );

  const reservationsTotal = reservations.reduce((s, r) => s + r.amount, 0);
  const pool = cycle.income - cycle.already_spent + cycle.pool_leftover;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(`${cycle.end_date}T12:00:00`);
  endDate.setHours(0, 0, 0, 0);
  const startDate = new Date(`${cycle.start_date}T12:00:00`);
  startDate.setHours(0, 0, 0, 0);

  const msPerDay = 86400000;
  const daysAfterToday = Math.max(0, Math.round((endDate.getTime() - today.getTime()) / msPerDay));
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay);
  const dayOfCycle = Math.round((today.getTime() - startDate.getTime()) / msPerDay) + 1;

  // Check if there's a reviewed day — if so, use pool_after_review for remaining calc
  const lastReview = await db.getFirstAsync<{ pool_after_review: number; date: string }>(
    'SELECT pool_after_review, date FROM days WHERE cycle_id = ? AND reviewed_at IS NOT NULL ORDER BY date DESC LIMIT 1',
    [cycle.id]
  );

  let dailyBudget: number;
  let leftInCycle: number;

  if (lastReview && lastReview.pool_after_review !== null) {
    const divisor = daysAfterToday > 0 ? daysAfterToday : 1;
    dailyBudget = lastReview.pool_after_review / divisor;
    leftInCycle = lastReview.pool_after_review;
  } else {
    const divisor = cycle.start_from_today ? daysAfterToday + 1 : daysAfterToday;
    const effectiveDivisor = divisor > 0 ? divisor : 1;
    dailyBudget = (pool - cycle.savings - reservationsTotal) / effectiveDivisor;
    leftInCycle = pool - cycle.savings - reservationsTotal;
  }

  return {
    cycle,
    reservations,
    pool,
    reservationsTotal,
    dailyBudget,
    daysLeft: daysAfterToday,
    dayOfCycle: Math.max(1, dayOfCycle),
    totalDays: totalDays + 1,
    leftInCycle,
  };
}

export async function getCycleTotalSpent(db: SQLiteDatabase, cycleId: number): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(e.amount), 0) as total
     FROM entries e JOIN days d ON e.day_id = d.id
     WHERE d.cycle_id = ?`,
    [cycleId]
  );
  return row?.total ?? 0;
}
