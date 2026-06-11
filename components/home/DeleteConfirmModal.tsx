import { useThemeColors } from '@/contexts/theme';
import type { EntryRow } from '@/services/entryService';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

interface Props {
  entry: EntryRow | null;
  onConfirm: () => void;
  onCancel: () => void;
  deleting?: boolean;
}

export function DeleteConfirmModal({ entry, onConfirm, onCancel, deleting = false }: Props) {
  const colors = useThemeColors();
  return (
    <Modal visible={!!entry} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        onPress={onCancel}
      >
        <Pressable onPress={() => {}} style={{ width: '100%' }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
            <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary, marginBottom: 8 }}>
              Delete entry?
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 24 }}>
              &quot;{entry?.note || 'general spending'}&quot; — ৳{entry?.amount.toLocaleString()} will be removed.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={onCancel}
                style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border }}
              >
                <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                disabled={deleting}
                style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: colors.error }}
              >
                {deleting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Delete</Text>
                }
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
