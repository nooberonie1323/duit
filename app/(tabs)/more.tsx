import { useTheme } from '@/contexts/theme';
import { getSettings, resetAppData, updateSettings, type Settings } from '@/services/settingsService';
import { cancelReviewNotifications, requestNotificationPermission, scheduleReviewNotifications } from '@/services/notificationService';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const db = useSQLiteContext();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready'>('idle');

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
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#16A34A" />
      </View>
    );
  }

  if (!settings) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' }}>No settings found.</Text>
      </View>
    );
  }

  const navPillOffset = Math.max(insets.bottom, 16) + 76;

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.5 }}>
          More
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: navPillOffset + 16 }}
      >
        {/* Profile */}
        <Text style={styles.sectionLabel}>Profile</Text>
        <View style={styles.card}>
          <Pressable
            onPress={openNameEdit}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
          >
            <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#111827' }}>Name</Text>
            <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'PlusJakartaSans_400Regular', marginRight: 8 }}>
              {settings.name}
            </Text>
            <Text style={{ fontSize: 16, color: '#D1D5DB' }}>›</Text>
          </Pressable>
        </View>

        {/* Daily review */}
        <Text style={styles.sectionLabel}>Daily review</Text>
        <View style={styles.card}>
          <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#111827', marginBottom: 12 }}>
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
                      backgroundColor: active ? '#16A34A' : '#F3F4F6',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontFamily: active ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_400Regular',
                      color: active ? '#fff' : '#6B7280',
                    }}>
                      {rt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#111827' }}>
                Notifications
              </Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
                Remind me at review time
              </Text>
            </View>
            <Switch
              value={settings.notifications_enabled === 1}
              onValueChange={handleNotifications}
              trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
              thumbColor={settings.notifications_enabled === 1 ? '#16A34A' : '#fff'}
            />
          </View>
        </View>

        {/* Appearance */}
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.card}>
          <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#111827', marginBottom: 12 }}>
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
                      backgroundColor: active ? '#16A34A' : '#F3F4F6',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontFamily: active ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_400Regular',
                      color: active ? '#fff' : '#6B7280',
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
        <Text style={styles.sectionLabel}>App</Text>
        <View style={styles.card}>
          {/* Check for updates row */}
          {(updateStatus === 'idle' || updateStatus === 'checking' || updateStatus === 'up-to-date') && (
            <Pressable
              onPress={handleCheckUpdate}
              disabled={updateStatus === 'checking'}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
            >
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#111827' }}>
                Check for updates
              </Text>
              {updateStatus === 'checking' && <ActivityIndicator size="small" color="#16A34A" />}
              {updateStatus === 'up-to-date' && <Text style={{ fontSize: 13, color: '#16A34A', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Up to date ✓</Text>}
            </Pressable>
          )}
          {/* Download update row */}
          {updateStatus === 'available' && (
            <Pressable
              onPress={handleDownloadUpdate}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
            >
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#111827' }}>Update available</Text>
              <Text style={{ fontSize: 13, color: '#16A34A', fontFamily: 'PlusJakartaSans_700Bold' }}>Download →</Text>
            </Pressable>
          )}
          {/* Downloading row */}
          {updateStatus === 'downloading' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}>
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#111827' }}>Downloading...</Text>
              <ActivityIndicator size="small" color="#16A34A" />
            </View>
          )}
          {/* Restart row */}
          {updateStatus === 'ready' && (
            <Pressable
              onPress={() => Updates.reloadAsync()}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
            >
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#111827' }}>Update downloaded</Text>
              <Text style={{ fontSize: 13, color: '#16A34A', fontFamily: 'PlusJakartaSans_700Bold' }}>Restart →</Text>
            </Pressable>
          )}
        </View>

        {/* Danger zone */}
        <Text style={[styles.sectionLabel, { color: '#EF4444' }]}>Danger zone</Text>
        <View style={styles.card}>
          <Pressable
            onPress={() => setConfirmReset(true)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
          >
            <Text style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#EF4444' }}>Reset all data</Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: 12, color: '#D1D5DB', fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', marginTop: 28 }}>
          Duit · v0.1.0
        </Text>
      </ScrollView>

      {/* Reset confirmation modal */}
      <Modal visible={confirmReset} transparent animationType="fade" onRequestClose={() => setConfirmReset(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={() => !resetting && setConfirmReset(false)}
        >
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
              <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827', marginBottom: 8 }}>
                Reset all data?
              </Text>
              <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20, marginBottom: 24 }}>
                This will permanently delete all cycles, spending history, and settings. The app will restart from scratch.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setConfirmReset(false)}
                  disabled={resetting}
                  style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB' }}
                >
                  <Text style={{ fontSize: 15, color: '#6B7280', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleReset}
                  disabled={resetting}
                  style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: '#EF4444' }}
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
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24 }}>
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827', marginBottom: 16 }}>
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
                  borderColor: '#E5E7EB',
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  fontFamily: 'PlusJakartaSans_400Regular',
                  color: '#111827',
                  marginBottom: 16,
                }}
              />
              <Pressable
                onPress={handleSaveName}
                style={{ backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
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
    color: '#9CA3AF',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    marginTop: 20,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};
