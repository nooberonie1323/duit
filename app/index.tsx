import { isOnboardingComplete } from '@/services/settingsService';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

export default function Index() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams();
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    isOnboardingComplete(db)
      .then(complete => {
        const base = complete ? '/(tabs)' : '/onboarding';
        const query = new URLSearchParams(params as Record<string, string>).toString();
        setDestination(query ? `${base}?${query}` : base);
      })
      .catch(() => setDestination('/onboarding'));
  }, [db]);

  if (destination === null) {
    return <View style={{ flex: 1, backgroundColor: '#F9FAFB' }} />;
  }

  return <Redirect href={destination as any} />;
}
