import { type SQLiteDatabase } from 'expo-sqlite';

export interface Cycle {
  id: number;
  start_date: string;
  end_date: string;
  income: number;
  budget_alert: number;
  savings_amount: number;
  already_spent: number;
  starts_from: 'today' | 'tomorrow';
  pool_carryover: number;
  pool_balance: number;
  savings_balance: number;
  status: 'active' | 'ended' | 'waiting';
  created_at: string;
}

export interface CreateCycleInput {
  start_date: string;
  end_date: string;
  income: number;
  budget_alert?: number;
  savings_amount?: number;
  already_spent?: number;
  starts_from?: 'today' | 'tomorrow';
  pool_carryover?: number;
  pool_balance: number;
  savings_balance: number;
}

export async function getActiveCycle(db: SQLiteDatabase): Promise<Cycle | null> {
  return db.getFirstAsync<Cycle>(
    "SELECT * FROM cycles WHERE status = 'active' ORDER BY id DESC LIMIT 1"
  );
}

export async function getCycleById(db: SQLiteDatabase, id: number): Promise<Cycle | null> {
  return db.getFirstAsync<Cycle>('SELECT * FROM cycles WHERE id = ?', [id]);
}

export async function getAllCycles(db: SQLiteDatabase): Promise<Cycle[]> {
  return db.getAllAsync<Cycle>('SELECT * FROM cycles ORDER BY id DESC');
}

export async function createCycle(
  db: SQLiteDatabase,
  input: CreateCycleInput
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO cycles (
      start_date, end_date, income, budget_alert, savings_amount,
      already_spent, starts_from, pool_carryover, pool_balance,
      savings_balance, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [
      input.start_date,
      input.end_date,
      input.income,
      input.budget_alert ?? 0,
      input.savings_amount ?? 0,
      input.already_spent ?? 0,
      input.starts_from ?? 'today',
      input.pool_carryover ?? 0,
      input.pool_balance,
      input.savings_balance,
      new Date().toISOString(),
    ]
  );
  return result.lastInsertRowId;
}

export async function updatePoolBalance(
  db: SQLiteDatabase,
  cycleId: number,
  newBalance: number
): Promise<void> {
  await db.runAsync('UPDATE cycles SET pool_balance = ? WHERE id = ?', [newBalance, cycleId]);
}

export async function updateSavingsBalance(
  db: SQLiteDatabase,
  cycleId: number,
  newBalance: number
): Promise<void> {
  await db.runAsync('UPDATE cycles SET savings_balance = ? WHERE id = ?', [newBalance, cycleId]);
}

export async function updateCycleStatus(
  db: SQLiteDatabase,
  cycleId: number,
  status: 'active' | 'ended' | 'waiting'
): Promise<void> {
  await db.runAsync('UPDATE cycles SET status = ? WHERE id = ?', [status, cycleId]);
}
