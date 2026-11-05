# AGENTS.md — duit (React Native / Expo Budget Tracker)

## Commands

```bash
npm install           # install deps
npx expo start        # dev server (scan QR with Expo Go)
npx expo start --android | --ios | --web
expo lint             # lint
npx tsc --noEmit      # typecheck (run before commit)

# OTA update to installed builds (bundling takes 5+ min — run in background or with a long timeout)
npx eas update --channel preview --message "description"

# Confirm the update landed (list has no --channel flag, use --branch)
npx eas update:list --branch preview --limit 5

# Build APK
npx eas build -p android --profile preview
```

## Architecture Essentials

**Provider tree** (`app/_layout.tsx`):
`SafeAreaProvider` → `SQLiteProvider` (db: `duit-v1.db`, runs `migrateDb` on init) → `ThemeProvider` → `Stack`

**Navigation**:

- `app/index.tsx` — redirect: new users → onboarding, returning → `(tabs)`
- `app/(tabs)/` — Home, Log, More tabs (+ hidden Stats); custom `NavPill` tab bar
- `app/onboarding/` — multi-step setup; state in `contexts/onboarding.tsx` + `onboarding_state` table
- `app/new-cycle.tsx` — plan-based form; receives a `planId` from the close-cycle step

**Database layer** (`lib/db.ts` + `services/`):
All DB access via services — **screens never call SQLite directly**.

| Service               | Responsibility                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `cycleService`        | Cycles CRUD, computes `ActiveCycleData` (pool, dailyBudget, daysLeft, leftInCycle)          |
| `entryService`        | Spend entries; `getOrCreateTodayDay` creates `days` row on first entry; `getCycleSummaries` LEFT JOINs `days` so the active cycle shows even with 0 reviewed days |
| `reviewService`       | `confirmReview` / `confirmCatchUpReview` — stamps `reviewed_at`, writes `pool_after_review`; `backfillMissingDays` inserts rows for past dates with zero activity to enforce review-in-order |
| `reservationService`  | Reservation transactions (spend/release) with undo                                          |
| `savingsService`      | Savings withdrawals                                                                         |
| `settingsService`     | Single-row `settings` table (name, review_time, theme, notifications)                       |
| `closeCycleService`   | Close-cycle leftovers and saved carryover choices                                           |
| `newCycleService`     | Editable cycle plans; validates and applies a plan (or saves it for a future start)         |
| `notificationService` | Daily review reminder via expo-notifications                                                |
| `loanService`         | Loans (lent/borrowed), repayments, receipts                                                 |

**Schema** in `lib/db.ts`. Migrations are additive `ALTER TABLE ... ADD COLUMN` wrapped in `.catch(() => {})` — safe to re-run.

**Daily budget** (`cycleService.getActiveCycle`):

- If reviewed day exists: `leftInCycle = lastReview.pool_after_review` / remaining days
- Else: `leftInCycle = income − alreadySpent + poolLeftover − savings − reservationsTotal` / days (controlled by `start_from_today` flag)

**Home screen state machine** (`app/(tabs)/index.tsx`):
Renders one of: `waiting` | `normal` | `review` | `post_review` | `missed_review` | `ended`
Each state = separate component in `components/home/`. Modals rendered once in parent.
Home `load()` runs `backfillMissingDays` before missed-day detection so dates with zero activity still block. Log screen reloads on tab focus (`useFocusEffect`). `NormalState` hero prints the cycle range under today's date.

**Theming**: `contexts/theme.tsx` → `useThemeColors()` returns `ColorTokens` from `constants/theme.ts`. Inline styles with `colors.X` tokens (no Tailwind/NativeWind in main UI).

**Currency**: Bangladeshi Taka `৳` (U+09F3), `Math.floor()` + `.toLocaleString()`. Amounts stored as `REAL`.

## Key Patterns

- `db` via `useSQLiteContext()` in every screen/component — **no global singleton**
- `load()` = `useCallback` re-fetching all screen data; called on mount, `AppState` active, after every mutation
- Errors via `<ErrorToast>` component — never alerts
- `devState` query param on home forces state for testing (e.g. `?devState=ended`)
- Multi-step DB mutations wrapped in `BEGIN` / `COMMIT` / `ROLLBACK`

## Communication Preferences

- Keep replies concise, beginner-friendly, and in small chunks — no walls of text
- Avoid code and file references unless the user needs them to act
- At the end of each build phase, update the progress note in `docs/carryover-plan.md`, report briefly, then wait

## Code Quality & Guidelines

- No empty catch blocks — handle/surface errors meaningfully; validate at boundary; money paths (cycle/savings/reservations) fail loud and safe
- No dead code, unused vars, console.logs, commented-out blocks, or context-less TODOs in production
- TypeScript strict — no implicit `any` (justify in comment if unavoidable); real types/interfaces for data shapes
- Clear over clever; one function, one job; flatten nesting with guard clauses; no magic numbers/strings; comment intent, not mechanics
- Naming: full words (`userProfile` not `x`); booleans as questions (`isValid`); functions say what they do (`fetchUser`)
- Match existing structure; check for existing utils/components before adding new ones; separate UI, logic, data access
- Run `npx tsc --noEmit` and `expo lint` clean before every commit
- Owner is non-technical — only raise product decisions; handle technical ones independently

## Workflow Rules

- Don't start dev server, build, or preview unless explicitly asked
- Stay inside this repo — no writes outside it (no C-drive/Temp folders)
- Never work directly on main: if on main, stop, suggest a branch name, and wait; merging to main needs explicit go-ahead
- Never push any branch without explicit confirmation (each push needs its own go-ahead)
- Stage only intended files by explicit path — never `git add -A`; on Windows PowerShell quote paths with parentheses (e.g. `git add 'app/(tabs)/log.tsx'`)
- Don't add a dependency without flagging first; don't touch unrelated code; don't guess silently — ask or state assumption

## Platform Notes

- Expo SDK 54, React 19, React Native 0.81, New Architecture enabled
- expo-router v6 with typed routes
- WAL mode for SQLite skipped on web (not supported)
- `package.json` has no test suite
