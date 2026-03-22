# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm start            # Start Expo dev server (scan QR with Expo Go)
npm run android      # Start with Android emulator
npm run ios          # Start with iOS simulator
npm run lint         # Run ESLint
```

There is no test runner configured yet. There is no build step for local development — Expo Go handles compilation.

---

## What this app is

**Duit** — a personal offline budget tracker built around pay cycles, not calendar months. The core question it answers: "how much can I spend today?" Full product spec and all screen prototypes are in `docs/design-handoff/`. Read `docs/design-handoff/design.md` and `docs/design-handoff/schema.md` before touching any business logic. The build order and phase plan are in `docs/build-plan.md`.

---

## Tech stack

- **Expo SDK 54**, managed workflow, new architecture enabled (`newArchEnabled: true`)
- **Expo Router v6** for file-based navigation
- **NativeWind v4** for styling (Tailwind classes on React Native components). Configured via `babel.config.js` (`jsxImportSource: "nativewind"`) and `metro.config.js` (`withNativeWind`). Global CSS entry is `global.css`.
- **expo-sqlite v16** for the local database — uses `SQLiteProvider` context and `useSQLiteContext` hook (not the legacy sync API)
- **react-native-reanimated v4** + **react-native-gesture-handler** for animations and gestures (both already installed)
- **react-native-gifted-charts** for the Year View bar chart. Peer dep `react-native-svg` is already present.
- **expo-notifications** for local review-reminder push notifications
- TypeScript strict mode. Path alias `@/` maps to the project root.

---

## Planned directory structure

The project is currently the default Expo template. The target structure, per `docs/build-plan.md`, is:

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
    _layout.tsx            # Stack navigator for pages 1–5
    index.tsx              # Page 1 — Welcome
    basics.tsx             # Page 2 — Name, dates, income, budget alert
    position.tsx           # Page 3 — Already spent / still have
    protect.tsx            # Page 4 — Savings, reservations
    summary.tsx            # Page 5 — Review and confirm

lib/
  db.ts                    # Opens SQLite DB, exports the db instance

services/
  settingsService.ts
  cycleService.ts
  dayService.ts
  spendService.ts
  extraCashService.ts
  modalPullService.ts
  reservationService.ts
  archiveService.ts

utils/
  budgetCalc.ts            # Pure formula functions (calcDailyBudget, calcLeftToday, etc.)
  validation.ts            # hardCapCheck, thresholdCheck

components/
  modals/
    Modal1.tsx             # Soft threshold warning with toggleable pulls + sliders
    Modal2.tsx             # Pull-everything modal
    SpendConsequencesModal.tsx
  ui/
    AmountSlider.tsx       # Slider + synced text input (used in Modal1 and archive withdraw)
    CalendarModal.tsx      # Date picker, used in onboarding and new cycle form
    BottomSheet.tsx        # Slide-up modal container
    NavPill.tsx            # Bottom navigation with missed-review red dot
    DayCalendarGrid.tsx    # Custom calendar grid with coloured dots (Stats tab)
    ConfirmationSheet.tsx  # Reusable confirm/cancel sheet
```

---

## Architecture rules (from the spec)

**No component queries SQLite directly.** All DB access goes through the services layer.

**Staged vs. committed entries.** Spend entries and extra cash entries are written to the DB immediately as `is_staged = 1`. They are committed (`is_staged = 0`) only when the user confirms a review. Staged entries survive app kills. Deleting a staged spend must also reverse any `modal_pulls` rows linked to it.

**`pool_balance` reflects committed entries only.** Never update `pool_balance` for staged actions — only on review confirm.

**Savings is protected.** `cycles.savings_balance` only decreases via explicit modal pulls. Regular spending never touches it.

**Calculated values are never stored.** Left today, current daily budget, days remaining, archive total balance — all derived at read time. See `docs/design-handoff/schema.md` for the full list.

**Onboarding progress persists.** The `onboarding_state` table stores `current_page` and `partial_data` (JSON blob). If the user kills the app mid-onboarding, they resume where they left off. Delete this row when `onboarding_complete` is set to 1.

**Missed days get a DB row.** When a cycle day passes without review, create a row in `days` with `flag = 'amber'`, `is_reviewed = 0`. Do this at midnight or on next app open, whichever comes first.

---

## Key business logic to know

**Daily budget formula:**
- Start from today: `(income + pool_carryover − already_spent − savings − reservations) / (days_remaining + 1)`
- Start from tomorrow: same numerator `/ days_remaining`

**Spend validation (runs on every spend/reservation save, in order):**
1. Hard cap: amount > pool + savings + all reservations → reject, no modal
2. Threshold: does spend drop daily budget below `budget_alert`? → if yes, route to Modal 1 or Modal 2 (or consequences warning if nothing to pull). Skip entirely if `budget_alert = 0` or it's the last day of the cycle.

**Modal routing:** Modal 1 = partial pulls can fix it. Modal 2 = only full pull reaches the threshold. Consequences warning = nothing to pull from.

**Home screen has 5 states** (normal / review in progress / post-review pre-midnight / cycle ended / waiting). Detecting these correctly on every app open is critical — use a single `getHomeState()` utility.

**Midnight transitions** must be handled both when the app is open (timer) and when it wakes from background (`AppState` listener).

---

## Design tokens

The prototype HTML files define the colour palette used throughout the app:

| Token | Hex |
|-------|-----|
| Indigo (primary) | `#4F46E5` |
| Indigo dark | `#3730A3` |
| Indigo light (bg) | `#EEF2FF` |
| Sky (extra cash) | `#0EA5E9` |
| Sky light | `#E0F2FE` |
| Red (errors) | `#EF4444` |
| Amber (warnings, review) | `#F59E0B` |
| Green (success) | `#10B981` |
| Text primary | `#111827` |
| Text secondary | `#6B7280` |
| Border | `#E5E7EB` |
| Surface | `#F9FAFB` |

Font: **Plus Jakarta Sans** (to be loaded via `expo-font`).

These should be added to `tailwind.config.js` as custom theme tokens and to `constants/theme.ts` before building any screens.

---

## Current state of the repo

The `app/(tabs)` directory still contains the default Expo template screens (`explore.tsx`, placeholder `index.tsx`). The `components/` directory contains template components. These will be replaced in Phase 1 of the build plan. Do not build on top of the template files — replace them.
