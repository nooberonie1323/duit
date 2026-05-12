import { getActiveCycle, type ActiveCycleData } from '@/services/cycleService';
import { getSettings } from '@/services/settingsService';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HomeData {
  name: string;
  cycleData: ActiveCycleData;
  todaySpends: Array<{ id: number; note: string; amount: number }>;
  todayExtraCash: Array<{ id: number; label: string; amount: number }>;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [settings, cycleData] = await Promise.all([
      getSettings(db),
      getActiveCycle(db),
    ]);

    if (!settings || !cycleData) {
      setData(null);
      setLoading(false);
      return;
    }

    // Today's staged entries — need a day row first. For now, no day row exists until first review.
    setData({
      name: settings.name,
      cycleData,
      todaySpends: [],
      todayExtraCash: [],
    });
    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load]);

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

  const { cycleData, name, todaySpends, todayExtraCash } = data;
  const totalSpent = todaySpends.reduce((s, e) => s + e.amount, 0);
  const leftToday = cycleData.dailyBudget - totalSpent;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

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
          marginHorizontal: 16,
          borderRadius: 20,
          shadowColor: '#16A34A',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 8,
        }}>
          <View style={{ backgroundColor: '#16A34A', borderRadius: 20, padding: 22, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', top: -35, right: -35, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.07)' }} />
            <View style={{ position: 'absolute', bottom: -55, left: -25, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' }}>
                {dateStr}
              </Text>
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
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#111827' }}>
              {totalSpent > 0 ? `৳${totalSpent.toLocaleString()}` : '৳0'}
            </Text>
          </View>

          {todaySpends.map(spend => (
            <View key={spend.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ flex: 1, fontSize: 14, color: '#374151', fontFamily: 'PlusJakartaSans_400Regular' }}>{spend.note || 'general spending'}</Text>
              <Text style={{ fontSize: 14, color: '#111827', fontFamily: 'PlusJakartaSans_600SemiBold', marginRight: 12 }}>
                ৳{spend.amount.toLocaleString()}
              </Text>
              <Pressable hitSlop={8}>
                <Text style={{ fontSize: 20, color: '#D1D5DB', lineHeight: 22, includeFontPadding: false }}>×</Text>
              </Pressable>
            </View>
          ))}

          <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 }}>
            <Text style={{ fontSize: 20, color: '#16A34A', lineHeight: 22, includeFontPadding: false }}>+</Text>
            <Text style={{ fontSize: 14, color: '#16A34A', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Add spend</Text>
          </Pressable>
        </View>

        <View style={{ height: 12 }} />

        {/* ── Extra Cash card ── */}
        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0EA5E9' }} />
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827' }}>Extra Cash</Text>
            {todayExtraCash.length > 0 && (
              <Text style={{ marginLeft: 'auto', fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#0EA5E9' }}>
                ৳{todayExtraCash.reduce((s, e) => s + e.amount, 0).toLocaleString()}
              </Text>
            )}
          </View>

          {todayExtraCash.map(ec => (
            <View key={ec.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ flex: 1, fontSize: 14, color: '#374151', fontFamily: 'PlusJakartaSans_400Regular' }}>{ec.label || 'extra cash'}</Text>
              <Text style={{ fontSize: 14, color: '#0EA5E9', fontFamily: 'PlusJakartaSans_600SemiBold', marginRight: 12 }}>
                ৳{ec.amount.toLocaleString()}
              </Text>
              <Pressable hitSlop={8}>
                <Text style={{ fontSize: 20, color: '#D1D5DB', lineHeight: 22, includeFontPadding: false }}>×</Text>
              </Pressable>
            </View>
          ))}

          <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 }}>
            <Text style={{ fontSize: 20, color: '#0EA5E9', lineHeight: 22, includeFontPadding: false }}>+</Text>
            <Text style={{ fontSize: 14, color: '#0EA5E9', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Add extra cash</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
