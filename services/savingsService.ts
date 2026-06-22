import type { SQLiteDatabase } from 'expo-sqlite';

export interface SavingsWithdrawalRow {
  id: number;
  cycle_id: number;
  amount: number;
  note: string | null;
  created_at: string;
}

export async function getSavingsWithdrawals(
  db: SQLiteDatabase,
  cycleId: number
): Promise<SavingsWithdrawalRow[]> {
  return db.getAllAsync<SavingsWithdrawalRow>(
    'SELECT * FROM savings_withdrawals WHERE cycle_id = ? ORDER BY id DESC',
    [cycleId]
  );
}

export async function addSavingsWithdrawal(
  db: SQLiteDatabase,
  cycleId: number,
  amount: number,
  note: string
): Promise<void> {
  await db.runAsync(
    'INSERT INTO savings_withdrawals (cycle_id, amount, note) VALUES (?, ?, ?)',
    [cycleId, amount, note.trim() || null]
  );
}
