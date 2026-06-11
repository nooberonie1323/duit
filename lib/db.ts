import * as SQLite from 'expo-sqlite';

export async function migrateDb(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
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

    CREATE TABLE IF NOT EXISTS onboarding_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      current_page INTEGER NOT NULL DEFAULT 1,
      partial_data TEXT NOT NULL DEFAULT '{}'
    );
  `);

  // Safe column migrations for existing databases
  await db.execAsync('ALTER TABLE days ADD COLUMN notes TEXT').catch(() => {});
  await db.execAsync('ALTER TABLE reservations ADD COLUMN paid_at TEXT').catch(() => {});
  await db.execAsync('ALTER TABLE reservations ADD COLUMN paid_note TEXT').catch(() => {});
  await db.execAsync('ALTER TABLE reservations DROP COLUMN paid_at').catch(() => {});
  await db.execAsync('ALTER TABLE reservations DROP COLUMN paid_note').catch(() => {});
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
