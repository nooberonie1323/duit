import { useTheme, useThemeColors } from '@/contexts/theme';
import { getSettings, resetAppData, updateSettings, type Settings } from '@/services/settingsService';
import { cancelReviewNotifications, requestNotificationPermission, scheduleReviewNotifications } from '@/services/notificationService';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SeedEntry {
  type: 'spend' | 'extra_cash';
  amount: number;
  note: string;
  time: string;
}

interface SeedDay {
  date: string;
  daily_budget: number;
  total_spent: number;
  pool_after_review: number;
  reviewed_at: string | null;
  entries: SeedEntry[];
}

interface SeedReservation {
  name: string;
  amount: number;
}

interface SeedCycle {
  start_date: string;
  end_date: string;
  income: number;
  already_spent: number;
  savings: number;
  budget_alert: number;
  pool_leftover: number;
  reservations: SeedReservation[];
  days: SeedDay[];
}

interface SeedFile {
  cycles: SeedCycle[];
}

const REVIEW_TIMES = [
  { label: '8 PM', value: 20 },
  { label: '9 PM', value: 21 },
  { label: '10 PM', value: 22 },
  { label: '11 PM', value: 23 },
];

const THEMES = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
] as const;


export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const db = useSQLiteContext();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready'>('idle');
  const [seedStatus, setSeedStatus] = useState<'idle' | 'seeding' | 'done' | 'error'>('idle');
  const [seedMessage, setSeedMessage] = useState('');

  const load = useCallback(async () => {
    const s = await getSettings(db);
    setSettings(s);
    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  async function handleReviewTime(value: number) {
    if (!settings) return;
    await updateSettings(db, { review_time: value });
    setSettings({ ...settings, review_time: value });
    if (settings.notifications_enabled === 1) {
      await scheduleReviewNotifications(value);
    }
  }

  async function handleNotifications(value: boolean) {
    if (!settings) return;
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      await scheduleReviewNotifications(settings.review_time);
    } else {
      await cancelReviewNotifications();
    }
    await updateSettings(db, { notifications_enabled: value ? 1 : 0 });
    setSettings({ ...settings, notifications_enabled: value ? 1 : 0 });
  }

  async function handleTheme(value: 'light' | 'dark') {
    if (!settings) return;
    await setTheme(value);
    setSettings({ ...settings, theme: value });
  }

  function openNameEdit() {
    if (!settings) return;
    setNameInput(settings.name);
    setEditingName(true);
  }

  async function handleReset() {
    if (resetting) return;
    setResetting(true);
    try {
      await cancelReviewNotifications();
      await resetAppData(db);
      router.replace('/');
    } catch {
      setResetting(false);
      setConfirmReset(false);
    }
  }

  async function handleCheckUpdate() {
    if (!Updates.isEnabled || updateStatus === 'checking' || updateStatus === 'downloading') return;
    setUpdateStatus('checking');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setUpdateStatus('available');
      } else {
        setUpdateStatus('up-to-date');
        setTimeout(() => setUpdateStatus('idle'), 3000);
      }
    } catch {
      setUpdateStatus('idle');
    }
  }

  async function handleDownloadUpdate() {
    setUpdateStatus('downloading');
    try {
      await Updates.fetchUpdateAsync();
      setUpdateStatus('ready');
    } catch {
      setUpdateStatus('idle');
    }
  }

  async function handleSaveName() {
    if (!settings || !nameInput.trim()) return;
    await updateSettings(db, { name: nameInput.trim() });
    setSettings({ ...settings, name: nameInput.trim() });
    setEditingName(false);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!settings) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>No settings found.</Text>
      </View>
    );
  }

  const navPillOffset = Math.max(insets.bottom, 16) + 76;

  async function seedFromJson(json: SeedFile) {
    setSeedStatus('seeding');
    setSeedMessage('Seeding…');
    let cyclesInserted = 0;
    let daysInserted = 0;
    let entriesInserted = 0;
    try {
      for (const cycle of json.cycles) {
        await db.execAsync('BEGIN');
        try {
          const cycleResult = await db.runAsync(
            `INSERT INTO cycles (start_date, end_date, income, already_spent, savings, budget_alert, start_from_today, pool_leftover)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
            [cycle.start_date, cycle.end_date, cycle.income, cycle.already_spent ?? 0, cycle.savings ?? 0, cycle.budget_alert ?? 0, cycle.pool_leftover ?? 0]
          );
          const cycleId = cycleResult.lastInsertRowId;

          for (const res of cycle.reservations ?? []) {
            await db.runAsync(
              'INSERT INTO reservations (cycle_id, name, amount) VALUES (?, ?, ?)',
              [cycleId, res.name, res.amount]
            );
          }

          for (const day of cycle.days ?? []) {
            const dayResult = await db.runAsync(
              `INSERT INTO days (cycle_id, date, daily_budget, total_spent, pool_after_review, reviewed_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [cycleId, day.date, day.daily_budget, day.total_spent, day.pool_after_review ?? null, day.reviewed_at ?? null]
            );
            const dayId = dayResult.lastInsertRowId;
            daysInserted++;

            for (const entry of day.entries ?? []) {
              await db.runAsync(
                `INSERT INTO entries (day_id, type, amount, note, time, staged)
                 VALUES (?, ?, ?, ?, ?, 0)`,
                [dayId, entry.type, entry.amount, entry.note ?? '', entry.time]
              );
              entriesInserted++;
            }
          }

          await db.execAsync('COMMIT');
          cyclesInserted++;
        } catch (e) {
          await db.execAsync('ROLLBACK');
          throw e;
        }
      }
      setSeedStatus('done');
      setSeedMessage(`✓ Inserted ${cyclesInserted} cycles, ${daysInserted} days, ${entriesInserted} entries`);
    } catch (e) {
      console.error('[DevSeed]', e);
      setSeedStatus('error');
      setSeedMessage('Error seeding data — check console.');
    }
  }

  function handlePickSeedFile() {
    if (Platform.OS !== 'web') {
      setSeedStatus('error');
      setSeedMessage('File seed only available on web.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target?.result as string) as SeedFile;
          seedFromJson(parsed);
        } catch {
          setSeedStatus('error');
          setSeedMessage('Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -0.5 }}>
          More
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: navPillOffset + 16 }}
      >
        {/* Profile */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Profile</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Pressable
            onPress={openNameEdit}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
          >
            <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary }}>Name</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginRight: 8 }}>
              {settings.name}
            </Text>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>›</Text>
          </Pressable>
        </View>

        {/* Daily review */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Daily review</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary, marginBottom: 12 }}>
              Review time
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {REVIEW_TIMES.map(rt => {
                const active = settings.review_time === rt.value;
                return (
                  <Pressable
                    key={rt.value}
                    onPress={() => handleReviewTime(rt.value)}
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      borderRadius: 20,
                      backgroundColor: active ? colors.primary : colors.background,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontFamily: active ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_400Regular',
                      color: active ? '#fff' : colors.textSecondary,
                    }}>
                      {rt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary }}>
                Notifications
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
                Remind me at review time
              </Text>
            </View>
            <Switch
              value={settings.notifications_enabled === 1}
              onValueChange={handleNotifications}
              trackColor={{ false: colors.border, true: '#86EFAC' }}
              thumbColor={settings.notifications_enabled === 1 ? colors.primary : '#fff'}
            />
          </View>
        </View>

        {/* Appearance */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary, marginBottom: 12 }}>
              Theme
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {THEMES.map(t => {
                const active = settings.theme === t.value;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => handleTheme(t.value)}
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      borderRadius: 20,
                      backgroundColor: active ? colors.primary : colors.background,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontFamily: active ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_400Regular',
                      color: active ? '#fff' : colors.textSecondary,
                    }}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* App */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>App</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Check for updates row */}
          {(updateStatus === 'idle' || updateStatus === 'checking' || updateStatus === 'up-to-date') && (
            <Pressable
              onPress={handleCheckUpdate}
              disabled={updateStatus === 'checking'}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
            >
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary }}>
                Check for updates
              </Text>
              {updateStatus === 'checking' && <ActivityIndicator size="small" color={colors.primary} />}
              {updateStatus === 'up-to-date' && <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Up to date ✓</Text>}
            </Pressable>
          )}
          {/* Download update row */}
          {updateStatus === 'available' && (
            <Pressable
              onPress={handleDownloadUpdate}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
            >
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary }}>Update available</Text>
              <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }}>Download →</Text>
            </Pressable>
          )}
          {/* Downloading row */}
          {updateStatus === 'downloading' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}>
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary }}>Downloading...</Text>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
          {/* Restart row */}
          {updateStatus === 'ready' && (
            <Pressable
              onPress={() => Updates.reloadAsync()}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
            >
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary }}>Update downloaded</Text>
              <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }}>Restart →</Text>
            </Pressable>
          )}
        </View>

        {/* Danger zone */}
        <Text style={[styles.sectionLabel, { color: colors.error }]}>Danger zone</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Pressable
            onPress={() => setConfirmReset(true)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
          >
            <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.error }}>Reset all data</Text>
          </Pressable>
        </View>

        {__DEV__ && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.warning }]}>Developer</Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Pressable
                onPress={handlePickSeedFile}
                disabled={seedStatus === 'seeding'}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
              >
                <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.warning }}>
                  {seedStatus === 'seeding' ? 'Seeding…' : 'Seed data from JSON'}
                </Text>
                {seedStatus === 'seeding'
                  ? <ActivityIndicator size="small" color={colors.warning} />
                  : <Text style={{ fontSize: 13, color: colors.warning, fontFamily: 'PlusJakartaSans_600SemiBold' }}>↑ Upload</Text>
                }
              </Pressable>
              {seedMessage ? (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                  <Text style={{
                    fontSize: 12,
                    fontFamily: 'PlusJakartaSans_400Regular',
                    color: seedStatus === 'error' ? colors.error : seedStatus === 'done' ? colors.primary : colors.textSecondary,
                  }}>
                    {seedMessage}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        )}

        <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', marginTop: 28 }}>
          duit · v1.0.0
        </Text>
      </ScrollView>

      {/* Reset confirmation modal */}
      <Modal visible={confirmReset} transparent animationType="fade" onRequestClose={() => setConfirmReset(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={() => !resetting && setConfirmReset(false)}
        >
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            <View style={{ backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
              <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary, marginBottom: 8 }}>
                Reset all data?
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20, marginBottom: 24 }}>
                This will permanently delete all cycles, spending history, and settings. The app will restart from scratch.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setConfirmReset(false)}
                  disabled={resetting}
                  style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border }}
                >
                  <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleReset}
                  disabled={resetting}
                  style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: colors.error }}
                >
                  {resetting
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Reset</Text>
                  }
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Name edit modal */}
      <Modal visible={editingName} transparent animationType="fade" onRequestClose={() => setEditingName(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={() => setEditingName(false)}
        >
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24 }}>
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary, marginBottom: 16 }}>
                Edit name
              </Text>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  fontFamily: 'PlusJakartaSans_400Regular',
                  color: colors.textPrimary,
                  marginBottom: 16,
                }}
              />
              <Pressable
                onPress={handleSaveName}
                style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' }}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = {
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    marginTop: 20,
    marginLeft: 4,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};
