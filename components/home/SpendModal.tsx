import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  editingEntry: { id: number; note: string; amount: number } | null;
  note: string;
  onChangeNote: (v: string) => void;
  amount: string;
  onChangeAmount: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  canSave: boolean;
  poolExhausted: boolean;
  hardCapError: string | null;
  thresholdWarning: string | null;
}

export function SpendModal({
  visible, onClose, editingEntry,
  note, onChangeNote, amount, onChangeAmount,
  saving, onSave, canSave, poolExhausted,
  hardCapError, thresholdWarning,
}: Props) {
  const amountNum = parseFloat(amount) || 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} style={{ width: '100%' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827' }}>
                {editingEntry ? 'Edit spend' : 'Add spend'}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={{ fontSize: 22, color: '#9CA3AF', lineHeight: 24, includeFontPadding: false }}>×</Text>
              </Pressable>
            </View>

            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
              Note (optional)
            </Text>
            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 }}>
              <TextInput
                value={note}
                onChangeText={onChangeNote}
                placeholder="What did you spend on?"
                placeholderTextColor="#D1D5DB"
                style={{ fontSize: 15, color: '#111827', fontFamily: 'PlusJakartaSans_400Regular' }}
                maxLength={60}
                returnKeyType="next"
              />
            </View>

            {poolExhausted && (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: '#EF4444', fontFamily: 'PlusJakartaSans_500Medium' }}>
                  Your pool is empty — no budget remaining this cycle.
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
              Amount
            </Text>
            <View style={{
              backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1.5,
              borderColor: hardCapError ? '#EF4444' : amountNum > 0 ? '#16A34A' : '#E5E7EB',
              paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center',
              marginBottom: hardCapError || thresholdWarning ? 8 : 20,
            }}>
              <Text style={{ fontSize: 18, color: amount ? '#111827' : '#D1D5DB', fontFamily: 'PlusJakartaSans_700Bold', marginRight: 4 }}>৳</Text>
              <TextInput
                value={amount}
                onChangeText={onChangeAmount}
                placeholder="0"
                placeholderTextColor="#D1D5DB"
                keyboardType="decimal-pad"
                editable={!poolExhausted}
                style={{ flex: 1, fontSize: 22, color: '#111827', fontFamily: 'PlusJakartaSans_700Bold' }}
              />
            </View>

            {hardCapError && (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: '#EF4444', fontFamily: 'PlusJakartaSans_500Medium' }}>{hardCapError}</Text>
              </View>
            )}

            {thresholdWarning && (
              <View style={{ backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: '#92400E', fontFamily: 'PlusJakartaSans_400Regular' }}>⚡ {thresholdWarning}</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: hardCapError || thresholdWarning ? 8 : 0 }}>
              <Pressable
                onPress={onClose}
                style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB' }}
              >
                <Text style={{ fontSize: 15, color: '#6B7280', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onSave}
                disabled={!canSave || saving}
                style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: canSave ? '#16A34A' : '#E5E7EB' }}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontSize: 15, color: canSave ? '#fff' : '#9CA3AF', fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                      {editingEntry ? 'Save' : 'Add'}
                    </Text>
                }
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
