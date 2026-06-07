# Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing-but-inert Light/Dark theme setting (More tab) into a real, app-wide dark mode — every screen and component re-colors based on the user's chosen theme, persisted to DB.

**Architecture:** Central color-token objects (light + dark palettes) live in `constants/theme.ts`. A `ThemeProvider` (React context) reads the persisted theme from `settingsService` on boot and exposes the active palette + a setter. Components consume it via a `useThemeColors()` hook and plug the returned hex strings into their *existing* inline `style={{ }}` objects — same pattern already used everywhere, just token-sourced instead of hardcoded.

**Tech Stack:** React Context, `expo-sqlite` (via existing `settingsService`), `expo-status-bar`, NativeWind/inline styles (no change to styling convention — see `CLAUDE.md` Styling section).

---

## Reference: Color Tokens

Add this to `constants/theme.ts`, replacing the existing unused Expo-template `Colors` export (it's dead code — `grep -rn "from '@/constants/theme'"` outside the file itself returns nothing in the real screens, confirmed during spec research).

```ts
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
```

## Reference: Refactor Classification Rules

When swapping a hardcoded hex value for a token, the **CSS property it's attached to** decides whether it should themed or left constant:

| Pattern | Action | Why |
|---|---|---|
| `backgroundColor: '#fff'` / `'#F9FAFB'` / `'#F3F4F6'` on cards, sheets, surfaces | → `colors.card` or `colors.background` | Surface — must flip with theme |
| `color: '#111827'` (body text), `'#6B7280'` / `'#9CA3AF'` (secondary text) | → `colors.textPrimary` / `colors.textSecondary` | Text — must flip with theme |
| `borderColor: '#E5E7EB'` / `'#374151'` | → `colors.border` | Border — must flip with theme |
| `backgroundColor` / `color` / `borderColor: '#16A34A'` (brand green, active states) | → `colors.primary` | Brand accent — flips to brighter green in dark mode |
| `'#F0FDF4'` (light green tint, e.g. selected-state backgrounds) | → `colors.primaryLight` | Flips to dark green tint in dark mode |
| `'#EF4444'` / `'#F59E0B'` / `'#10B981'` (error/warning/success) | → `colors.error` / `colors.warning` / `colors.success` | Semantic status colors — same value works on both backgrounds, still route through tokens for consistency |
| `color: '#fff'` on a colored button/badge (e.g. white text on green Save button) | **Leave as `'#fff'`** | Constant — button stays green, text must stay white in both modes |
| `shadowColor: '#000'` / `'#16A34A'` / `'#F59E0B'` | **Leave as-is** | Shadows render fine on both backgrounds; not a visible color swap |
| `'#D1D5DB'` (placeholder text gray) | → `colors.textSecondary` | Close enough semantically; avoids a one-off token |
| One-off decorative colors (e.g. `'#FCA5A5'`, `'#86EFAC'`, `'#DCFCE7'`, `'#92400E'`, `'#FEF2F2'`, `'#FFFBEB'`, `'#B0B7C3'`) | **Leave as-is** | Used for small accent/badge tints inside colored alert boxes — not theme-structural; re-tokenizing them is YAGNI for this pass |

**Rule of thumb:** if changing the value would make a *surface, text, or border* readable/correct in dark mode → token it. If it's a *fixed-purpose accent color inside its own colored container* (alert badges, status pills, button labels) → leave it; it already works on both themes.

**After every file:** reload the app, flip the theme switch in More tab, visually check that screen in both modes. Watch for: invisible text (same color as background), borders disappearing, buttons losing contrast.

---

### Task 1: Add color tokens to `constants/theme.ts`

**Files:**
- Modify: `constants/theme.ts`

- [ ] **Step 1: Replace the file's `Colors`/`Fonts` exports with the token system**

Open `constants/theme.ts`. Delete the existing `tintColorLight`, `tintColorDark`, and `Colors` definitions (the `Fonts` export stays — it's unrelated and may be in use). Replace with the `ThemeMode`, `ColorTokens`, and `Colors` block from the **Reference: Color Tokens** section above.

- [ ] **Step 2: Verify no other file breaks from the removed exports**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `tintColorLight`, `tintColorDark`, or old `Colors` shape. (The old `Colors` had `text`/`background`/`tint`/`icon`/`tabIconDefault`/`tabIconSelected` — if any file referenced those exact keys, it'll now error; per spec research, none of the real screens do, only the unused template files `themed-text.tsx`/`themed-view.tsx`/`use-theme-color.ts` might. If they error, leave them — they're unused template scaffolding, not part of the app; note it and move on.)

- [ ] **Step 3: Commit**

```bash
git add constants/theme.ts
git commit -m "feat: define light/dark color token palettes"
```

---

### Task 2: Create `ThemeProvider` and `useThemeColors` hook

**Files:**
- Create: `contexts/theme.tsx`

- [ ] **Step 1: Write the provider and hooks**

```tsx
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `contexts/theme.tsx`

- [ ] **Step 3: Commit**

```bash
git add contexts/theme.tsx
git commit -m "feat: add ThemeProvider and useThemeColors hook"
```

---

### Task 3: Wire `ThemeProvider` into the root layout

**Files:**
- Modify: `app/_layout.tsx:1-51`

- [ ] **Step 1: Import the provider and `useTheme`, wrap the app**

`ThemeProvider` needs `useSQLiteContext`, so it must render *inside* `SQLiteProvider`. The `StatusBar` needs to read `mode` from the new context, so it must render *inside* `ThemeProvider` — pull it into a small inner component.

Replace the file's content from line 11 (`import { migrateDb }...`) through the end with:

```tsx
import { migrateDb } from '@/lib/db';
import { ThemeProvider, useTheme } from '@/contexts/theme';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="duit-v1.db" onInit={migrateDb}>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="new-cycle" />
          </Stack>
          <ThemedStatusBar />
        </ThemeProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
```

Note: keep the existing `useFonts` import block (lines 3-10) untouched — only the section from `import { migrateDb }` onward changes.

- [ ] **Step 2: Type-check and smoke test**

Run: `npx tsc --noEmit`
Expected: no errors

Run `npm start`, open on phone, confirm app still boots to the Home screen with no crash (theme not visually wired to screens yet — this step only proves the provider mounts without breaking boot).

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: mount ThemeProvider at app root, theme-aware status bar"
```

---

### Task 4: Wire the More-tab theme switch to the live context

**Files:**
- Modify: `app/(tabs)/more.tsx:26-30` (the `THEMES` array), `app/(tabs)/more.tsx:74-78` (`handleTheme`)

- [ ] **Step 1: Drop "System" from the options**

Change:
```ts
const THEMES = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];
```
to:
```ts
const THEMES = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
] as const;
```
(`as const` narrows `value` to the literal union `'light' | 'dark'` instead of widening to `string` — required so it matches `handleTheme`'s parameter type in Step 2 without a cast.)

- [ ] **Step 2: Make `handleTheme` apply the theme live**

Add the import at the top of the file:
```ts
import { useTheme } from '@/contexts/theme';
```

Inside `MoreScreen`, alongside the existing `const db = useSQLiteContext();`, add:
```ts
const { setTheme } = useTheme();
```

Change `handleTheme` from:
```ts
async function handleTheme(value: string) {
  if (!settings) return;
  await updateSettings(db, { theme: value });
  setSettings({ ...settings, theme: value });
}
```
to:
```ts
async function handleTheme(value: 'light' | 'dark') {
  if (!settings) return;
  await setTheme(value);
  setSettings({ ...settings, theme: value });
}
```
(`setTheme` from the context already calls `updateSettings` internally — see Task 2 — so the direct `updateSettings` call here is now redundant and removed.)

- [ ] **Step 3: Manual test**

Run app on phone, go to More tab → Appearance → tap "Dark". Confirm: switch highlights the Dark pill, status bar icons change color (light icons on dark backgrounds elsewhere won't show yet — that's Tasks 5+). Restart the app — theme choice should persist (read back from DB).

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/more.tsx"
git commit -m "fix: wire More-tab theme switch to ThemeProvider, drop System option"
```

---

### Task 5: Refactor Home screen + its modal components

**Files:**
- Modify: `app/(tabs)/index.tsx`, `components/home/NormalState.tsx`, `components/home/ReviewState.tsx`, `components/home/MissedReviewState.tsx`, `components/home/SpendModal.tsx`, `components/home/ReservationModal.tsx`, `components/home/DeleteConfirmModal.tsx`

- [ ] **Step 1: For each file, add the hook and replace themed hex values**

In each file, add near the top of the component function:
```ts
const colors = useThemeColors();
```
and the import:
```ts
import { useThemeColors } from '@/contexts/theme';
```

Then, applying the **Refactor Classification Rules** above, replace each occurrence in the file's color inventory below. "Theme" = swap to the listed token; "Leave" = do not change.

**`app/(tabs)/index.tsx`** — inventory: `#16A34A`→`colors.primary`, `#111827`→`colors.textPrimary`, `#F3F4F6`→`colors.border` (used as subtle dividers/pill backgrounds — check each: if it's a `backgroundColor` on a neutral chip, → `colors.border`; confirm visually), `#9CA3AF`/`#6B7280`→`colors.textSecondary`, `#fff`→ check property: `backgroundColor` → `colors.card`, `color` on colored button → Leave, `#F9FAFB`→`colors.background`, `#000`→ Leave (shadowColor, line 392/567), `#EF4444`→`colors.error`, `#E5E7EB`→`colors.border`, `#D1D5DB`→`colors.textSecondary`.

**`components/home/NormalState.tsx`** — inventory: `#16A34A`→`colors.primary` (note: line 59 `shadowColor: '#16A34A'` → Leave, it's a shadow), `#fff`→ `backgroundColor` → `colors.card` (line 152), `color` on colored badge → Leave, `#F3F4F6`→`colors.border`, `#111827`→`colors.textPrimary`, `#6B7280`→`colors.textSecondary`, `#F9FAFB`→`colors.background`, `#F59E0B`→`colors.warning` (note: line 196 `shadowColor: '#F59E0B'` → Leave), `#F0FDF4`→`colors.primaryLight`, `#E5E7EB`→`colors.border`, `#D1D5DB`→`colors.textSecondary`, `#9CA3AF`→`colors.textSecondary`, `#000`→ Leave (shadowColor, line 48), `#FCA5A5`/`#EF4444`/`#86EFAC`/`#374151` → Leave (one-off accent colors per classification table; `#EF4444` in an alert box context → `colors.error` if it's the alert's primary text/icon, Leave if it's a tint/border on a colored badge — check usage).

**`components/home/ReviewState.tsx`** — inventory: `#111827`→`colors.textPrimary`, `#fff`→ check property (card bg → `colors.card`, button text → Leave), `#16A34A`→`colors.primary`, `#F3F4F6`→`colors.border`, `#D1D5DB`/`#9CA3AF`→`colors.textSecondary`, `#000`→ Leave (shadow), `#F9FAFB`→`colors.background`, `#F59E0B`→`colors.warning`, `#EF4444`→`colors.error`, `#374151`→ Leave (one-off).

**`components/home/MissedReviewState.tsx`** — inventory: `#fff`→ check property, `#9CA3AF`→`colors.textSecondary`, `#111827`→`colors.textPrimary`, `#F3F4F6`/`#E5E7EB`→`colors.border`, `#D1D5DB`→`colors.textSecondary`, `#F9FAFB`→`colors.background`, `#F59E0B`→`colors.warning`, `#6B7280`→`colors.textSecondary`, `#374151`→ Leave, `#16A34A`→`colors.primary`, `#000`→ Leave (shadow).

**`components/home/SpendModal.tsx`** — inventory (already read in full; this is the modal we discussed for the keyboard-push issue): `#E5E7EB`→`colors.border` (lines 47, 71/72 input borders), `#9CA3AF`/`#6B7280`→`colors.textSecondary`, `#111827`→`colors.textPrimary` (lines 36, 53, 76, 84, 90), `#fff`→ `backgroundColor: '#fff'` at line 34 → `colors.card`; `color: '#fff'` at line 114 (Save button text on green bg) → **Leave**, `#EF4444`→`colors.error` (lines 72, 90), `#D1D5DB`→`colors.textSecondary` (placeholder colors, lines 52, 76, 81), `#FEF2F2`→ Leave (alert box tint), `#F9FAFB`→`colors.background`/`colors.card` (input field bg, line 47/70 — pick `colors.card` so it contrasts with the modal's own `colors.card` background; verify visually and adjust to `colors.background` if they look identical), `#16A34A`→`colors.primary` (line 72, 76 active border/amount text), `#FFFBEB`/`#92400E`→ Leave (warning box tint).

**`components/home/ReservationModal.tsx`** — inventory: `#E5E7EB`→`colors.border`, `#fff`→ check property, `#9CA3AF`→`colors.textSecondary`, `#16A34A`→`colors.primary`, `#111827`→`colors.textPrimary`, `#D1D5DB`→`colors.textSecondary`, `#6B7280`→`colors.textSecondary`, `#F9FAFB`→`colors.card`/`colors.background` (verify visually), `#FEF2F2`→ Leave, `#F0FDF4`→`colors.primaryLight`, `#EF4444`→`colors.error`.

**`components/home/DeleteConfirmModal.tsx`** — inventory: `#fff`→ check property (`colors.card` for surfaces, Leave for button text), `#6B7280`→`colors.textSecondary`, `#EF4444`→`colors.error`, `#E5E7EB`→`colors.border`, `#111827`→`colors.textPrimary`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Manual test — Home screen in both themes**

Run app, navigate to Home. Toggle theme in More tab, return to Home. Check all 5 home states if reachable (normal / review in progress / post-review / cycle ended / waiting), plus: open "Add spend" modal, "Edit" an entry (DeleteConfirmModal), open a reservation modal if visible. Confirm text is readable, borders visible, buttons retain correct contrast in both modes.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/index.tsx" components/home/
git commit -m "feat: theme-aware colors for Home screen and its modals"
```

---

### Task 6: Refactor Log, More, and Stats tabs

**Files:**
- Modify: `app/(tabs)/log.tsx`, `app/(tabs)/more.tsx`, `app/(tabs)/stats.tsx`

- [ ] **Step 1: Add the hook and replace themed hex values**

Add `const colors = useThemeColors();` and the `useThemeColors` import to each file's component, then apply the classification rules to this inventory:

**`app/(tabs)/log.tsx`** — `#9CA3AF`/`#6B7280`→`colors.textSecondary`, `#16A34A`→`colors.primary`, `#111827`→`colors.textPrimary`, `#F9FAFB`→`colors.background`, `#EF4444`→`colors.error`, `#fff`→ check property, `#F3F4F6`→`colors.border`, `#374151`→ Leave (one-off), `#D1D5DB`→`colors.textSecondary`, `#000`→ Leave (shadow).

**`app/(tabs)/more.tsx`** — `#111827`→`colors.textPrimary`, `#16A34A`→`colors.primary`, `#fff`→ check property (card backgrounds → `colors.card`; text on the active green theme-pill, line 257, → Leave — it must stay white against the green pill in both modes), `#6B7280`→`colors.textSecondary`, `#F9FAFB`→`colors.background`, `#F3F4F6`→`colors.border` (inactive theme-pill background, line 250 — swap to a token that's visible on the new dark card surface; use `colors.border`, verify visually), `#EF4444`→`colors.error`, `#E5E7EB`→`colors.border`, `#9CA3AF`→`colors.textSecondary`, `#D1D5DB`→`colors.textSecondary`, `#86EFAC`→ Leave (one-off), `#000`→ Leave (shadow).

**`app/(tabs)/stats.tsx`** — `#F9FAFB`→`colors.background`, `#9CA3AF`→`colors.textSecondary`. (This screen is currently an 11-line placeholder — minimal change, but keep it theme-consistent so whoever builds it out later inherits correct colors.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Manual test**

Toggle theme, visit Log tab (check entry list, any filters/empty states), More tab (check every settings row, the now-two-option theme switch itself, the "Check for updates" button), Stats tab placeholder. Confirm readability in both modes.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/log.tsx" "app/(tabs)/more.tsx" "app/(tabs)/stats.tsx"
git commit -m "feat: theme-aware colors for Log, More, and Stats tabs"
```

---

### Task 7: Refactor onboarding screens and new-cycle screen

**Files:**
- Modify: `app/onboarding/basics.tsx`, `app/onboarding/position.tsx`, `app/onboarding/protect.tsx`, `app/onboarding/summary.tsx`, `app/new-cycle.tsx`

- [ ] **Step 1: Add the hook and replace themed hex values**

Add `const colors = useThemeColors();` and the `useThemeColors` import to each screen's component. All five files share nearly identical color palettes (form screens reusing the same input/card/button patterns). Apply the classification rules to this shared inventory, present (with minor count variations) in all five files:

- `#111827`→`colors.textPrimary`
- `#9CA3AF` / `#6B7280` / `#D1D5DB`→`colors.textSecondary`
- `#E5E7EB`→`colors.border`
- `#16A34A`→`colors.primary`
- `#fff`→ check property: `backgroundColor` on cards/inputs → `colors.card`; `color` on green-button text → Leave
- `#F3F4F6`→`colors.border`
- `#F9FAFB`→`colors.background`
- `#F0FDF4`→`colors.primaryLight`
- `#EF4444`→`colors.error`
- `#FEF2F2`→ Leave (error-box tint, one-off)
- `#FFFBEB` / `#92400E`→ Leave (warning-box tint, one-off)
- `#000`→ Leave (shadow, where present)

`new-cycle.tsx` additionally has `#F0FDF4`→`colors.primaryLight` (already listed above — same rule applies).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Manual test**

This requires either a fresh onboarding run (use the More tab → Reset app data, if available, to re-trigger onboarding) or navigating directly via Expo Router URLs in the web preview (`npm start`, press `w`, then visit `/onboarding`, `/onboarding/basics`, etc., and `/new-cycle`). Toggle theme, step through each screen, confirm calendar modal, input fields, alert/warning boxes, and buttons all read correctly in both modes.

- [ ] **Step 4: Commit**

```bash
git add app/onboarding/ app/new-cycle.tsx
git commit -m "feat: theme-aware colors for onboarding and new-cycle screens"
```

---

### Task 8: Refactor shared UI components

**Files:**
- Modify: `components/ui/NavPill.tsx`, `components/ui/CalendarModal.tsx`, `components/ui/ErrorToast.tsx`

- [ ] **Step 1: Add the hook and replace themed hex values**

Add `const colors = useThemeColors();` and the `useThemeColors` import to each component.

**`components/ui/NavPill.tsx`** — inventory: `#fff`→ `backgroundColor` → `colors.card` (the pill surface), `color` on active-icon-over-green → Leave; `#16A34A`→`colors.primary`; `#B0B7C3`→ Leave (one-off inactive-icon tint — verify it's still visible against `colors.card` in dark mode; if it disappears, swap to `colors.textSecondary` instead).

**`components/ui/CalendarModal.tsx`** — inventory: `#16A34A`→`colors.primary`, `#111827`→`colors.textPrimary`, `#ffffff`/`#fff`→ check property (`backgroundColor` on the modal sheet → `colors.card`), `#DCFCE7`→ Leave (selected-date tint, one-off — verify visibility on dark `colors.card`; if it disappears, swap to `colors.primaryLight`), `#6B7280`→`colors.textSecondary`, `#F3F4F6`→`colors.border`, `#D1D5DB`→`colors.textSecondary`.

**`components/ui/ErrorToast.tsx`** — inventory: `#fff`→ `color` on the toast (which sits on a colored background) → Leave; `#1F2937`→ this happens to already equal the new dark-mode `card` token's value — `backgroundColor: '#1F2937'` → `colors.textPrimary` if it's meant as a near-black toast background in light mode (verify: toast should stay dark/high-contrast in *both* themes since it's an alert overlay, not a surface — likely **Leave as `'#1F2937'`** so the toast keeps consistent dark styling regardless of app theme; check the rendered toast in dark mode to confirm it doesn't blend into the background).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Manual test**

Toggle theme. Confirm NavPill stays legible and the active-tab highlight is visible against both light and dark backgrounds. Open the calendar modal (via onboarding or new-cycle) in both modes — confirm selected-date highlight and weekday/number text are readable. Trigger an error toast (e.g. enter an invalid spend amount) in both modes — confirm it's readable and doesn't blend into the background.

- [ ] **Step 4: Commit**

```bash
git add components/ui/NavPill.tsx components/ui/CalendarModal.tsx components/ui/ErrorToast.tsx
git commit -m "feat: theme-aware colors for shared UI components"
```

---

### Task 9: Final pass — lint, type-check, full walkthrough

**Files:** none (verification only)

- [ ] **Step 1: Lint and type-check**

Run: `npm run lint`
Expected: no errors

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Full walkthrough in both themes**

With the app running on your phone: switch to Dark in More tab. Walk through every tab (Home — all reachable states, Log, Stats, More) and every modal/sheet (Add spend, Edit spend, Delete confirm, Reservation, Missed review catch-up, Calendar picker). Repeat in Light mode. Confirm: no invisible text, no vanished borders, no low-contrast buttons, status bar icons match background brightness, NavPill stays legible.

- [ ] **Step 3: Fix any visual issues found**

If something reads wrong in one mode, it's almost always one of:
- a "Leave as-is" color that should actually have been themed (swap it to the matching token)
- a token swap that should have been "Leave" (revert it to the constant hex)

Adjust per the **Refactor Classification Rules** reasoning, re-test, and commit each fix separately with a `fix:` message describing the specific screen/element.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final dark-theme pass — lint, type-check, full walkthrough fixes"
```
