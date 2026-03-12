/**
 * db.js — All database access for Duit.
 * Components NEVER query SQLite directly. Everything goes through here.
 */

// ─── Schema Init ─────────────────────────────────────────────────────────────

export async function initDatabase(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      income REAL NOT NULL,
      savings_amount REAL NOT NULL,
      already_spent REAL DEFAULT 0,
      min_daily_threshold REAL DEFAULT 50,
      carryover_amount REAL DEFAULT 0,
      end_note TEXT,
      end_flag TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS daily_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      amount_spent REAL DEFAULT 0,
      extra_cash REAL DEFAULT 0,
      note TEXT,
      flag TEXT,
      tags TEXT,
      FOREIGN KEY (cycle_id) REFERENCES cycles(id)
    );

    CREATE TABLE IF NOT EXISTS reservation_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#4F46E5',
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      amount_used REAL DEFAULT 0,
      is_complete INTEGER DEFAULT 0,
      carried_from_cycle_id INTEGER,
      FOREIGN KEY (cycle_id) REFERENCES cycles(id),
      FOREIGN KEY (tag_id) REFERENCES reservation_tags(id)
    );

    CREATE TABLE IF NOT EXISTS savings_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      direction TEXT NOT NULL,
      reason TEXT,
      note TEXT,
      FOREIGN KEY (cycle_id) REFERENCES cycles(id)
    );

    INSERT OR IGNORE INTO reservation_tags (name, color) VALUES
      ('Food', '#4F46E5'),
      ('Transport', '#0EA5E9'),
      ('Luna', '#16A34A'),
      ('Emergency', '#DC2626'),
      ('Fun', '#D97706');
  `);
}

// ─── Cycle Operations ─────────────────────────────────────────────────────────

export async function getCycles(db) {
  return await db.getAllAsync(
    "SELECT * FROM cycles ORDER BY start_date DESC"
  );
}

export async function getActiveCycle(db) {
  return await db.getFirstAsync(
    "SELECT * FROM cycles WHERE is_active = 1 LIMIT 1"
  );
}

export async function startCycle(db, data) {
  // Deactivate any current active cycle
  await db.runAsync("UPDATE cycles SET is_active = 0 WHERE is_active = 1");

  const result = await db.runAsync(
    `INSERT INTO cycles
      (start_date, end_date, income, savings_amount, already_spent, min_daily_threshold, carryover_amount, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      data.start_date,
      data.end_date,
      data.income,
      data.savings_amount,
      data.already_spent ?? 0,
      data.min_daily_threshold ?? 50,
      data.carryover_amount ?? 0,
    ]
  );
  return result.lastInsertRowId;
}

export async function endCycle(db, id, note, flag) {
  await db.runAsync(
    "UPDATE cycles SET is_active = 0, end_note = ?, end_flag = ? WHERE id = ?",
    [note, flag, id]
  );
}

// ─── Daily Entries ────────────────────────────────────────────────────────────

export async function logDailySpend(db, cycleId, date, amount, note, flag, tags) {
  const existing = await getDailyEntry(db, cycleId, date);
  const tagsJson = tags ? JSON.stringify(tags) : null;

  if (existing) {
    await db.runAsync(
      `UPDATE daily_entries
       SET amount_spent = ?, note = ?, flag = ?, tags = ?
       WHERE cycle_id = ? AND date = ?`,
      [amount, note, flag, tagsJson, cycleId, date]
    );
  } else {
    await db.runAsync(
      `INSERT INTO daily_entries (cycle_id, date, amount_spent, note, flag, tags)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cycleId, date, amount, note, flag, tagsJson]
    );
  }
}

export async function getDailyEntry(db, cycleId, date) {
  return await db.getFirstAsync(
    "SELECT * FROM daily_entries WHERE cycle_id = ? AND date = ?",
    [cycleId, date]
  );
}

export async function addExtraCash(db, cycleId, date, amount) {
  const existing = await getDailyEntry(db, cycleId, date);
  if (existing) {
    await db.runAsync(
      "UPDATE daily_entries SET extra_cash = extra_cash + ? WHERE cycle_id = ? AND date = ?",
      [amount, cycleId, date]
    );
  } else {
    await db.runAsync(
      "INSERT INTO daily_entries (cycle_id, date, extra_cash) VALUES (?, ?, ?)",
      [cycleId, date, amount]
    );
  }
}

// ─── Budget Calculations ──────────────────────────────────────────────────────

export async function getDailyBudget(db, cycleId, date) {
  const cycle = await db.getFirstAsync(
    "SELECT * FROM cycles WHERE id = ?",
    [cycleId]
  );
  if (!cycle) return { regular: 0, extra: 0, total: 0 };

  const today = new Date(date);
  const endDate = new Date(cycle.end_date);

  // Days remaining including today
  const msPerDay = 1000 * 60 * 60 * 24;
  const remainingDays = Math.max(
    1,
    Math.floor((endDate - today) / msPerDay) + 1
  );

  const pool = await getRemainingPool(db, cycleId);

  // Extra cash for today
  const todayEntry = await getDailyEntry(db, cycleId, date);
  const extraToday = todayEntry?.extra_cash ?? 0;

  // Total extra cash in pool from future days
  const extraRows = await db.getAllAsync(
    "SELECT SUM(extra_cash) as total FROM daily_entries WHERE cycle_id = ? AND date >= ?",
    [cycleId, date]
  );
  const totalExtra = extraRows[0]?.total ?? 0;

  const regularPool = pool.regular;
  const dailyRegular = regularPool / remainingDays;
  const dailyExtra = totalExtra / remainingDays;

  return {
    regular: Math.max(0, dailyRegular),
    extra: Math.max(0, dailyExtra),
    total: Math.max(0, dailyRegular + dailyExtra),
  };
}

export async function getRemainingPool(db, cycleId) {
  const cycle = await db.getFirstAsync(
    "SELECT * FROM cycles WHERE id = ?",
    [cycleId]
  );
  if (!cycle) return { regular: 0, extra: 0 };

  // Total reservations (locked amounts not yet used)
  const resRows = await db.getAllAsync(
    "SELECT SUM(amount - amount_used) as locked FROM reservations WHERE cycle_id = ? AND is_complete = 0",
    [cycleId]
  );
  const totalReserved = resRows[0]?.locked ?? 0;

  // Total spent across all daily entries
  const spentRows = await db.getAllAsync(
    "SELECT SUM(amount_spent) as total FROM daily_entries WHERE cycle_id = ?",
    [cycleId]
  );
  const totalSpent = spentRows[0]?.total ?? 0;

  // Total extra cash in pool
  const extraRows = await db.getAllAsync(
    "SELECT SUM(extra_cash) as total FROM daily_entries WHERE cycle_id = ?",
    [cycleId]
  );
  const totalExtra = extraRows[0]?.total ?? 0;

  const regularPool =
    cycle.income -
    cycle.savings_amount -
    cycle.already_spent -
    totalReserved -
    totalSpent +
    (cycle.carryover_amount ?? 0);

  return {
    regular: Math.max(0, regularPool),
    extra: Math.max(0, totalExtra),
  };
}

export async function recalculateFromToday(db, cycleId) {
  // Surplus/deficit is automatically recalculated when getDailyBudget is called
  // because it divides the remaining pool by remaining days.
  // This function exists as a hook for any future forced recalc needs.
  return await getRemainingPool(db, cycleId);
}

// ─── Reservations ─────────────────────────────────────────────────────────────

export async function getReservations(db, cycleId) {
  return await db.getAllAsync(
    `SELECT r.*, t.name, t.color
     FROM reservations r
     JOIN reservation_tags t ON r.tag_id = t.id
     WHERE r.cycle_id = ?
     ORDER BY r.id ASC`,
    [cycleId]
  );
}

export async function createReservation(db, cycleId, tagId, amount) {
  const result = await db.runAsync(
    "INSERT INTO reservations (cycle_id, tag_id, amount) VALUES (?, ?, ?)",
    [cycleId, tagId, amount]
  );
  return result.lastInsertRowId;
}

export async function useReservation(db, id, amount) {
  await db.runAsync(
    "UPDATE reservations SET amount_used = amount_used + ? WHERE id = ?",
    [amount, id]
  );
  // Mark complete if fully used
  const res = await db.getFirstAsync(
    "SELECT amount, amount_used FROM reservations WHERE id = ?",
    [id]
  );
  if (res && res.amount_used >= res.amount) {
    await db.runAsync(
      "UPDATE reservations SET is_complete = 1 WHERE id = ?",
      [id]
    );
  }
}

export async function releaseReservation(db, id) {
  await db.runAsync(
    "UPDATE reservations SET is_complete = 1, amount_used = amount WHERE id = ?",
    [id]
  );
}

// ─── Reservation Tags ─────────────────────────────────────────────────────────

export async function getReservationTags(db) {
  return await db.getAllAsync(
    "SELECT * FROM reservation_tags WHERE is_active = 1 ORDER BY name ASC"
  );
}

export async function createReservationTag(db, name, color) {
  const result = await db.runAsync(
    "INSERT INTO reservation_tags (name, color) VALUES (?, ?)",
    [name, color ?? "#4F46E5"]
  );
  return result.lastInsertRowId;
}

export async function deactivateReservationTag(db, id) {
  await db.runAsync(
    "UPDATE reservation_tags SET is_active = 0 WHERE id = ?",
    [id]
  );
}

// ─── Savings ─────────────────────────────────────────────────────────────────

export async function getSavingsBalance(db, cycleId) {
  const cycle = await db.getFirstAsync(
    "SELECT savings_amount FROM cycles WHERE id = ?",
    [cycleId]
  );
  if (!cycle) return 0;

  const txRows = await db.getAllAsync(
    `SELECT SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) as net
     FROM savings_transactions WHERE cycle_id = ?`,
    [cycleId]
  );
  const net = txRows[0]?.net ?? 0;
  return cycle.savings_amount + net;
}

export async function touchSavings(db, cycleId, amount, direction, reason, note) {
  const today = new Date().toISOString().split("T")[0];
  await db.runAsync(
    `INSERT INTO savings_transactions (cycle_id, date, amount, direction, reason, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [cycleId, today, amount, direction, reason, note]
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getCycleStats(db, cycleId) {
  const cycle = await db.getFirstAsync(
    "SELECT * FROM cycles WHERE id = ?",
    [cycleId]
  );
  if (!cycle) return null;

  const entries = await db.getAllAsync(
    "SELECT * FROM daily_entries WHERE cycle_id = ? ORDER BY date ASC",
    [cycleId]
  );

  const totalSpent = entries.reduce((s, e) => s + (e.amount_spent ?? 0), 0);
  const totalExtra = entries.reduce((s, e) => s + (e.extra_cash ?? 0), 0);
  const redDays = entries.filter((e) => e.flag === "red").length;
  const greenDays = entries.filter((e) => e.flag === "green").length;
  const daysLogged = entries.filter((e) => e.amount_spent > 0).length;

  return {
    cycle,
    totalSpent,
    totalExtra,
    redDays,
    greenDays,
    daysLogged,
    avgPerDay: daysLogged > 0 ? totalSpent / daysLogged : 0,
    entries,
  };
}

export async function getYearStats(db, year) {
  const cycles = await db.getAllAsync(
    "SELECT * FROM cycles WHERE start_date LIKE ? ORDER BY start_date ASC",
    [`${year}%`]
  );

  const results = await Promise.all(
    cycles.map(async (cycle) => {
      const stats = await getCycleStats(db, cycle.id);
      return stats;
    })
  );

  return results.filter(Boolean);
}

// ─── Reset ───────────────────────────────────────────────────────────────────

export async function resetDatabase(db) {
  await db.execAsync(`
    DELETE FROM savings_transactions;
    DELETE FROM reservations;
    DELETE FROM daily_entries;
    DELETE FROM cycles;
    DELETE FROM reservation_tags;

    INSERT OR IGNORE INTO reservation_tags (name, color) VALUES
      ('Food', '#4F46E5'),
      ('Transport', '#0EA5E9'),
      ('Luna', '#16A34A'),
      ('Emergency', '#DC2626'),
      ('Fun', '#D97706');
  `);
}
