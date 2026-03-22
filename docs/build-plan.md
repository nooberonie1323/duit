# Duit — Build Plan

> Last updated: 2026-03-22
> Status key: ⬜ Not started · 🔵 In progress · ✅ Done · 🚫 Blocked

---

## How to read this plan

The build is ordered by dependency: each phase produces something that the next phase needs.
Phases are not "do all of X before touching Y" — they define the gates. Within a phase, individual items can be built in parallel as long as their own dependencies are met.

---

## Phase Overview

| # | Phase | What it produces | Gate for |
|---|-------|-----------------|----------|
| 1 | Foundation | DB, services, navigation shell | Everything |
| 2 | Onboarding | First-run flow + cycle creation | Home, all other screens |
| 3 | Home screen | Spend/extra cash entry, staging model | Log tab, validation modals |
| 4 | Validation modals | Modal 1, Modal 2, consequences warning | Home, Review, Stats mid-cycle |
| 5 | Log tab | Review flow, Day Wrapped Up, missed review | End-of-cycle flow |
| 6 | Stats tab | Cycle View, Year View, archive withdraw | End-of-cycle flow |
| 7 | End-of-cycle flow | Leftover page, new cycle form, waiting screen | Looping cycles |
| 8 | More tab | Settings: name, notifications, theme | — |
| 9 | Notifications | Background scheduling, review reminders | — |
| 10 | Polish | Loading screen, animations, edge cases | — |

---

## Phase 1 — Foundation

**Why first:** Every screen reads from and writes to the database. Nothing can be built without a working db layer and a navigation skeleton to host screens in.

### 1a — Clean the template

The default Expo template ships with placeholder screens (`explore.tsx`, demo components in `/components`). These need to be cleared before real work begins — leaving them creates confusion about which files are live.

- Delete template tabs (`explore.tsx`, demo components not used by the project)
- Reset `app/(tabs)/_layout.tsx` to a minimal shell with four tabs: Home, Log, Stats, More
- Reset `app/_layout.tsx` to handle the onboarding gate (new user → onboarding, returning → tabs)

### 1b — Database setup

- Create `lib/db.ts` — opens the SQLite database via `expo-sqlite`, exports the `db` instance
- Create and run the migration that creates all 10 tables:
  `settings`, `onboarding_state`, `cycles`, `days`, `spend_entries`, `extra_cash_entries`, `modal_pulls`, `reservations`, `archived_savings`, `archive_withdrawals`
- Migration runs once on first launch (check if tables already exist before creating)

### 1c — Service layer

All DB reads/writes go through services — no screen queries SQLite directly.

- `services/settingsService.ts` — get/update settings row, check `onboarding_complete`
- `services/cycleService.ts` — get active cycle, create cycle, update pool/savings balance, status transitions
- `services/dayService.ts` — get/create day row, mark reviewed/skipped, detect missed days
- `services/spendService.ts` — create/delete staged spend, commit entries, validate spend
- `services/extraCashService.ts` — create/delete staged extra cash, commit entries
- `services/modalPullService.ts` — create pull record, reverse pulls on spend delete
- `services/reservationService.ts` — create/update/delete reservations, get by cycle
- `services/archiveService.ts` — get archive balance, create archive entry, create withdrawal

**Note:** Services are pure TypeScript functions — no React, no hooks. This keeps them testable in isolation and usable anywhere.

### 1d — Core calculation utilities

These are pure functions that implement the formulas from the spec. They are used throughout the app and must be correct before any screen is built.

- `utils/budgetCalc.ts`:
  - `calcDailyBudget(cycle, daysRemaining)` — the main formula, handles today/tomorrow starts
  - `calcNewDailyBudget(poolBalance, daysAfterToday)` — used for threshold checks
  - `calcLeftToday(dailyBudget, stagedSpends)` — hero number
  - `calcDaysRemaining(endDate)` — calendar day count
- `utils/validation.ts`:
  - `hardCapCheck(amount, pool, savings, reservations)` → boolean
  - `thresholdCheck(amount, pool, daysAfterToday, budgetAlert)` → boolean

### 1e — Navigation shell

- Root `_layout.tsx` reads `onboarding_complete` from settings. If `0`, route to `/onboarding`. If `1`, route to `/(tabs)`.
- `app/(tabs)/_layout.tsx` — four-tab navigator: Home, Log, Stats, More. Stub screens for now.
- `app/onboarding/_layout.tsx` — stack navigator for pages 1–5.

**Risks:**
- expo-sqlite v16 API: uses `useSQLiteContext` hook and `SQLiteProvider`. Make sure the db initialisation is wrapped correctly at the root level so all screens share one connection.
- Migration idempotency: must not re-create tables on every launch. Use `CREATE TABLE IF NOT EXISTS`.

**How to verify (Phase 1):** Open the app in Expo Go. It should launch without crashing, show a stub Home tab, and have no console errors about missing tables. Check the SQLite db file exists in the app's document directory.

---

## Phase 2 — Onboarding

**Why here:** The onboarding creates the first cycle and writes `onboarding_complete = 1` to settings. Without it, there is no cycle for any other screen to read. Also, getting onboarding right first means all the validation logic and the daily budget formula get exercised early.

### Screens

- `app/onboarding/index.tsx` (Page 1 — Welcome)
- `app/onboarding/basics.tsx` (Page 2 — Name, dates, income, budget alert)
- `app/onboarding/position.tsx` (Page 3 — Already spent / still have, today or tomorrow)
- `app/onboarding/protect.tsx` (Page 4 — Savings, reservations)
- `app/onboarding/summary.tsx` (Page 5 — Summary, confirm)

### Key behaviours to implement

- **Persistent progress:** Every field change writes to `onboarding_state.partial_data`. On app open, if `onboarding_complete = 0`, read `current_page` and `partial_data` and resume.
- **Calendar modal:** Reusable date picker component — used here on Page 2 and Page 5, and again on the new cycle form later.
- **Validation on Page 2:** Budget alert vs. estimated daily budget comparison. Inline warning only.
- **Page 3 mutual exclusion:** Already spent / still have clear each other. Skip button when both empty. Hard block if pool hits zero.
- **Page 4 live recalculation:** As savings and reservations are added, the daily budget preview updates live on screen. Skip button when nothing entered.
- **Page 5 summary editing:** All fields editable inline. Every edit re-runs the full validation chain. Confirm button disabled if hard cap violation exists.
- **On confirm:** Write cycle to `cycles` table (including initial `pool_balance`), write reservations, set `onboarding_complete = 1`, delete `onboarding_state` row, navigate to Home.

**Risks:**
- The multi-page form with persistent state is the most complex form in the app. The `onboarding_state.partial_data` JSON blob needs a well-typed shape agreed on before building.
- Page 5 editable summary is the hardest page — any field can change any other field. A single shared validation function called on every change is essential.
- Date validation: end date must be after start date by at least 2 days. Calendar component needs a `minDate`/`maxDate` API.

**Hard-to-preview manually:** Page 4 (savings/reservations live recalculation) and Page 5 (inline editing with validation) are hard to test mid-flow. Strategy: build a dev-only quick-fill button that pre-populates all fields and skips to the page you're testing.

**How to verify (Phase 2):** Complete the full onboarding flow from a fresh install. After confirming Page 5, the app should land on Home. Kill and reopen — should go to Home (not onboarding). Uninstall and reinstall — should return to Page 1.

---

## Phase 3 — Home Screen

**Why here:** Home is the daily-use screen. It depends on the cycle data created in Phase 2 and on the validation logic which feeds into Phase 4. Building Home before the modals means the "add spend" flow is partially wired — tapping save will validate and either commit or (placeholder) trigger a modal.

### Screens / components

- `app/(tabs)/index.tsx` — Home screen, handles all 5 states:
  1. Normal (ongoing cycle)
  2. Review in progress (blocking message)
  3. Post-review pre-midnight ("You're done for today")
  4. Cycle ended (congratulations — stub for now, completed in Phase 7)
  5. Waiting screen (stub for now, completed in Phase 7)

### Cards

- **Hero area** — indigo background, date, day of cycle, "Left today" number, extra cash sub-total in sky blue
- **Cycle Overview card** — Left in cycle, Days left, Daily average
- **Spending card** — list of staged spend entries, "Add spend" bottom sheet, delete (X) per entry
- **Extra Cash card** — list of staged extra cash entries, "Add extra cash" bottom sheet, delete per entry
- **Bottom nav** — four tabs with missed-review red dot indicator on Log tab

### Add spend flow (bottom sheet)

- Amount field auto-focuses, keyboard appears immediately
- Optional note
- Hard block if amount ≤ 0
- On save: run hard cap check → if pass, run threshold check → if clean, commit to staged DB, update UI. If threshold triggered, hand off to Phase 4 modals (stub a TODO for now).

### Staging model

- Staged entries written to DB immediately on creation (not held in memory)
- Delete: remove row + reverse any modal_pulls for that entry
- "Left today" calculated live from `calcLeftToday`

**Risks:**
- The 5 home screen states need a clear state-detection function. This runs on every app open and needs to correctly detect: active review in progress, post-review window, cycle ended, waiting. A single `getHomeState(cycle, today)` utility keeps this from being scattered.
- The bottom nav red dot needs to persist across all screens — put missed-review detection in a shared hook or context.

**Hard-to-preview manually:** Post-review and cycle-ended states require time to pass. Strategy: add a `__DEV__` state override at the top of the home screen component to force any state without needing to actually complete a review.

**How to verify (Phase 3):** Add 2–3 spends, verify "Left today" decreases correctly. Delete one, verify it rebounds. Kill app and reopen — staged entries should still be there. Verify daily average shows "—" until a day is reviewed.

---

## Phase 4 — Validation Modals

**Why here:** Modals are triggered from Home (add spend), Review (add/edit spend), and Stats (add mid-cycle reservation). Building them as a phase means they can be shared across all three callers.

### Components

- `components/modals/SpendConsequencesModal.tsx` — the warning shown when threshold is hit but there's nothing to pull from ("After this spend, you'll have ৳X left for Y days")
- `components/modals/Modal1.tsx` — soft warning with toggleable savings/reservation sources, sliders, live new daily budget preview
- `components/modals/Modal2.tsx` — pull-everything modal with single confirmation button

### Shared UI pattern: slider + input

- `components/ui/AmountSlider.tsx` — reusable slider + text input combo. Slider capped at source balance. Used in Modal 1, withdraw flow.

### Modal routing logic

When a spend passes hard cap and triggers threshold:

1. Is `budget_alert = 0`? → skip all modals, save normally.
2. Are there any non-zero sources (savings or reservations)? → No → show SpendConsequencesModal.
3. Can partial pulls reach the threshold? → Yes → Modal 1. No (only full pull works) → Modal 2.

This routing logic lives in a utility, not in the modal components themselves.

**Risks:**
- Modal 1 has the most complex state: multiple sources, each independently toggleable, each with its own slider, live sum of pulls, live new daily budget. This is the hardest UI component in the app. Treat it as a mini-form.
- "Confirm button enables when new daily budget exceeds alert OR when user has selected maximum available" — this edge case is easy to miss. The second condition handles the scenario where pulling everything still doesn't reach the threshold.

**Hard-to-preview manually:** To trigger Modal 1 / Modal 2, you need a cycle with a budget alert set, and a spend large enough to breach it. Strategy: a dev helper that creates a cycle with a budget alert of ৳500/day and a pool that barely covers it, making it easy to trigger the modal.

**How to verify (Phase 4):** Manually trigger all three warning paths. Verify Confirm + Proceed anyway both work. Verify deleting a spend that had modal pulls reverses the savings/reservation balances.

---

## Phase 5 — Log Tab

**Why here:** Review is the core daily ritual. It commits all staged entries. Many downstream features (stats, end-of-cycle) require committed data.

### States

- `app/(tabs)/log.tsx` — the single file that handles all three states:
  - **State 1 (during day):** spend list (view-only), extra cash list, countdown timer to review time
  - **State 2 (review mode):** yellow background, editable entries, add spend/extra cash, notes card, day flag, confirm button
  - **State 3 (day wrapped up):** summary stats, rough flag messages, note editing, midnight countdown

### Key behaviours

- **Countdown timer:** always visible in State 1, even if notifications are off. Switches to "Start review" button at review time.
- **Review mode entry edits:** amount and note editable, time NOT editable on existing entries. New entries added during review can have time edited (within today, no future times).
- **Day flag:** auto-calculated live during review — green/blue/rough based on daily_budget vs. total_spent.
- **On confirm:**
  - All staged entries → `is_staged = 0`, `committed_at = now`
  - Underspent amount (daily_budget − total_spent, if > 0) added back to `pool_balance`
  - Extra cash added to `pool_balance`
  - `pool_balance` on cycle updated
  - Day row created with final values
  - Navigate to Day Wrapped Up (State 3)
- **Rough flag messages:** random pick from the 10 scripture quotes in the spec.
- **Note editing:** editable until midnight from State 3. After midnight, read-only.

### Missed review

- Detection: on every app open and at midnight, check for any cycle day that has passed without a `days` row. Create amber rows for them.
- Badge: shown on log tab if `COUNT(amber days) > 0`. Red dot on Log nav icon across all screens.
- Missed review modal: opens oldest unreviewed day first. Same review UI as State 2. Skip button with confirmation.

### Log tab during cycle end / waiting state

- Shows blank screen: "This cycle has ended. Head to Stats to see how it went." + "Go to Stats" button.

**Risks:**
- State detection is time-dependent and will be annoying to test. The `__DEV__` override pattern from Phase 3 applies here too.
- Midnight transition: when the day rolls over at midnight, State 3 needs to reset to State 1. Use a timer that fires at midnight. If the app is backgrounded at midnight and reopened, the state needs to recompute on focus.
- "Last day of cycle" is a special case: State 3 on the last day should NOT show "new daily budget" (no remaining days). At midnight after the last day, the app transitions to the end-of-cycle flow instead of resetting to State 1.

**Hard-to-preview manually:** All three states require specific times. Strategy: mock review time as "2 minutes from now" during dev so you can test the countdown → review button transition quickly.

**How to verify (Phase 5):** Complete a full review cycle. Check pool_balance updated correctly in the DB. Check day row created with correct flag. Simulate a missed day by changing the system clock or using a dev override.

---

## Phase 6 — Stats Tab

**Why here:** Stats reads from committed data (days, spend_entries). It also hosts the mid-cycle reservation add flow and the archive withdraw flow. Both of those depend on the validation modal system from Phase 4.

### Cycle View

- Calendar grid for the cycle's date range
- Coloured dots per reviewed day (green/blue/rough/amber/grey)
- Amount labels on green and rough dots (shorten values ≥ 1000 to "Xk")
- Tap a day → day summary modal (budget, spent, saved/overspent, flag)
- Tap amber → redirect message to log tab
- Navigation arrows: previous/next cycle

### Reservations card (below calendar)

- Lists reservations for viewed cycle
- "Add reservation" button — only shown for current active cycle, hidden for past cycles, locked during active review
- Mid-cycle reservation follows staging model (same as spends). Staged reservations appear in the review modal.
- Validation: runs full spend validation flow (hardCap + threshold)

### Year View

- Toggle at top (Cycle View / Year View)
- Cycle/year navigation arrows
- Four stat cards: Total spent, Daily average, Total underspent, Total archived
- Monthly bar chart (Jan–Dec, calendar-day attribution, indigo bars)
- Archived savings section: total balance, per-cycle contribution list
- Withdraw button (hidden if no active cycle, zero balance, or review in progress)

### Withdraw flow

- AmountSlider + input (same component from Phase 4)
- Warning if selecting full balance
- Destination picker: Add to pool / Add to reservation / Log as expense
- "Log as expense" handles the 4 timing edge cases from the spec

**Risks:**
- The calendar grid is custom (dots, amounts, day-tap interactions). React Native has no native calendar grid. This will need a hand-rolled component.
- Year view bar chart uses **react-native-gifted-charts** (installed, v1.x). Its required peer dep `react-native-svg` is already present in the project. No additional installs needed. Use the `BarChart` component with `barWidth`, `barBorderRadius`, `frontColor` (indigo `#4F46E5`), and `xAxisLabel` for month names.
- The 4 "Log as expense" timing edge cases (during day, during review, post-review before midnight, post-review on last day) require careful branching. All 4 must be tested.
- Mid-cycle reservations being staged but visible in stats requires the stats query to include `is_staged = 1` reservations for the current cycle.

**Hard-to-preview manually:** Year view requires actual committed data across months. Strategy: build a dev data seeder that creates 2–3 past cycles with reviewed days.

**How to verify (Phase 6):** Navigate to Stats after reviewing several days. Confirm dots appear on correct days with correct colours. Add a mid-cycle reservation and verify it shows as staged until review. Complete a withdraw and verify pool_balance updates.

---

## Phase 7 — End-of-Cycle Flow

**Why here:** This is the bridge between cycles. It depends on committed cycle data (Phase 5), stats (Phase 6 — the congratulations screen reads them), and the new cycle form reuses the daily budget formula and validation from earlier phases.

### Congratulations screen

- Triggered at midnight after cycle `end_date`. Cycle status transitions from `active` → `ended`.
- Confetti on first landing only (`confetti_shown` flag — can use a local state or a settings field).
- Cycle summary stats (from reviewed days only — amber days are excluded).
- "Stats will update" notice if any amber days exist.
- Missed day hard block on both buttons.

### Waiting screen

- Simple screen with humorous message.
- One button: "Start new cycle" → new cycle form.

### Leftover page

- Only shown if pool remainder, savings, or any reservation > 0 at cycle end.
- Three cards: Pool, Savings, Reservations.
- Each card collapsed by default, expandable.
- Allocations: Carry over / → [other card] / New reservation (Reservations card only)
- Yellow notice: live unallocated total → "will be archived"
- Green when all allocated.
- Reset button with confirmation sheet.
- On Continue with unallocated: confirmation sheet, then archive the remainder.

### New cycle form

- Single page, grouped cards mirroring onboarding structure.
- Pre-fills: budget alert from previous cycle, carried savings (locked), carried reservations (locked).
- "Carried from last cycle" line for pool carryover — not editable.
- Same validation as onboarding.
- On submit → cycle created, navigate to Home (or Waiting screen if start date is future).

**Risks:**
- The leftover page allocation model ("cards give to cards") is the most complex UI page in the entire app. Cards can receive from and send to each other. The receiving / splitting state is a mini directed graph. Recommend building this as a dedicated reducer (not ad-hoc useState) to keep it sane.
- Circular sends are allowed per the spec — no prevention logic needed, but the UI must not crash on them.
- The midnight transition trigger: on mobile, the app may be backgrounded when midnight hits. Must handle: (a) app comes to foreground and re-evaluates state, (b) app opens cold and detects the cycle has ended.
- "Start new cycle" hard block until all missed days resolved: ties back to the missed review system in Phase 5.

**Hard-to-preview manually:** End-of-cycle only triggers at actual midnight after the actual `end_date`. Strategy: a dev utility that sets `end_date` to today and mocks "midnight passed."

**How to verify (Phase 7):** End a cycle manually via dev override. Confirm congrats screen shows. Complete leftover allocation with a mix of carries, sends, and archived remainder. Confirm the new cycle form pre-fills correctly. Confirm the new cycle starts and the home screen is back in normal state.

---

## Phase 8 — More Tab

**Why here:** Settings are straightforward and have no dependencies on other phases. Doing this before notifications because the review time setting is needed for Phase 9.

### Screens

- `app/(tabs)/more.tsx`
- Profile section: Name field (editable, 20-char limit, required, cannot be cleared)
- Notifications section: on/off toggle, Review time picker (8–11pm, only shown when notifications on)
- Preferences section: Theme picker (Follow system / Light / Dark)

### Theme

- NativeWind supports dark mode via `colorScheme`. Wire up the theme setting to `Appearance.setColorScheme()` (or the equivalent in the Expo SDK).
- "Follow system" means no override — use the device default.

**Risks:**
- Name change must update the loading screen greeting and all places `name` is used. Since `name` comes from the settings service, any component reading it will pick up the change if reading from context/state rather than a one-time read.

**How to verify (Phase 8):** Change name, kill and reopen — greeting should show new name. Toggle notifications off, verify review time disappears. Switch theme, verify it applies immediately.

---

## Phase 9 — Notifications

**Why here:** Notifications require a working review time setting (Phase 8) and need to know when review is completed (Phase 5) to cancel the follow-up.

### Behaviours

- On app launch: request notification permissions if not already granted (only when notifications are enabled in settings).
- Schedule the daily review reminder at the configured review time.
- If review is not completed 30 minutes after the first reminder, send a follow-up. Cancel the follow-up if review was completed in the meantime.
- Tapping either notification opens the app directly on the Log tab.
- Reschedule whenever review time setting changes.
- Cancel all notifications if notifications are toggled off.

### Implementation notes

- `expo-notifications` supports local scheduled notifications.
- Use a repeating daily trigger for the main reminder.
- The 30-minute follow-up is a one-shot scheduled notification. Schedule it immediately after the first fires. Cancel via its identifier if review is confirmed before 30 minutes.

**Risks:**
- On Android, notification channels must be configured or notifications are silently dropped.
- Background scheduling: when the review time setting changes, all existing scheduled notifications must be cancelled and new ones created. Stale notifications are a bad user experience.
- The follow-up notification: we can't "fire and check" in a background task easily in Expo Go. The practical approach is: schedule the follow-up as a normal local notification, and on review confirm, cancel it by its identifier.

**How to verify (Phase 9):** Set review time to 2 minutes from now. Verify notification fires. Don't complete review. Verify follow-up fires 30 minutes later (this one may need a longer test window). Complete review before follow-up — verify follow-up is cancelled.

---

## Phase 10 — Polish

**Why last:** These are enhancements that require the full app to exist before they can be properly evaluated.

### Loading screen

- **New user:** App name/logo + meaningful progress bar (reflects real init steps: loading fonts → opening database → ready).
- **Returning user:** "Welcome back, {name}" + minimum display time (feels intentional).
- This is the first thing every user sees. Do it last so it reflects the actual init steps of the final app.

### Animations

- Confetti on congratulations screen (first open only). Use `react-native-reanimated` (already installed).
- Card expand/collapse on leftover page.
- Fade-in for Day Wrapped Up screen.
- Bottom sheet open/close animation (if not handled by the sheet library).

### Edge cases to audit

- What if the user changes their device clock backward? The app should not break — dates are read from the DB, not derived from "now − X".
- What if income is set for a very long cycle (e.g. 90 days)? Verify the daily budget formula handles it.
- What if all reservations and savings are ৳0 at cycle start? Modals should never be triggered.
- What if `end_date` is set to tomorrow and today is skipped entirely (starts_from = 'tomorrow')? Days remaining = 1 on the first day. Verify no divide-by-zero.
- What if the user has never reviewed a single day and the cycle ends? Congratulations screen should still show, stats should all show "—".

---

## Shared components needed across phases

These should be built when first needed and reused from Phase 3 onward:

| Component | First needed | Description |
|-----------|-------------|-------------|
| `CalendarModal` | Phase 2 | Date picker modal. Needs minDate/maxDate. Used in onboarding, new cycle form. |
| `BottomSheet` | Phase 3 | Modal container that slides up. Used for add spend, add extra cash, possibly others. |
| `AmountSlider` | Phase 4 | Slider + text input in sync. Used in Modal 1 and archive withdraw. |
| `NavPill` | Phase 3 | Bottom navigation with red dot indicator for missed reviews. |
| `DayCalendarGrid` | Phase 6 | Custom calendar grid with coloured dots. |
| `ConfirmationSheet` | Phase 7 | Reusable "confirm / cancel" bottom sheet. Used for leftover reset, withdraw full balance, skip missed day. |

---

## What depends on what (dependency map)

```
Phase 1 (Foundation)
    └── Phase 2 (Onboarding)     — needs DB + services + nav shell
            └── Phase 3 (Home)  — needs cycle data + CalendarModal + BottomSheet
                    └── Phase 4 (Validation Modals) — needs spend flow from Home
                            └── Phase 5 (Log Tab)   — needs staging + commit
                                    └── Phase 6 (Stats Tab) — needs committed data
                                    └── Phase 7 (End-of-cycle) — needs review complete, stats
                                            └── Phase 8 (More Tab) — no hard deps, but nice to have before Phase 9
                                                    └── Phase 9 (Notifications) — needs review time from Phase 8
                                                            └── Phase 10 (Polish) — needs full app
```

Phase 8 (More Tab) can technically be built in parallel with Phase 5 or 6 since it only touches the settings table. The recommended ordering above is safe; parallelising is an option if you want to build More while waiting on Log/Stats.

---

## Known risks summary

| Risk | Phase | Mitigation |
|------|-------|------------|
| expo-sqlite v16 requires `SQLiteProvider` context — incorrect setup breaks everything | 1 | Verify setup before building any services |
| `onboarding_state` partial data shape needs to be agreed on before onboarding is built | 2 | Define a `OnboardingPartialData` TypeScript type before starting Page 2 |
| Page 5 editable summary — all fields affect all others | 2 | Single shared `validateOnboardingSummary()` function, call on every change |
| Modal 1 has the most complex local state in the app | 4 | Build with useReducer, not multiple useState |
| Leftover page allocation graph | 7 | useReducer with a clearly typed action set |
| Midnight state transitions with the app backgrounded | 5, 7 | Use `AppState` listener to re-evaluate on foreground |
| Year view bar chart | 6 | Use react-native-gifted-charts (installed). react-native-svg peer dep already present. |
| No divide-by-zero when days remaining = 0 | 1 | Guard in `calcDailyBudget` — return 0 or ∞ based on context |
| Android notification channels | 9 | Set up channel at app boot, not at notification schedule time |

---

## Status tracker

| Phase | Item | Status |
|-------|------|--------|
| 1 | Clean template | ✅ |
| 1 | Database setup (10 tables) | ✅ |
| 1 | Service layer (8 services) | ✅ |
| 1 | Core calculation utilities | ✅ |
| 1 | Navigation shell | ✅ |
| 2 | Onboarding Page 1 — Welcome | ⬜ |
| 2 | Onboarding Page 2 — Basics | ⬜ |
| 2 | Onboarding Page 3 — Position | ⬜ |
| 2 | Onboarding Page 4 — Protect | ⬜ |
| 2 | Onboarding Page 5 — Summary | ⬜ |
| 2 | CalendarModal component | ⬜ |
| 3 | Home screen — all 5 states | ⬜ |
| 3 | Spending card + add spend bottom sheet | ⬜ |
| 3 | Extra Cash card + add extra cash bottom sheet | ⬜ |
| 3 | NavPill with red dot | ⬜ |
| 4 | AmountSlider component | ⬜ |
| 4 | Modal routing logic | ⬜ |
| 4 | SpendConsequencesModal | ⬜ |
| 4 | Modal 1 | ⬜ |
| 4 | Modal 2 | ⬜ |
| 5 | Log tab — State 1 (during day) | ⬜ |
| 5 | Log tab — State 2 (review mode) | ⬜ |
| 5 | Log tab — State 3 (day wrapped up) | ⬜ |
| 5 | Missed review detection + badge | ⬜ |
| 5 | Missed review modal flow | ⬜ |
| 5 | Log tab — cycle ended / waiting state | ⬜ |
| 6 | Stats — Cycle View calendar | ⬜ |
| 6 | Stats — Day summary modal | ⬜ |
| 6 | Stats — Reservations card + mid-cycle add | ⬜ |
| 6 | Stats — Year View stat cards + bar chart | ⬜ |
| 6 | Stats — Archived savings + withdraw flow | ⬜ |
| 7 | Congratulations screen | ⬜ |
| 7 | Waiting screen | ⬜ |
| 7 | Leftover page | ⬜ |
| 7 | New cycle form | ⬜ |
| 8 | More tab — Profile settings | ⬜ |
| 8 | More tab — Notification settings | ⬜ |
| 8 | More tab — Theme setting | ⬜ |
| 9 | Notification permission request | ⬜ |
| 9 | Daily review reminder scheduling | ⬜ |
| 9 | 30-minute follow-up + cancellation | ⬜ |
| 10 | Loading screen (new + returning user) | ⬜ |
| 10 | Confetti animation | ⬜ |
| 10 | Card animations (leftover page) | ⬜ |
| 10 | Edge case audit | ⬜ |
