import { type SQLiteDatabase } from 'expo-sqlite';

export interface SpendEntry {
  id: number;
  cycle_id: number;
  day_date: string;
  amount: number;
  note: string | null;
  entry_time: string;
  is_staged: number;
  created_at: string;
  committed_at: string | null;
}

export async function createStagedSpend(
  db: SQLiteDatabase,
  cycleId: number,
  dayDate: string,
  amount: number,
  note: string | null,
  entryTime: string
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO spend_entries (cycle_id, day_date, amount, note, entry_time, is_staged, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [cycleId, dayDate, amount, note ?? null, entryTime, new Date().toISOString()]
  );
  return result.lastInsertRowId;
}

export async function deleteStagedSpend(db: SQLiteDatabase, spendId: number): Promise<void> {
  // Caller is responsible for reversing modal_pulls before calling this
  await db.runAsync('DELETE FROM spend_entries WHERE id = ? AND is_staged = 1', [spendId]);
}

export async function getStagedSpends(
  db: SQLiteDatabase,
  cycleId: number,
  dayDate: string
): Promise<SpendEntry[]> {
  return db.getAllAsync<SpendEntry>(
    'SELECT * FROM spend_entries WHERE cycle_id = ? AND day_date = ? AND is_staged = 1 ORDER BY created_at ASC',
    [cycleId, dayDate]
  );
}

export async function getAllStagedSpends(
  db: SQLiteDatabase,
  cycleId: number
): Promise<SpendEntry[]> {
  return db.getAllAsync<SpendEntry>(
    'SELECT * FROM spend_entries WHERE cycle_id = ? AND is_staged = 1 ORDER BY day_date ASC, created_at ASC',
    [cycleId]
  );
}

export async function commitSpends(
  db: SQLiteDatabase,
  cycleId: number,
  dayDate: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE spend_entries SET is_staged = 0, committed_at = ? WHERE cycle_id = ? AND day_date = ? AND is_staged = 1',
    [now, cycleId, dayDate]
  );
}

export async function updateSpendEntry(
  db: SQLiteDatabase,
  spendId: number,
  amount: number,
  note: string | null,
  entryTime: string
): Promise<void> {
  await db.runAsync(
    'UPDATE spend_entries SET amount = ?, note = ?, entry_time = ? WHERE id = ?',
    [amount, note ?? null, entryTime, spendId]
  );
}

export async function getCommittedSpends(
  db: SQLiteDatabase,
  cycleId: number,
  dayDate: string
): Promise<SpendEntry[]> {
  return db.getAllAsync<SpendEntry>(
    'SELECT * FROM spend_entries WHERE cycle_id = ? AND day_date = ? AND is_staged = 0 ORDER BY entry_time ASC',
    [cycleId, dayDate]
  );
}
