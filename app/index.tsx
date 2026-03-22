import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { isOnboardingComplete } from '@/services/settingsService';

/**
 * Initial gate screen. Reads settings and redirects to either
 * the onboarding flow or the main tabs. Never shown to the user.
 */
export default function Index() {
  const db = useSQLiteContext();

  useEffect(() => {
    isOnboardingComplete(db).then((complete) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace(complete ? '/(tabs)' : ('/onboarding' as any));
    });
  }, [db]);

  return <View className="flex-1 bg-white" />;
}
