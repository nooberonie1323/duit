import type { SQLiteDatabase } from 'expo-sqlite';
import { getOrCreateTodayDay, type EntryRow } from '@/services/entryService';

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
