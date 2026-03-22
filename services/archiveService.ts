import { type SQLiteDatabase } from 'expo-sqlite';

export interface ArchivedSaving {
  id: number;
  from_cycle_id: number;
  amount: number;
  archived_at: string;
}

export interface ArchiveWithdrawal {
  id: number;
  amount: number;
  destination: 'pool' | 'reservation' | 'expense';
  cycle_id: number;
  created_at: string;
}

export async function getArchiveBalance(db: SQLiteDatabase): Promise<number> {
  const saved = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM archived_savings'
  );
  const withdrawn = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM archive_withdrawals'
  );
  return (saved?.total ?? 0) - (withdrawn?.total ?? 0);
}

export async function getArchivedSavings(db: SQLiteDatabase): Promise<ArchivedSaving[]> {
  return db.getAllAsync<ArchivedSaving>(
    'SELECT * FROM archived_savings ORDER BY archived_at DESC'
  );
}

export async function createArchiveEntry(
  db: SQLiteDatabase,
  fromCycleId: number,
  amount: number
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO archived_savings (from_cycle_id, amount, archived_at) VALUES (?, ?, ?)',
    [fromCycleId, amount, new Date().toISOString()]
  );
  return result.lastInsertRowId;
}

export async function createWithdrawal(
  db: SQLiteDatabase,
  amount: number,
  destination: 'pool' | 'reservation' | 'expense',
  cycleId: number
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO archive_withdrawals (amount, destination, cycle_id, created_at) VALUES (?, ?, ?, ?)',
    [amount, destination, cycleId, new Date().toISOString()]
  );
  return result.lastInsertRowId;
}
