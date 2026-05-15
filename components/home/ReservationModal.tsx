import type { ReservationRow } from '@/services/cycleService';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';

interface Props {
  reservation: ReservationRow | null;
  onClose: () => void;
  note: string;
  onChangeNote: (v: string) => void;
  marking: boolean;
  editMode: boolean;
  onStartEdit: () => void;
  editName: string;
  onChangeEditName: (v: string) => void;
  editAmount: string;
  onChangeEditAmount: (v: string) => void;
  onMarkUsed: () => void;
  onMarkUnused: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
}

export function ReservationModal({
  reservation, onClose,
  note, onChangeNote,
  marking, editMode, onStartEdit,
  editName, onChangeEditName,
  editAmount, onChangeEditAmount,
  onMarkUsed, onMarkUnused, onSaveEdit, onDelete,
}: Props) {
  if (!reservation) return null;

  const paid = !!reservation.paid_at;
  const paidDate = paid
    ? new Date(reservation.paid_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} style={{ width: '100%' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827' }}>
                  {reservation.name}
                </Text>
                <Text style={{ fontSize: 13, color: '#9CA3AF', fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
                  ৳{Math.floor(reservation.amount).toLocaleString()} reserved
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Pressable onPress={onStartEdit} hitSlop={8}>
                  <Text style={{ fontSize: 13, color: '#6B7280', fontFamily: 'PlusJakartaSans_500Medium' }}>Edit</Text>
                </Pressable>
                <Pressable onPress={onClose} hitSlop={8}>
                  <Text style={{ fontSize: 22, color: '#9CA3AF', lineHeight: 24, includeFontPadding: false }}>×</Text>
                </Pressable>
              </View>
            </View>

            {editMode && (
              <View style={{ backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <TextInput
                  value={editName}
                  onChangeText={onChangeEditName}
                  placeholder="Name"
                  placeholderTextColor="#D1D5DB"
                  style={{ borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#111827', marginBottom: 8 }}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, color: '#9CA3AF', marginRight: 6, fontFamily: 'PlusJakartaSans_400Regular' }}>৳</Text>
                  <TextInput
                    value={editAmount}
                    onChangeText={onChangeEditAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                    style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#111827' }}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={onDelete}
                    style={{ flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 12, backgroundColor: '#FEF2F2' }}
                  >
                    <Text style={{ fontSize: 13, color: '#EF4444', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Delete</Text>
                  </Pressable>
                  <Pressable
                    onPress={onSaveEdit}
                    disabled={marking}
                    style={{ flex: 2, paddingVertical: 11, alignItems: 'center', borderRadius: 12, backgroundColor: '#16A34A' }}
                  >
                    <Text style={{ fontSize: 13, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Save changes</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {paid ? (
              <>
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: '#16A34A', fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 }}>
                    ✓ Used on {paidDate}
                  </Text>
                  {reservation.paid_note ? (
                    <Text style={{ fontSize: 13, color: '#16A34A', fontFamily: 'PlusJakartaSans_400Regular' }}>
                      {reservation.paid_note}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={onMarkUnused}
                  disabled={marking}
                  style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB' }}
                >
                  <Text style={{ fontSize: 15, color: '#6B7280', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Mark as unused</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
                  Note (optional)
                </Text>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 }}>
                  <TextInput
                    value={note}
                    onChangeText={onChangeNote}
                    placeholder="e.g. paid via bKash"
                    placeholderTextColor="#D1D5DB"
                    style={{ fontSize: 15, color: '#111827', fontFamily: 'PlusJakartaSans_400Regular' }}
                    maxLength={60}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={onClose}
                    style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB' }}
                  >
                    <Text style={{ fontSize: 15, color: '#6B7280', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={onMarkUsed}
                    disabled={marking}
                    style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: '#16A34A' }}
                  >
                    {marking
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Mark as used</Text>
                    }
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
