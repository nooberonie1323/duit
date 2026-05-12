import { toDateStr } from '@/lib/db';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface EntryRow {
  id: number;
  day_id: number;
  amount: number;
  note: string;
  time: string;
  staged: number;
}

export async function getOrCreateTodayDay(
  db: SQLiteDatabase,
  cycleId: number,
  dailyBudget: number
): Promise<number> {
  const today = toDateStr(new Date());
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM days WHERE cycle_id = ? AND date = ?',
    [cycleId, today]
  );
  if (existing) return existing.id;

  const result = await db.runAsync(
    'INSERT INTO days (cycle_id, date, daily_budget) VALUES (?, ?, ?)',
    [cycleId, today, dailyBudget]
  );
  return result.lastInsertRowId;
}

export async function getTodayEntries(
  db: SQLiteDatabase,
  cycleId: number
): Promise<EntryRow[]> {
  const today = toDateStr(new Date());
  return db.getAllAsync<EntryRow>(
    `SELECT e.* FROM entries e
     JOIN days d ON e.day_id = d.id
     WHERE d.cycle_id = ? AND d.date = ? AND e.type = 'spend'
     ORDER BY e.id ASC`,
    [cycleId, today]
  );
}

export async function addEntry(
  db: SQLiteDatabase,
  dayId: number,
  note: string,
  amount: number
): Promise<void> {
  await db.runAsync(
    `INSERT INTO entries (day_id, type, amount, note) VALUES (?, 'spend', ?, ?)`,
    [dayId, amount, note]
  );
}

export async function updateEntry(
  db: SQLiteDatabase,
  entryId: number,
  note: string,
  amount: number
): Promise<void> {
  await db.runAsync(
    'UPDATE entries SET note = ?, amount = ? WHERE id = ?',
    [note, amount, entryId]
  );
}

export async function deleteEntry(
  db: SQLiteDatabase,
  entryId: number
): Promise<void> {
  await db.runAsync('DELETE FROM entries WHERE id = ?', [entryId]);
}

export interface ReviewedDay {
  id: number;
  date: string;
  daily_budget: number;
  total_spent: number;
  reviewed_at: string;
  notes: string | null;
}

export interface ReviewedDayWithCycle extends ReviewedDay {
  cycle_id: number;
  cycle_start: string;
  cycle_end: string;
}

export async function getAllReviewedDays(db: SQLiteDatabase): Promise<ReviewedDayWithCycle[]> {
  return db.getAllAsync<ReviewedDayWithCycle>(
    `SELECT d.id, d.date, d.daily_budget, d.total_spent, d.reviewed_at, d.notes,
            d.cycle_id, c.start_date as cycle_start, c.end_date as cycle_end
     FROM days d
     JOIN cycles c ON d.cycle_id = c.id
     WHERE d.reviewed_at IS NOT NULL
     ORDER BY d.date DESC`
  );
}

export async function getReviewedDays(
  db: SQLiteDatabase,
  cycleId: number
): Promise<ReviewedDay[]> {
  return db.getAllAsync<ReviewedDay>(
    `SELECT id, date, daily_budget, total_spent, reviewed_at, notes
     FROM days
     WHERE cycle_id = ? AND reviewed_at IS NOT NULL
     ORDER BY date DESC`,
    [cycleId]
  );
}

export async function getDayEntries(
  db: SQLiteDatabase,
  dayId: number
): Promise<EntryRow[]> {
  return db.getAllAsync<EntryRow>(
    `SELECT * FROM entries WHERE day_id = ? ORDER BY id ASC`,
    [dayId]
  );
}
