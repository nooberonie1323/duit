import type { SQLiteDatabase } from 'expo-sqlite';

export interface Settings {
  id: number;
  name: string;
  review_time: number;
  notifications_enabled: number;
  theme: string;
}

export async function isOnboardingComplete(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM settings WHERE id = 1');
  return row !== null;
}

export async function saveSettings(db: SQLiteDatabase, name: string): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (id, name) VALUES (1, ?)',
    [name]
  );
}

export async function getSettings(db: SQLiteDatabase): Promise<Settings | null> {
  return db.getFirstAsync<Settings>('SELECT * FROM settings WHERE id = 1');
}

export async function resetAppData(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await db.execAsync('DELETE FROM cycles');
    await db.execAsync('DELETE FROM settings');
    await db.execAsync('DELETE FROM onboarding_state');
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

export async function updateSettings(
  db: SQLiteDatabase,
  patch: Partial<Omit<Settings, 'id'>>
): Promise<void> {
  const fields = Object.keys(patch) as (keyof Omit<Settings, 'id'>)[];
  if (fields.length === 0) return;
  const setClauses = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => patch[f]);
  await db.runAsync(
    `UPDATE settings SET ${setClauses} WHERE id = 1`,
    values as (string | number)[]
  );
}
