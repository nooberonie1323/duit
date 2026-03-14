import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, DMSans_800ExtraBold } from "@expo-google-fonts/dm-sans";
import * as SplashScreen from "expo-splash-screen";
import { initDatabase, getActiveCycle } from "../services/db";
import "../global.css";
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    
    <GluestackUIProvider mode="light">
      <SQLiteProvider databaseName="duit.db" onInit={initDatabase}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="onboarding2" />
        <Stack.Screen name="onboarding3" />
        <Stack.Screen name="onboarding4" />
        <Stack.Screen name="onboarding5" />
      </Stack>
    </SQLiteProvider>
    </GluestackUIProvider>
  
  );
}
