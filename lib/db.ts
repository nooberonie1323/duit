import { reconcileLegacySavingsBalance } from '@/services/savingsService';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export async function migrateDb(db: SQLite.SQLiteDatabase) {
  // WAL mode is not supported on web (SQLite WASM) — skip it there
  if (Platform.OS !== 'web') {
    await db.execAsync('PRAGMA journal_mode = WAL;').catch(() => {});
  }

  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      review_time INTEGER NOT NULL DEFAULT 22,
      notifications_enabled INTEGER NOT NULL DEFAULT 0,
      theme TEXT NOT NULL DEFAULT 'system'
    );

    CREATE TABLE IF NOT EXISTS cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      income REAL NOT NULL,
      already_spent REAL NOT NULL DEFAULT 0,
      savings REAL NOT NULL DEFAULT 0,
      budget_alert REAL NOT NULL DEFAULT 0,
      start_from_today INTEGER NOT NULL DEFAULT 1,
      pool_leftover REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      amount REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reservation_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('spend', 'release')),
      amount REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      daily_budget REAL NOT NULL,
      total_spent REAL NOT NULL DEFAULT 0,
      pool_after_review REAL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('spend', 'extra_cash')),
      amount REAL NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      time TEXT NOT NULL DEFAULT (datetime('now')),
      staged INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS archived_savings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('lent', 'borrowed')),
      person_name TEXT NOT NULL,
      original_amount REAL NOT NULL,
      note TEXT,
      loaned_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'settled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS loan_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('pool', 'savings', 'reservation', 'used', 'pending')),
      cycle_id INTEGER REFERENCES cycles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS loan_repayment_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL UNIQUE REFERENCES loans(id) ON DELETE CASCADE,
      amount_per_month REAL NOT NULL,
      total_months INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loan_repayment_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
      reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS savings_withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS onboarding_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      current_page INTEGER NOT NULL DEFAULT 1,
      partial_data TEXT NOT NULL DEFAULT '{}'
    );

    -- Savings running balance (one row). Existing per-cycle savings stays untouched.
    CREATE TABLE IF NOT EXISTS savings_account (
      id INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
      balance REAL NOT NULL DEFAULT 0,
      is_initialized INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Signed movements: positive increases balance, negative decreases it.
    CREATE TABLE IF NOT EXISTS savings_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER REFERENCES cycles(id) ON DELETE SET NULL,
      type TEXT NOT NULL CHECK(type IN ('opening_balance', 'contribution', 'withdrawal', 'carry_in', 'carry_out', 'spent')),
      amount REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- A planned next cycle. Only applied on explicit confirmation.
    CREATE TABLE IF NOT EXISTS cycle_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pending_confirmation', 'applied', 'abandoned')),
      source_cycle_id INTEGER REFERENCES cycles(id) ON DELETE SET NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      income REAL NOT NULL,
      already_spent REAL NOT NULL DEFAULT 0,
      savings_contribution REAL NOT NULL DEFAULT 0,
      budget_alert REAL NOT NULL DEFAULT 0,
      carry_pool REAL NOT NULL DEFAULT 0,
      carry_savings REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      applied_at TEXT,
      applied_cycle_id INTEGER REFERENCES cycles(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS cycle_plan_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL REFERENCES cycle_plans(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      is_carried INTEGER NOT NULL DEFAULT 0,
      source_reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL
    );

    -- One row per leftover item and its chosen destination.
    CREATE TABLE IF NOT EXISTS carryover_choices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL REFERENCES cycle_plans(id) ON DELETE CASCADE,
      source_cycle_id INTEGER REFERENCES cycles(id) ON DELETE SET NULL,
      item_type TEXT NOT NULL CHECK(item_type IN ('pool', 'reservation', 'savings')),
      source_reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
      source_name TEXT,
      amount REAL NOT NULL,
      destination TEXT NOT NULL CHECK(destination IN ('pool', 'savings', 'reservation', 'spent')),
      target_reservation_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cycle_closings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL UNIQUE REFERENCES cycles(id) ON DELETE CASCADE,
      pool_leftover REAL NOT NULL DEFAULT 0,
      reservations_leftover REAL NOT NULL DEFAULT 0,
      savings_leftover REAL NOT NULL DEFAULT 0,
      marked_spent_total REAL NOT NULL DEFAULT 0,
      closed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Money marked "I already spent it" at cycle close.
    CREATE TABLE IF NOT EXISTS cycle_close_spends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      closing_id INTEGER NOT NULL REFERENCES cycle_closings(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL CHECK(source_type IN ('pool', 'reservation', 'savings')),
      reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
      amount REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Safe column migrations for existing databases
  await db.execAsync('ALTER TABLE days ADD COLUMN notes TEXT').catch(() => {});
  await db.execAsync('ALTER TABLE reservations ADD COLUMN paid_at TEXT').catch(() => {});
  await db.execAsync('ALTER TABLE reservations ADD COLUMN paid_note TEXT').catch(() => {});
  await db.execAsync('ALTER TABLE reservations DROP COLUMN paid_at').catch(() => {});
  await db.execAsync('ALTER TABLE reservations DROP COLUMN paid_note').catch(() => {});

  // Existing cycles keep the old money maths until they end; new cycles will opt in to v2.
  await db.execAsync('ALTER TABLE cycles ADD COLUMN model_version INTEGER NOT NULL DEFAULT 1').catch(() => {});

  await initializeSavingsAccount(db);
  await reconcileLegacySavingsBalance(db);
}

async function initializeSavingsAccount(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(
    `INSERT OR IGNORE INTO savings_account (id, balance, is_initialized, updated_at)
     VALUES (1, 0, 0, datetime('now'))`
  );

  const account = await db.getFirstAsync<{ is_initialized: number }>(
    'SELECT is_initialized FROM savings_account WHERE id = 1'
  );
  if (!account || account.is_initialized === 1) return;

  // Existing users start from the savings left in their latest cycle.
  const latestCycle = await db.getFirstAsync<{ id: number; remaining: number }>(
    `SELECT c.id as id,
            c.savings - COALESCE((SELECT SUM(w.amount) FROM savings_withdrawals w WHERE w.cycle_id = c.id), 0) as remaining
     FROM cycles c
     ORDER BY c.id DESC LIMIT 1`
  );
  const openingBalance = Math.max(0, latestCycle?.remaining ?? 0);

  await db.execAsync('BEGIN');
  try {
    await db.runAsync(
      `UPDATE savings_account SET balance = ?, is_initialized = 1, updated_at = datetime('now') WHERE id = 1`,
      [openingBalance]
    );
    if (openingBalance > 0) {
      await db.runAsync(
        `INSERT INTO savings_ledger (cycle_id, type, amount, note) VALUES (?, 'opening_balance', ?, ?)`,
        [latestCycle?.id ?? null, openingBalance, 'Opening balance from existing savings']
      );
    }
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateStr(s: string): Date {
  return new Date(`${s}T12:00:00`);
}
