import type { SQLiteDatabase } from 'expo-sqlite';

export type SavingsLedgerType =
  | 'opening_balance'
  | 'contribution'
  | 'withdrawal'
  | 'carry_in'
  | 'carry_out'
  | 'spent';

export interface SavingsLedgerRow {
  id: number;
  cycle_id: number | null;
  type: SavingsLedgerType;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface SavingsMovement {
  cycleId: number | null;
  type: SavingsLedgerType;
  amount: number;
  note: string;
}

const MONEY_EPSILON = 0.005;

export async function getSavingsBalance(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ balance: number }>(
    'SELECT balance FROM savings_account WHERE id = 1'
  );
  return row?.balance ?? 0;
}

export async function getSavingsHistory(
  db: SQLiteDatabase,
  limit = 40
): Promise<SavingsLedgerRow[]> {
  return db.getAllAsync<SavingsLedgerRow>(
    'SELECT * FROM savings_ledger ORDER BY id DESC LIMIT ?',
    [limit]
  );
}

// Applies one signed savings movement without opening a transaction, so callers
// that already own a transaction (loan receipts) can reuse it safely.
export async function recordSavingsMovement(
  db: SQLiteDatabase,
  movement: SavingsMovement
): Promise<void> {
  if (!Number.isFinite(movement.amount) || movement.amount === 0) {
    throw new Error('Savings movement must be a non-zero amount');
  }
  await db.runAsync(
    'INSERT INTO savings_ledger (cycle_id, type, amount, note) VALUES (?, ?, ?, ?)',
    [
      movement.cycleId,
      movement.type,
      movement.amount,
      movement.note.trim() || null,
    ]
  );
  await db.runAsync(
    `UPDATE savings_account
     SET balance = balance + ?, updated_at = datetime('now')
     WHERE id = 1`,
    [movement.amount]
  );
}

export async function addSavingsWithdrawal(
  db: SQLiteDatabase,
  cycleId: number,
  amount: number,
  note: string
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter a valid amount to use from savings');
  }

  await db.execAsync('BEGIN');
  try {
    const balance = await getSavingsBalance(db);
    if (amount > balance + MONEY_EPSILON) {
      throw new Error('That is more than your savings balance');
    }
    await db.runAsync(
      'INSERT INTO savings_withdrawals (cycle_id, amount, note) VALUES (?, ?, ?)',
      [cycleId, amount, note.trim() || null]
    );
    await recordSavingsMovement(db, {
      cycleId,
      type: 'withdrawal',
      amount: -amount,
      note: note.trim() || 'Used from savings',
    });
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

// Used by onboarding and the dev seed: replaces the balance and records the opening amount.
export async function setOpeningSavingsBalance(
  db: SQLiteDatabase,
  cycleId: number | null,
  amount: number,
  note: string
): Promise<void> {
  const balance = Number.isFinite(amount) && amount > 0 ? amount : 0;
  await db.runAsync('DELETE FROM savings_ledger');
  await db.runAsync(
    `INSERT INTO savings_account (id, balance, is_initialized, updated_at)
     VALUES (1, ?, 1, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET balance = excluded.balance, is_initialized = 1, updated_at = datetime('now')`,
    [balance]
  );
  if (balance > 0) {
    await db.runAsync(
      `INSERT INTO savings_ledger (cycle_id, type, amount, note) VALUES (?, 'opening_balance', ?, ?)`,
      [cycleId, balance, note]
    );
  }
}

export async function syncSavingsFromLatestCycle(db: SQLiteDatabase): Promise<void> {
  const latest = await db.getFirstAsync<{ id: number; remaining: number }>(
    `SELECT c.id as id,
            c.savings - COALESCE((SELECT SUM(w.amount) FROM savings_withdrawals w WHERE w.cycle_id = c.id), 0) as remaining
     FROM cycles c
     ORDER BY c.id DESC LIMIT 1`
  );
  await setOpeningSavingsBalance(
    db,
    latest?.id ?? null,
    Math.max(0, latest?.remaining ?? 0),
    'Opening balance from existing savings'
  );
}

// Runs once after this update. Cycles created before the running balance
// existed may have an account that is missing recent withdrawals. After this
// one-time sync, normal movements keep it correct.
export async function reconcileLegacySavingsBalance(db: SQLiteDatabase): Promise<void> {
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((versionRow?.user_version ?? 0) >= 1) return;

  const latest = await db.getFirstAsync<{
    id: number;
    savings: number;
    withdrawn: number;
  }>(
    `SELECT c.id as id, c.savings,
            COALESCE((SELECT SUM(w.amount) FROM savings_withdrawals w WHERE w.cycle_id = c.id), 0) as withdrawn
     FROM cycles c
     ORDER BY c.id DESC LIMIT 1`
  );

  if (latest) {
    const expected = Math.max(0, latest.savings - latest.withdrawn);
    const balance = await getSavingsBalance(db);
    const difference = expected - balance;
    if (Math.abs(difference) > MONEY_EPSILON) {
      await recordSavingsMovement(db, {
        cycleId: latest.id,
        type: difference > 0 ? 'contribution' : 'withdrawal',
        amount: difference,
        note: 'Balance synced after update',
      });
    }
  }

  await db.execAsync('PRAGMA user_version = 1');
}
