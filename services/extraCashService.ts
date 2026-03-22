import { type SQLiteDatabase } from 'expo-sqlite';

export interface ExtraCashEntry {
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

export async function createStagedExtraCash(
  db: SQLiteDatabase,
  cycleId: number,
  dayDate: string,
  amount: number,
  note: string | null,
  entryTime: string
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO extra_cash_entries (cycle_id, day_date, amount, note, entry_time, is_staged, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [cycleId, dayDate, amount, note ?? null, entryTime, new Date().toISOString()]
  );
  return result.lastInsertRowId;
}

export async function deleteStagedExtraCash(
  db: SQLiteDatabase,
  entryId: number
): Promise<void> {
  await db.runAsync(
    'DELETE FROM extra_cash_entries WHERE id = ? AND is_staged = 1',
    [entryId]
  );
}

export async function getStagedExtraCash(
  db: SQLiteDatabase,
  cycleId: number,
  dayDate: string
): Promise<ExtraCashEntry[]> {
  return db.getAllAsync<ExtraCashEntry>(
    'SELECT * FROM extra_cash_entries WHERE cycle_id = ? AND day_date = ? AND is_staged = 1 ORDER BY created_at ASC',
    [cycleId, dayDate]
  );
}

export async function commitExtraCash(
  db: SQLiteDatabase,
  cycleId: number,
  dayDate: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE extra_cash_entries SET is_staged = 0, committed_at = ? WHERE cycle_id = ? AND day_date = ? AND is_staged = 1',
    [now, cycleId, dayDate]
  );
}

export async function getCommittedExtraCash(
  db: SQLiteDatabase,
  cycleId: number,
  dayDate: string
): Promise<ExtraCashEntry[]> {
  return db.getAllAsync<ExtraCashEntry>(
    'SELECT * FROM extra_cash_entries WHERE cycle_id = ? AND day_date = ? AND is_staged = 0 ORDER BY entry_time ASC',
    [cycleId, dayDate]
  );
}
