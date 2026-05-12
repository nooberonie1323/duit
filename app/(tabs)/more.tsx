import { getSettings, updateSettings, type Settings } from '@/services/settingsService';
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
  { label: 'System', value: 'system' },
];

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

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
  }

  async function handleNotifications(value: boolean) {
    if (!settings) return;
    await updateSettings(db, { notifications_enabled: value ? 1 : 0 });
    setSettings({ ...settings, notifications_enabled: value ? 1 : 0 });
  }

  async function handleTheme(value: string) {
    if (!settings) return;
    await updateSettings(db, { theme: value });
    setSettings({ ...settings, theme: value });
  }

  function openNameEdit() {
    if (!settings) return;
    setNameInput(settings.name);
    setEditingName(true);
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

        <Text style={{ fontSize: 12, color: '#D1D5DB', fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', marginTop: 28 }}>
          Duit · v0.1.0
        </Text>
      </ScrollView>

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
