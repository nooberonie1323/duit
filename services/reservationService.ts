import type { SQLiteDatabase } from 'expo-sqlite';

export type ReservationTransactionType = 'spend' | 'release';

export interface ReservationTransactionRow {
  id: number;
  reservation_id: number;
  type: ReservationTransactionType;
  amount: number;
  note: string | null;
  created_at: string;
}

export async function getReservationTransactions(
  db: SQLiteDatabase,
  reservationId: number
): Promise<ReservationTransactionRow[]> {
  return db.getAllAsync<ReservationTransactionRow>(
    'SELECT * FROM reservation_transactions WHERE reservation_id = ? ORDER BY id DESC',
    [reservationId]
  );
}

async function getLastReviewedDayId(db: SQLiteDatabase, cycleId: number): Promise<number | null> {
  const lastReview = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM days
     WHERE cycle_id = ? AND reviewed_at IS NOT NULL AND pool_after_review IS NOT NULL
     ORDER BY date DESC LIMIT 1`,
    [cycleId]
  );
  return lastReview?.id ?? null;
}

export async function addReservationTransaction(
  db: SQLiteDatabase,
  cycleId: number,
  reservationId: number,
  type: ReservationTransactionType,
  amount: number,
  note: string
): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await db.runAsync(
      'INSERT INTO reservation_transactions (reservation_id, type, amount, note) VALUES (?, ?, ?, ?)',
      [reservationId, type, amount, note.trim() || null]
    );
    if (type === 'release') {
      const dayId = await getLastReviewedDayId(db, cycleId);
      if (dayId !== null) {
        await db.runAsync(
          'UPDATE days SET pool_after_review = pool_after_review + ? WHERE id = ?',
          [amount, dayId]
        );
      }
    }
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

export async function deleteLastTransaction(
  db: SQLiteDatabase,
  cycleId: number,
  reservationId: number
): Promise<void> {
  const last = await db.getFirstAsync<ReservationTransactionRow>(
    'SELECT * FROM reservation_transactions WHERE reservation_id = ? ORDER BY id DESC LIMIT 1',
    [reservationId]
  );
  if (!last) return;

  await db.execAsync('BEGIN');
  try {
    await db.runAsync('DELETE FROM reservation_transactions WHERE id = ?', [last.id]);
    if (last.type === 'release') {
      const dayId = await getLastReviewedDayId(db, cycleId);
      if (dayId !== null) {
        await db.runAsync(
          'UPDATE days SET pool_after_review = pool_after_review - ? WHERE id = ?',
          [last.amount, dayId]
        );
      }
    }
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}
