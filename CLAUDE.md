# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm start            # Start Expo dev server (scan QR with Expo Go or press w for web)
npm run android      # Start with Android emulator
npm run ios          # Start with iOS simulator
npm run lint         # Run ESLint
```

There is no test runner configured yet. There is no build step for local development — Expo Go handles compilation.

---

## What this app is

**Duit** — a personal offline budget tracker built around pay cycles, not calendar months. The core question it answers: "how much can I spend today?"

**Source of truth:** `docs/design-handoff/prd.md` — read this before touching any business logic or screens. `docs/design-rules.md` covers UI/component decisions and overrides anything in planning docs when there's a conflict.

---

## Tech stack

- **Expo SDK 54**, managed workflow, new architecture enabled (`newArchEnabled: true`)
- **Expo Router v6** for file-based navigation. Web support enabled for dev previewing — navigate to any screen via URL in the browser during development.
- **NativeWind v4** for styling (Tailwind classes on React Native components). Configured via `babel.config.js` (`jsxImportSource: "nativewind"`) and `metro.config.js` (`withNativeWind`). Global CSS entry is `global.css`.
- **expo-sqlite** for the local database — uses `SQLiteProvider` context and `useSQLiteContext` hook (not the legacy sync API)
- **react-native-reanimated** + **react-native-gesture-handler** for animations and gestures
- **react-native-gifted-charts** for the Year View bar chart. Peer dep `react-native-svg` required.
- **expo-notifications** for local review-reminder push notifications
- **react-native-safe-area-context** for safe area insets. `SafeAreaProvider` must be at the root of `app/_layout.tsx`. **Do NOT use `SafeAreaView` as a wrapper** — it behaves inconsistently on Android (tested on Xiaomi Redmi Note 10 Pro / MIUI). Always use the `useSafeAreaInsets()` hook and apply `paddingTop: insets.top` and `paddingBottom: Math.max(insets.bottom, 24)` manually. Never use `SafeAreaView` from `react-native` (deprecated).
- TypeScript strict mode. Path alias `@/` maps to the project root.

---

## Planned directory structure

```
app/
  _layout.tsx              # Root layout — reads onboarding_complete, gates to onboarding or tabs
  (tabs)/
    _layout.tsx            # Four-tab navigator: Home, Log, Stats, More
    index.tsx              # Home screen (5 states)
    log.tsx                # Log tab (3 states + missed review)
    stats.tsx              # Stats tab (Cycle View + Year View)
    more.tsx               # Settings
  onboarding/
    _layout.tsx            # Stack navigator for pages 1–5 + OnboardingProvider
    index.tsx              # Page 1 — Welcome
    basics.tsx             # Page 2 — Name, dates, income, budget alert
    position.tsx           # Page 3 — Already spent / still have
    protect.tsx            # Page 4 — Savings, reservations
    summary.tsx            # Page 5 — Review and confirm
    # NOTE: Do NOT put non-route utility files inside app/ — Expo Router treats
    # every file in app/ as a screen. Context/provider files live in contexts/.

contexts/
  onboarding.tsx           # OnboardingProvider, useOnboardingContext, ProgressDots

lib/
  db.ts                    # Opens SQLite DB, runs migrations, exports db instance

services/
  settingsService.ts
  cycleService.ts
  dayService.ts
  entryService.ts
  reservationService.ts
  archiveService.ts

utils/
  budgetCalc.ts            # Pure formula functions (calcDailyBudget, calcLeftToday, etc.)
  validation.ts            # hardCapCheck, thresholdCheck

components/
  ui/
    CalendarModal.tsx      # Date picker, used in onboarding and new cycle form
    BottomSheet.tsx        # Centered modal container (name is legacy — not a bottom sheet)
    NavPill.tsx            # Floating pill bottom navigation with missed-review red dot
    ConfirmationSheet.tsx  # Reusable confirm/cancel modal
```

---

## Architecture rules

**No component queries SQLite directly.** All DB access goes through the services layer.

**Staged vs. committed entries.** Entries have a `staged` boolean. Staged = not yet committed. They survive app kills. Committed on review confirm.

**Calculated values are never stored.** Left today, current daily budget, days remaining — all derived at read time from the data in the DB.

**Onboarding progress persists.** The `onboarding_state` table stores `current_page` and `partial_data` (JSON blob). If the user kills the app mid-onboarding, they resume where they left off. Row is deleted when onboarding completes.

**Home screen has 5 states** (normal / review in progress / post-review pre-midnight / cycle ended / waiting). Detecting these correctly on every app open is critical — use a single `getHomeState()` utility.

**Midnight transitions** must be handled both when the app is open (timer) and when it wakes from background (`AppState` listener).

---

## Key business logic to know

**Daily budget formula:**
- Start from today: `(income + pool_leftover − already_spent − savings − reservations) / (days_remaining + 1)`
- Start from tomorrow: same numerator `/ days_remaining`
- After each review: `remaining_pool / days_left`

**Spend validation (in order):**
1. Hard cap: `amount > remaining pool` → reject, show error
2. Threshold: does spend drop projected daily budget below `budget_alert`? → show inline warning. Skip if `budget_alert = 0` or last day of cycle.

No modals for spend validation in MVP — inline warnings only.

---

## Design tokens

| Token | Hex |
|-------|-----|
| Green (primary) | `#16A34A` |
| Green dark | `#14532D` |
| Green light (bg) | `#F0FDF4` |
| Red (errors) | `#EF4444` |
| Amber (warnings, review) | `#F59E0B` |
| Teal (success/positive) | `#10B981` |
| Text primary | `#111827` |
| Text secondary | `#6B7280` |
| Border | `#E5E7EB` |
| Surface | `#F9FAFB` |
| Card | `#FFFFFF` |

Font: **Plus Jakarta Sans** (loaded via `expo-font`).

Add to `tailwind.config.js` as custom theme tokens and to `constants/theme.ts` before building any screens.

---

## Current state of the repo

Onboarding complete. Home screen functional with real SQLite data. Spending entries (add/edit/delete) wired to DB. Tab navigation live with NavPill. Log, Stats, More tabs are placeholder screens.
