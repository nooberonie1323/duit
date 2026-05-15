import type { ActiveCycleData } from '@/services/cycleService';
import type { EntryRow } from '@/services/entryService';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

interface Props {
  cycleData: ActiveCycleData;
  entries: EntryRow[];
  navPillOffset: number;
  insets: EdgeInsets;
  reviewNote: string;
  onChangeNote: (v: string) => void;
  confirming: boolean;
  onConfirm: () => void;
  onOpenAdd: () => void;
  onOpenEdit: (entry: EntryRow) => void;
  onDeleteEntry: (entry: EntryRow) => void;
}

export function ReviewState({
  cycleData, entries,
  navPillOffset, insets,
  reviewNote, onChangeNote,
  confirming, onConfirm,
  onOpenAdd, onOpenEdit, onDeleteEntry,
}: Props) {
  const totalSpent = entries.reduce((s, e) => s + e.amount, 0);
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: navPillOffset + 80 }}
        >
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F59E0B', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
              Daily review
            </Text>
            <Text style={{ fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#111827', letterSpacing: -0.5, marginBottom: 2 }}>
              How'd today go?
            </Text>
            <Text style={{ fontSize: 13, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular' }}>{dateStr}</Text>
          </View>

          <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827' }}>Spending</Text>
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: totalSpent > 0 ? '#111827' : '#D1D5DB' }}>
                ৳{totalSpent.toLocaleString()}
              </Text>
            </View>
            {entries.map(entry => (
              <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Pressable
                  onPress={() => onOpenEdit(entry)}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingLeft: 16, paddingRight: 8 }}
                >
                  <Text style={{ flex: 1, fontSize: 14, color: '#374151', fontFamily: 'PlusJakartaSans_400Regular' }} numberOfLines={1}>
                    {entry.note || 'general spending'}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#111827', fontFamily: 'PlusJakartaSans_600SemiBold', marginRight: 4 }}>
                    ৳{entry.amount.toLocaleString()}
                  </Text>
                </Pressable>
                <Pressable onPress={() => onDeleteEntry(entry)} hitSlop={8} style={{ paddingVertical: 13, paddingRight: 16, paddingLeft: 8 }}>
                  <Text style={{ fontSize: 18, color: '#EF4444', lineHeight: 20, includeFontPadding: false }}>×</Text>
                </Pressable>
              </View>
            ))}
            <Pressable onPress={onOpenAdd} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 }}>
              <Text style={{ fontSize: 20, color: '#16A34A', lineHeight: 22, includeFontPadding: false }}>+</Text>
              <Text style={{ fontSize: 14, color: '#16A34A', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Add spend</Text>
            </Pressable>
          </View>

          <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
              Notes (optional)
            </Text>
            <TextInput
              value={reviewNote}
              onChangeText={onChangeNote}
              placeholder="How was today? Anything to note..."
              placeholderTextColor="#D1D5DB"
              multiline
              style={{ fontSize: 14, color: '#111827', fontFamily: 'PlusJakartaSans_400Regular', minHeight: 72, textAlignVertical: 'top' }}
            />
          </View>
        </ScrollView>

        <View style={{ position: 'absolute', bottom: navPillOffset + 8, left: 16, right: 16 }}>
          <Pressable
            onPress={onConfirm}
            disabled={confirming}
            style={{ backgroundColor: '#16A34A', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            {confirming
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' }}>Confirm review</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
