# Dark theme — design

## Goal

Wire up the existing-but-inert "Theme" setting in the More tab (currently saves a value to DB but changes nothing visually) into a real Light/Dark theme switch covering the whole app.

## Decisions

- **Two modes only: Light and Dark.** Drop the existing "System" option from the More tab `THEMES` array — user picks explicitly, no OS-following.
- **Dark palette style: dark gray** (not true black/OLED) — softer charcoal backgrounds, lighter card surfaces. Matches modern app conventions (WhatsApp/Twitter dark mode style).

## Color tokens

`constants/theme.ts` currently holds an unused Expo-template `Colors` object. Replace it with the app's real tokens, light + dark:

| Token | Light (current app values) | Dark (new) |
|---|---|---|
| `background` | `#F9FAFB` | `#111827` |
| `card` | `#FFFFFF` | `#1F2937` |
| `border` | `#E5E7EB` | `#374151` |
| `textPrimary` | `#111827` | `#F9FAFB` |
| `textSecondary` | `#6B7280` | `#9CA3AF` |
| `primary` (green) | `#16A34A` | `#22C55E` (brighter, for contrast on dark bg) |
| `primaryLight` | `#F0FDF4` | `#14532D` (light/dark green tints swap) |
| `error` | `#EF4444` | `#EF4444` (unchanged — already readable on dark) |
| `warning` | `#F59E0B` | `#F59E0B` (unchanged) |
| `success` | `#10B981` | `#10B981` (unchanged) |

Modal/overlay backdrop `rgba(0,0,0,0.45)` stays as-is for both modes.

## Architecture

- **`contexts/theme.tsx`** — new `ThemeProvider`, mounted at app root in `app/_layout.tsx` (alongside the existing `SQLiteProvider`). On mount, reads `settings.theme` via `settingsService` and exposes `{ colors, mode, setTheme }` through context.
- **`useThemeColors()`** hook — components call it and destructure tokens (e.g. `const colors = useThemeColors()`), then plug values into the *existing* inline `style={{ color: colors.textPrimary }}` pattern. No change to the styling convention (inline `style={{}}` objects, per [CLAUDE.md](../../../CLAUDE.md) Styling section) — only the source of the color value changes from a hardcoded hex literal to a token lookup.
- **`<StatusBar style={mode === 'dark' ? 'light' : 'dark'} />`** — status bar icon color follows theme.

## Wiring the existing stub

[app/(tabs)/more.tsx:26-30](../../../app/(tabs)/more.tsx) — `THEMES` array loses the `'System'` entry (becomes Light/Dark only). `handleTheme()` additionally calls `setTheme()` from the new theme context (in addition to its existing `updateSettings` DB write), so flipping the switch applies the theme live — not just on next app launch.

## Scope — files to touch

Roughly 24 files currently use inline hardcoded hex values and need the swap to `colors.<token>`:
- `app/(tabs)/index.tsx` (Home, all 5 states)
- `app/(tabs)/log.tsx`, `app/(tabs)/more.tsx`
- `app/onboarding/*.tsx`
- `app/new-cycle.tsx`
- `components/home/*` (SpendModal, ReviewState, MissedReviewState, etc.)
- `components/ui/*` (NavPill, BottomSheet, CalendarModal, ConfirmationSheet)

This is a mechanical value-source swap — no logic changes, no structural changes to components. Lower risk than it looks from the file count, but it is the bulk of the implementation effort.

## Edge cases

- **Stats tab / charts** (`react-native-gifted-charts`) — Stats tab is currently a placeholder (11 lines), but its eventual chart colors should be theme-aware from the start so this isn't redone later. Bake `useThemeColors()` into it when it gets built — not a blocker for this spec, just a note for whoever builds Stats.
- **Splash screen** — stays green/white in both modes. It's native-baked (per [CLAUDE.md](../../../CLAUDE.md) Current State — requires a fresh `eas build` to change, not OTA-able), and explicitly out of scope here.
- **Modal backdrops** — `rgba(0,0,0,0.45)` works visually on both light and dark surfaces, no token needed.

## Out of scope

- "System" theme mode (explicitly dropped per decision above)
- Stats tab implementation (still a placeholder — only its *future* theme-awareness is noted)
- Splash screen (native-build-only, separate concern)
