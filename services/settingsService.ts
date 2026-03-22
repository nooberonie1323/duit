import { type SQLiteDatabase } from 'expo-sqlite';

export interface Settings {
  id: number;
  name: string;
  notifications_enabled: number;
  review_time: string;
  theme: string;
  onboarding_complete: number;
}

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const row = await db.getFirstAsync<Settings>('SELECT * FROM settings WHERE id = 1');
  if (!row) throw new Error('Settings row missing — was migrateDb run?');
  return row;
}

export async function updateSettings(
  db: SQLiteDatabase,
  updates: Partial<Omit<Settings, 'id'>>
): Promise<void> {
  const fields = Object.keys(updates) as (keyof typeof updates)[];
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => updates[f] ?? null);
  await db.runAsync(`UPDATE settings SET ${setClauses} WHERE id = 1`, values);
}

export async function isOnboardingComplete(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ onboarding_complete: number }>(
    'SELECT onboarding_complete FROM settings WHERE id = 1'
  );
  return (row?.onboarding_complete ?? 0) === 1;
}
