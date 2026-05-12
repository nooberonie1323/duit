import { isOnboardingComplete } from '@/services/settingsService';
import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

export default function Index() {
  const db = useSQLiteContext();
  const [destination, setDestination] = useState<'/(tabs)' | '/onboarding' | null>(null);

  useEffect(() => {
    isOnboardingComplete(db)
      .then(complete => setDestination(complete ? '/(tabs)' : '/onboarding'))
      .catch(() => setDestination('/onboarding'));
  }, [db]);

  if (destination === null) {
    return <View style={{ flex: 1, backgroundColor: '#F9FAFB' }} />;
  }

  return <Redirect href={destination} />;
}
