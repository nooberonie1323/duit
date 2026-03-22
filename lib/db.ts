import { type SQLiteDatabase } from 'expo-sqlite';

/**
 * Runs once on first app open (idempotent — safe to run on every launch).
 * Creates all 10 tables and inserts the default settings row if missing.
 *
 * Uses individual runAsync calls instead of a single execAsync block —
 * execAsync can silently drop statements in expo-sqlite v16.
 */
export async function migrateDb(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('PRAGMA journal_mode = WAL');

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      id                    INTEGER PRIMARY KEY DEFAULT 1,
      name                  TEXT    NOT NULL DEFAULT '',
      notifications_enabled INTEGER NOT NULL DEFAULT 1,
      review_time           TEXT    NOT NULL DEFAULT '22:00',
      theme                 TEXT    NOT NULL DEFAULT 'system',
      onboarding_complete   INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS onboarding_state (
      id           INTEGER PRIMARY KEY DEFAULT 1,
      current_page INTEGER NOT NULL DEFAULT 1,
      partial_data TEXT    NOT NULL DEFAULT '{}'
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS cycles (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date      TEXT    NOT NULL,
      end_date        TEXT    NOT NULL,
      income          REAL    NOT NULL,
      budget_alert    REAL    NOT NULL DEFAULT 0,
      savings_amount  REAL    NOT NULL DEFAULT 0,
      already_spent   REAL    NOT NULL DEFAULT 0,
      starts_from     TEXT    NOT NULL DEFAULT 'today',
      pool_carryover  REAL    NOT NULL DEFAULT 0,
      pool_balance    REAL    NOT NULL DEFAULT 0,
      savings_balance REAL    NOT NULL DEFAULT 0,
      status          TEXT    NOT NULL DEFAULT 'active',
      created_at      TEXT    NOT NULL
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS days (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id     INTEGER NOT NULL,
      date         TEXT    NOT NULL,
      daily_budget REAL    NOT NULL,
      total_spent  REAL    NOT NULL DEFAULT 0,
      total_extra  REAL    NOT NULL DEFAULT 0,
      flag         TEXT    NOT NULL,
      note         TEXT,
      is_reviewed  INTEGER NOT NULL DEFAULT 0,
      is_skipped   INTEGER NOT NULL DEFAULT 0,
      reviewed_at  TEXT,
      FOREIGN KEY (cycle_id) REFERENCES cycles(id),
      UNIQUE (cycle_id, date)
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS spend_entries (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id     INTEGER NOT NULL,
      day_date     TEXT    NOT NULL,
      amount       REAL    NOT NULL,
      note         TEXT,
      entry_time   TEXT    NOT NULL,
      is_staged    INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT    NOT NULL,
      committed_at TEXT,
      FOREIGN KEY (cycle_id) REFERENCES cycles(id)
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS extra_cash_entries (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id     INTEGER NOT NULL,
      day_date     TEXT    NOT NULL,
      amount       REAL    NOT NULL,
      note         TEXT,
      entry_time   TEXT    NOT NULL,
      is_staged    INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT    NOT NULL,
      committed_at TEXT,
      FOREIGN KEY (cycle_id) REFERENCES cycles(id)
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS reservations (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id              INTEGER NOT NULL,
      name                  TEXT    NOT NULL,
      original_amount       REAL    NOT NULL,
      current_balance       REAL    NOT NULL,
      is_staged             INTEGER NOT NULL DEFAULT 0,
      carried_from_cycle_id INTEGER,
      created_at            TEXT    NOT NULL,
      FOREIGN KEY (cycle_id) REFERENCES cycles(id)
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS modal_pulls (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      spend_entry_id INTEGER NOT NULL,
      source_type    TEXT    NOT NULL,
      reservation_id INTEGER,
      amount         REAL    NOT NULL,
      FOREIGN KEY (spend_entry_id) REFERENCES spend_entries(id),
      FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS archived_savings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      from_cycle_id INTEGER NOT NULL,
      amount        REAL    NOT NULL,
      archived_at   TEXT    NOT NULL,
      FOREIGN KEY (from_cycle_id) REFERENCES cycles(id)
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS archive_withdrawals (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      amount      REAL    NOT NULL,
      destination TEXT    NOT NULL,
      cycle_id    INTEGER NOT NULL,
      created_at  TEXT    NOT NULL
    )
  `);

  // Seed the single settings row if it doesn't exist yet
  await db.runAsync(
    `INSERT OR IGNORE INTO settings (id, name, onboarding_complete) VALUES (1, '', 0)`
  );
}
