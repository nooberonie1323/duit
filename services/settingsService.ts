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
