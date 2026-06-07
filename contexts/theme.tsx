import { Colors, type ColorTokens, type ThemeMode } from '@/constants/theme';
import { getSettings, updateSettings } from '@/services/settingsService';
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextType {
  mode: ThemeMode;
  colors: ColorTokens;
  setTheme: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await getSettings(db);
      if (!cancelled && settings && (settings.theme === 'light' || settings.theme === 'dark')) {
        setMode(settings.theme);
      }
    })();
    return () => { cancelled = true; };
  }, [db]);

  const setTheme = async (next: ThemeMode) => {
    setMode(next);
    await updateSettings(db, { theme: next });
  };

  return (
    <ThemeContext.Provider value={{ mode, colors: Colors[mode], setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function useThemeColors(): ColorTokens {
  return useTheme().colors;
}
