import { type SQLiteDatabase } from 'expo-sqlite';

export interface Reservation {
  id: number;
  cycle_id: number;
  name: string;
  original_amount: number;
  current_balance: number;
  is_staged: number;
  carried_from_cycle_id: number | null;
  created_at: string;
}

export async function getReservationsByCycle(
  db: SQLiteDatabase,
  cycleId: number
): Promise<Reservation[]> {
  return db.getAllAsync<Reservation>(
    'SELECT * FROM reservations WHERE cycle_id = ? ORDER BY created_at ASC',
    [cycleId]
  );
}

export async function getCommittedReservationsByCycle(
  db: SQLiteDatabase,
  cycleId: number
): Promise<Reservation[]> {
  return db.getAllAsync<Reservation>(
    'SELECT * FROM reservations WHERE cycle_id = ? AND is_staged = 0 ORDER BY created_at ASC',
    [cycleId]
  );
}

export async function createReservation(
  db: SQLiteDatabase,
  cycleId: number,
  name: string,
  amount: number,
  isStaged: boolean = false,
  carriedFromCycleId?: number
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO reservations (cycle_id, name, original_amount, current_balance, is_staged, carried_from_cycle_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      cycleId,
      name,
      amount,
      amount,
      isStaged ? 1 : 0,
      carriedFromCycleId ?? null,
      new Date().toISOString(),
    ]
  );
  return result.lastInsertRowId;
}

export async function updateReservationBalance(
  db: SQLiteDatabase,
  reservationId: number,
  newBalance: number
): Promise<void> {
  await db.runAsync(
    'UPDATE reservations SET current_balance = ? WHERE id = ?',
    [newBalance, reservationId]
  );
}

export async function commitStagedReservations(
  db: SQLiteDatabase,
  cycleId: number
): Promise<void> {
  await db.runAsync(
    'UPDATE reservations SET is_staged = 0 WHERE cycle_id = ? AND is_staged = 1',
    [cycleId]
  );
}

export async function deleteReservation(
  db: SQLiteDatabase,
  reservationId: number
): Promise<void> {
  await db.runAsync('DELETE FROM reservations WHERE id = ?', [reservationId]);
}
