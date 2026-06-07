import { useThemeColors } from '@/contexts/theme';
import { fromDateStr } from '@/lib/db';
import type { EntryRow } from '@/services/entryService';
import type { MissedDay } from '@/services/reviewService';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

interface Props {
  missedDays: MissedDay[];
  missedEntries: EntryRow[];
  navPillOffset: number;
  insets: EdgeInsets;
  catchUpAmount: string;
  onChangeAmount: (v: string) => void;
  catchUpNote: string;
  onChangeNote: (v: string) => void;
  confirming: boolean;
  onConfirm: () => void;
}

export function MissedReviewState({
  missedDays, missedEntries,
  navPillOffset, insets,
  catchUpAmount, onChangeAmount,
  catchUpNote, onChangeNote,
  confirming, onConfirm,
}: Props) {
  const colors = useThemeColors();
  const firstDate = fromDateStr(missedDays[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const lastDate = fromDateStr(missedDays[missedDays.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dateLabel = missedDays.length === 1 ? firstDate : `${firstDate} – ${lastDate}`;
  const stagedTotal = missedEntries.reduce((s, e) => s + e.amount, 0);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 24) + navPillOffset }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.warning, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
          Missed review
        </Text>
        <Text style={{ fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 6 }}>
          Catch up first.
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 24 }}>
          {missedDays.length === 1
            ? `You missed your review on ${dateLabel}.`
            : `You missed ${missedDays.length} reviews (${dateLabel}).`
          } How much did you spend?
        </Text>

        {missedEntries.length > 0 && (
          <View style={{ backgroundColor: colors.card, borderRadius: 20, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary }}>
                Logged entries ({missedEntries.length})
              </Text>
            </View>
            {missedEntries.map((e, i) => (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: i < missedEntries.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                <Text style={{ flex: 1, fontSize: 14, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }} numberOfLines={1}>
                  {e.note || 'general spending'}
                </Text>
                <Text style={{ fontSize: 14, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                  ৳{e.amount.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
          Total spent{missedDays.length > 1 ? ' (all days combined)' : ''}
        </Text>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 20, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_700Bold', marginRight: 6 }}>৳</Text>
          <TextInput
            value={catchUpAmount}
            onChangeText={onChangeAmount}
            keyboardType="numeric"
            placeholder={stagedTotal > 0 ? String(Math.floor(stagedTotal)) : '0'}
            placeholderTextColor={colors.textSecondary}
            style={{ flex: 1, fontSize: 22, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_700Bold' }}
            autoFocus
          />
        </View>

        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
          Note (optional)
        </Text>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 24 }}>
          <TextInput
            value={catchUpNote}
            onChangeText={onChangeNote}
            placeholder="Add a note…"
            placeholderTextColor={colors.textSecondary}
            style={{ fontSize: 15, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }}
            multiline
          />
        </View>

        <Pressable
          onPress={onConfirm}
          disabled={confirming}
          style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
        >
          {confirming
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' }}>Confirm & continue</Text>
          }
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
