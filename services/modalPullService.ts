import { type SQLiteDatabase } from 'expo-sqlite';
import { updateSavingsBalance } from './cycleService';

export interface ModalPull {
  id: number;
  spend_entry_id: number;
  source_type: 'savings' | 'reservation';
  reservation_id: number | null;
  amount: number;
}

export async function createPull(
  db: SQLiteDatabase,
  spendEntryId: number,
  sourceType: 'savings' | 'reservation',
  amount: number,
  reservationId?: number
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO modal_pulls (spend_entry_id, source_type, reservation_id, amount) VALUES (?, ?, ?, ?)',
    [spendEntryId, sourceType, reservationId ?? null, amount]
  );
  return result.lastInsertRowId;
}

export async function getPullsForSpend(
  db: SQLiteDatabase,
  spendEntryId: number
): Promise<ModalPull[]> {
  return db.getAllAsync<ModalPull>(
    'SELECT * FROM modal_pulls WHERE spend_entry_id = ?',
    [spendEntryId]
  );
}

/**
 * Reverses all modal pulls for a spend entry when it is deleted.
 * Restores savings_balance on the cycle and current_balance on reservations.
 */
export async function reversePullsForSpend(
  db: SQLiteDatabase,
  spendEntryId: number,
  cycleId: number
): Promise<void> {
  const pulls = await getPullsForSpend(db, spendEntryId);
  for (const pull of pulls) {
    if (pull.source_type === 'savings') {
      // Add the pulled amount back to savings_balance
      await db.runAsync(
        'UPDATE cycles SET savings_balance = savings_balance + ? WHERE id = ?',
        [pull.amount, cycleId]
      );
    } else if (pull.source_type === 'reservation' && pull.reservation_id != null) {
      // Add the pulled amount back to the reservation
      await db.runAsync(
        'UPDATE reservations SET current_balance = current_balance + ? WHERE id = ?',
        [pull.amount, pull.reservation_id]
      );
    }
  }
  await db.runAsync('DELETE FROM modal_pulls WHERE spend_entry_id = ?', [spendEntryId]);
}
