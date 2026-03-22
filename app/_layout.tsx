import '../global.css';
import { SQLiteProvider } from 'expo-sqlite';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { migrateDb } from '@/lib/db';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="duit_v1.db" onInit={migrateDb}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
      </Stack>
      <StatusBar style="auto" />
    </SQLiteProvider>
  );
}
