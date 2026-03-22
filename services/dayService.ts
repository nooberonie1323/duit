import { type SQLiteDatabase } from 'expo-sqlite';

export type DayFlag = 'green' | 'blue' | 'rough' | 'amber' | 'grey';

export interface Day {
  id: number;
  cycle_id: number;
  date: string;
  daily_budget: number;
  total_spent: number;
  total_extra: number;
  flag: DayFlag;
  note: string | null;
  is_reviewed: number;
  is_skipped: number;
  reviewed_at: string | null;
}

export async function getDayByDate(
  db: SQLiteDatabase,
  cycleId: number,
  date: string
): Promise<Day | null> {
  return db.getFirstAsync<Day>(
    'SELECT * FROM days WHERE cycle_id = ? AND date = ?',
    [cycleId, date]
  );
}

export async function getDaysByCycle(db: SQLiteDatabase, cycleId: number): Promise<Day[]> {
  return db.getAllAsync<Day>(
    'SELECT * FROM days WHERE cycle_id = ? ORDER BY date ASC',
    [cycleId]
  );
}

export async function getMissedDays(db: SQLiteDatabase, cycleId: number): Promise<Day[]> {
  return db.getAllAsync<Day>(
    "SELECT * FROM days WHERE cycle_id = ? AND flag = 'amber' AND is_reviewed = 0 AND is_skipped = 0 ORDER BY date ASC",
    [cycleId]
  );
}

export async function createDay(
  db: SQLiteDatabase,
  day: Omit<Day, 'id'>
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO days (cycle_id, date, daily_budget, total_spent, total_extra, flag, note, is_reviewed, is_skipped, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      day.cycle_id,
      day.date,
      day.daily_budget,
      day.total_spent,
      day.total_extra,
      day.flag,
      day.note ?? null,
      day.is_reviewed,
      day.is_skipped,
      day.reviewed_at ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function markDayReviewed(
  db: SQLiteDatabase,
  dayId: number,
  totalSpent: number,
  totalExtra: number,
  flag: DayFlag,
  note: string | null
): Promise<void> {
  await db.runAsync(
    `UPDATE days SET is_reviewed = 1, total_spent = ?, total_extra = ?, flag = ?, note = ?, reviewed_at = ? WHERE id = ?`,
    [totalSpent, totalExtra, flag, note ?? null, new Date().toISOString(), dayId]
  );
}

export async function markDaySkipped(db: SQLiteDatabase, dayId: number): Promise<void> {
  await db.runAsync(
    "UPDATE days SET is_skipped = 1, flag = 'grey', reviewed_at = ? WHERE id = ?",
    [new Date().toISOString(), dayId]
  );
}

export async function updateDayNote(
  db: SQLiteDatabase,
  dayId: number,
  note: string
): Promise<void> {
  await db.runAsync('UPDATE days SET note = ? WHERE id = ?', [note, dayId]);
}
