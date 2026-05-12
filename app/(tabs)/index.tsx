import { getActiveCycle, type ActiveCycleData } from '@/services/cycleService';
import {
  addEntry,
  deleteEntry,
  getOrCreateTodayDay,
  getTodayEntries,
  updateEntry,
  type EntryRow,
} from '@/services/entryService';
import { getSettings } from '@/services/settingsService';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HomeData {
  name: string;
  cycleData: ActiveCycleData;
  entries: EntryRow[];
}

interface EditingEntry {
  id: number;
  note: string;
  amount: number;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<EntryRow | null>(null);

  const load = useCallback(async () => {
    const [settings, cycleData] = await Promise.all([
      getSettings(db),
      getActiveCycle(db),
    ]);
    if (!settings || !cycleData) { setData(null); setLoading(false); return; }
    const entries = await getTodayEntries(db, cycleData.cycle.id);
    setData({ name: settings.name, cycleData, entries });
    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingEntry(null);
    setModalNote('');
    setModalAmount('');
    setShowModal(true);
  }

  function openEdit(entry: EntryRow) {
    setEditingEntry({ id: entry.id, note: entry.note, amount: entry.amount });
    setModalNote(entry.note);
    setModalAmount(String(entry.amount));
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingEntry(null);
    setModalNote('');
    setModalAmount('');
  }

  async function handleSave() {
    const amount = parseFloat(modalAmount);
    if (!amount || amount <= 0 || !data) return;
    setModalSaving(true);
    try {
      if (editingEntry) {
        await updateEntry(db, editingEntry.id, modalNote.trim(), amount);
      } else {
        const dayId = await getOrCreateTodayDay(db, data.cycleData.cycle.id, data.cycleData.dailyBudget);
        await addEntry(db, dayId, modalNote.trim(), amount);
      }
      closeModal();
      await load();
    } catch (e) {
      console.error('[spend save error]', e);
    } finally {
      setModalSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDeleteEntry) return;
    try {
      await deleteEntry(db, confirmDeleteEntry.id);
      setConfirmDeleteEntry(null);
      await load();
    } catch (e) {
      console.error('[spend delete error]', e);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#16A34A" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14 }}>
          No active cycle found.
        </Text>
      </View>
    );
  }

  const { cycleData, entries } = data;
  const totalSpent = entries.reduce((s, e) => s + e.amount, 0);
  const leftToday = cycleData.dailyBudget - totalSpent;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const amountValid = parseFloat(modalAmount) > 0;

  const card = {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 16,
    shadowColor: '#000' as const,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 120 }}
      >
        {/* ── Hero card ── */}
        <View style={{
          marginHorizontal: 16, borderRadius: 20,
          shadowColor: '#16A34A', shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
        }}>
          <View style={{ backgroundColor: '#16A34A', borderRadius: 20, padding: 22, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', top: -35, right: -35, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.07)' }} />
            <View style={{ position: 'absolute', bottom: -55, left: -25, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' }}>{dateStr}</Text>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                  Day {cycleData.dayOfCycle} of {cycleData.totalDays}
                </Text>
              </View>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
              Left today
            </Text>
            <Text style={{ color: '#fff', fontSize: 52, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -2, lineHeight: 56 }}>
              ৳{Math.max(0, Math.floor(leftToday)).toLocaleString()}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 8 }}>
              of ৳{Math.floor(cycleData.dailyBudget).toLocaleString()} daily budget
            </Text>
          </View>
        </View>

        <View style={{ height: 12 }} />

        {/* ── Cycle Overview ── */}
        <View style={card}>
          <View style={{ flexDirection: 'row', paddingVertical: 18 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827', marginBottom: 4 }}>
                ৳{Math.floor(cycleData.leftInCycle).toLocaleString()}
              </Text>
              <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' }}>Left in cycle</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#F3F4F6', marginVertical: 4 }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827', marginBottom: 4 }}>
                {cycleData.daysLeft}
              </Text>
              <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' }}>Days left</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#F3F4F6', marginVertical: 4 }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: '#9CA3AF', marginBottom: 4 }}>—</Text>
              <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' }}>Daily avg</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 12 }} />

        {/* ── Spending card ── */}
        <View style={card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827' }}>Spending</Text>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: totalSpent > 0 ? '#111827' : '#D1D5DB' }}>
              ৳{totalSpent.toLocaleString()}
            </Text>
          </View>
          <Pressable onPress={openAdd} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 }}>
            <Text style={{ fontSize: 20, color: '#16A34A', lineHeight: 22, includeFontPadding: false }}>+</Text>
            <Text style={{ fontSize: 14, color: '#16A34A', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Add spend</Text>
          </Pressable>
        </View>

        {/* ── Log card ── */}
        {entries.length > 0 && (
          <>
            <View style={{ height: 12 }} />
            <View style={{ ...card, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#6B7280' }}>Today's log</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' }}>{entries.length} {entries.length === 1 ? 'item' : 'items'}</Text>
              </View>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 280 }}
              >
                {entries.map((entry, i) => (
                  <View
                    key={entry.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      borderBottomWidth: i < entries.length - 1 ? 1 : 0,
                      borderBottomColor: '#F3F4F6',
                    }}
                  >
                    <Pressable
                      onPress={() => openEdit(entry)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingLeft: 16, paddingRight: 8 }}
                    >
                      <Text style={{ flex: 1, fontSize: 14, color: '#374151', fontFamily: 'PlusJakartaSans_400Regular' }} numberOfLines={1}>
                        {entry.note || 'general spending'}
                      </Text>
                      <Text style={{ fontSize: 14, color: '#111827', fontFamily: 'PlusJakartaSans_600SemiBold', marginRight: 4 }}>
                        ৳{entry.amount.toLocaleString()}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setConfirmDeleteEntry(entry)}
                      hitSlop={8}
                      style={{ paddingVertical: 13, paddingRight: 16, paddingLeft: 8 }}
                    >
                      <Text style={{ fontSize: 18, color: '#EF4444', lineHeight: 20, includeFontPadding: false }}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Add / Edit modal ── */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={closeModal}
        >
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827' }}>
                    {editingEntry ? 'Edit spend' : 'Add spend'}
                  </Text>
                  <Pressable onPress={closeModal} hitSlop={8}>
                    <Text style={{ fontSize: 22, color: '#9CA3AF', lineHeight: 24, includeFontPadding: false }}>×</Text>
                  </Pressable>
                </View>

                {/* Note field */}
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
                  Note (optional)
                </Text>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 }}>
                  <TextInput
                    value={modalNote}
                    onChangeText={setModalNote}
                    placeholder="What did you spend on?"
                    placeholderTextColor="#D1D5DB"
                    style={{ fontSize: 15, color: '#111827', fontFamily: 'PlusJakartaSans_400Regular' }}
                    maxLength={60}
                    returnKeyType="next"
                  />
                </View>

                {/* Amount field */}
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
                  Amount
                </Text>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1.5, borderColor: amountValid ? '#16A34A' : '#E5E7EB', paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: 18, color: modalAmount ? '#111827' : '#D1D5DB', fontFamily: 'PlusJakartaSans_700Bold', marginRight: 4 }}>৳</Text>
                  <TextInput
                    value={modalAmount}
                    onChangeText={v => setModalAmount(v.replace(/[^0-9.]/g, ''))}
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                    keyboardType="decimal-pad"
                    style={{ flex: 1, fontSize: 22, color: '#111827', fontFamily: 'PlusJakartaSans_700Bold' }}
                  />
                </View>

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={closeModal}
                    style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB' }}
                  >
                    <Text style={{ fontSize: 15, color: '#6B7280', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    disabled={!amountValid || modalSaving}
                    style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: amountValid ? '#16A34A' : '#E5E7EB' }}
                  >
                    {modalSaving
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={{ fontSize: 15, color: amountValid ? '#fff' : '#9CA3AF', fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                          {editingEntry ? 'Save' : 'Add'}
                        </Text>
                    }
                  </Pressable>
                </View>

            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {/* ── Confirm delete modal ── */}
      <Modal visible={!!confirmDeleteEntry} transparent animationType="fade" onRequestClose={() => setConfirmDeleteEntry(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={() => setConfirmDeleteEntry(null)}
        >
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
              <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827', marginBottom: 8 }}>
                Delete entry?
              </Text>
              <Text style={{ fontSize: 14, color: '#6B7280', fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 24 }}>
                "{confirmDeleteEntry?.note || 'general spending'}" — ৳{confirmDeleteEntry?.amount.toLocaleString()} will be removed.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setConfirmDeleteEntry(null)}
                  style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB' }}
                >
                  <Text style={{ fontSize: 15, color: '#6B7280', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleDelete}
                  style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: '#EF4444' }}
                >
                  <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
