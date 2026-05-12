import { toDateStr } from '@/lib/db';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getOrCreateTodayDay, type EntryRow } from '@/services/entryService';

export interface MissedDay {
  id: number;
  date: string;
}

export async function getMissedDays(
  db: SQLiteDatabase,
  cycleId: number
): Promise<MissedDay[]> {
  const today = toDateStr(new Date());
  return db.getAllAsync<MissedDay>(
    `SELECT id, date FROM days WHERE cycle_id = ? AND date < ? AND reviewed_at IS NULL ORDER BY date ASC`,
    [cycleId, today]
  );
}

export async function getMissedEntries(
  db: SQLiteDatabase,
  dayIds: number[]
): Promise<EntryRow[]> {
  if (dayIds.length === 0) return [];
  const placeholders = dayIds.map(() => '?').join(',');
  return db.getAllAsync<EntryRow>(
    `SELECT * FROM entries WHERE day_id IN (${placeholders}) AND type = 'spend' ORDER BY id ASC`,
    dayIds
  );
}

export async function confirmCatchUpReview(
  db: SQLiteDatabase,
  missedDays: MissedDay[],
  totalSpent: number,
  leftInCycle: number,
  note: string
): Promise<void> {
  if (missedDays.length === 0) return;
  const now = new Date().toISOString();
  const poolAfter = Math.max(0, leftInCycle - totalSpent);

  for (let i = 0; i < missedDays.length; i++) {
    const isLast = i === missedDays.length - 1;
    await db.runAsync(
      `UPDATE days SET total_spent = ?, reviewed_at = ?, pool_after_review = ?, notes = ? WHERE id = ?`,
      [isLast ? totalSpent : 0, now, isLast ? poolAfter : null, isLast ? (note.trim() || null) : null, missedDays[i].id]
    );
    await db.runAsync('UPDATE entries SET staged = 0 WHERE day_id = ?', [missedDays[i].id]);
  }
}

export async function confirmReview(
  db: SQLiteDatabase,
  cycleId: number,
  dailyBudget: number,
  leftInCycle: number,
  entries: EntryRow[],
  note: string
): Promise<void> {
  const totalSpent = entries.reduce((s, e) => s + e.amount, 0);
  const poolAfterReview = Math.max(0, leftInCycle - totalSpent);

  const dayId = await getOrCreateTodayDay(db, cycleId, dailyBudget);

  await db.runAsync(
    `UPDATE days SET total_spent = ?, reviewed_at = ?, pool_after_review = ?, notes = ? WHERE id = ?`,
    [totalSpent, new Date().toISOString(), poolAfterReview, note.trim() || null, dayId]
  );

  await db.runAsync('UPDATE entries SET staged = 0 WHERE day_id = ?', [dayId]);
}
