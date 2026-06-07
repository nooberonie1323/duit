/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export interface ColorTokens {
  background: string;
  card: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  primaryLight: string;
  error: string;
  warning: string;
  success: string;
}

export const Colors: Record<ThemeMode, ColorTokens> = {
  light: {
    background: '#F9FAFB',
    card: '#FFFFFF',
    border: '#E5E7EB',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    primary: '#16A34A',
    primaryLight: '#F0FDF4',
    error: '#EF4444',
    warning: '#F59E0B',
    success: '#10B981',
  },
  dark: {
    background: '#111827',
    card: '#1F2937',
    border: '#374151',
    textPrimary: '#F9FAFB',
    textSecondary: '#9CA3AF',
    primary: '#22C55E',
    primaryLight: '#14532D',
    error: '#EF4444',
    warning: '#F59E0B',
    success: '#10B981',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
