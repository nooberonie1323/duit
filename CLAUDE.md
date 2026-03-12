# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Duit?

Offline-only personal budget app for one user (Augustin). Answers one question daily: **how much can I spend today?** Runs on pay cycles (pay date → next pay date), not calendar months. No backend, no auth, no sync — everything lives in SQLite on-device.

Full product spec: `docs/prd.md`. Progress log and remaining tasks: `docs/progress.md`.

## Commands

```bash
npx expo start          # Start dev server (scan QR in Expo Go)
npx expo start --android
npx expo start --ios
```

There are no tests yet. No linter config has been set up.

## Tech Stack

- **Expo SDK 55** + React Native 0.83
- **Expo Router v55** — file-based routing, `app/` directory
- **expo-sqlite** — on-device SQLite, hook-based (`useSQLiteContext`)
- **NativeWind v4** + **Tailwind CSS v3** — styling (NOT v5, NOT Tailwind v4)
- **Gluestack UI v3** — component library built on NativeWind (run `npx gluestack-ui init` to generate component files into `components/ui/` if not yet done)
- **DM Sans** — font loaded via `@expo-google-fonts/dm-sans`

## Architecture

### Data flow
All database access is centralised in `services/db.js`. **Components never call SQLite directly** — they import named functions from `db.js`. The `SQLiteProvider` wraps the entire app in `app/_layout.jsx` and calls `initDatabase()` on first run, which creates all tables and seeds default reservation tags.

To access the DB inside any screen: `const db = useSQLiteContext()` then pass `db` into `db.js` functions.

### Routing
Expo Router file-based:
- `app/_layout.jsx` — root: font loading, SQLite init, splash screen
- `app/(tabs)/` — main tab group (Home, Log, Reservations, Stats, Settings)
- `app/onboarding.jsx` — first-launch wizard, redirects to `/(tabs)` on finish

**First-launch routing not yet implemented** — `app/_layout.jsx` needs to check `getActiveCycle()` after DB init and redirect to `/onboarding` if no active cycle exists.

### Budget calculation model
```
Budget Pool = Income − Savings − Reservations − Already Spent + Carryover
Daily Budget = Budget Pool ÷ Remaining Days in Cycle
```
Surplus/deficit from any day spreads across **all** remaining days automatically — this is implicit in the formula (remaining pool ÷ remaining days recalculates every time). Savings is never touched by spending. All calculation logic lives in `services/db.js` (`getDailyBudget`, `getRemainingPool`).

### Styling conventions
- Use Tailwind classes via NativeWind for everything
- Custom design tokens are in `tailwind.config.js` — use them (`bg-indigo`, `text-textSub`, `bg-indigo-light`, etc.)
- `constants/colors.js` exports the same tokens as JS values for use in `StyleSheet` or inline styles where Tailwind can't reach (e.g. shadow colors, chart fills)
- Card pattern: `bg-surface border border-border rounded-card p-4`
- Primary button: `bg-indigo rounded-btn` with indigo shadow
- Extra cash is always `text-extra` / `bg-extra-light` (sky blue) — never mix with indigo

### Database schema (5 tables)
| Table | Purpose |
|---|---|
| `cycles` | One row per pay cycle, `is_active=1` for current |
| `daily_entries` | One row per day per cycle — spend, extra cash, note, flag, tags |
| `reservation_tags` | Reusable named tags (seeded: Food, Transport, Luna, Emergency, Fun) |
| `reservations` | Per-cycle reserved amounts linked to a tag |
| `savings_transactions` | Audit log every time savings is moved in or out |

Dates are stored as `TEXT` in `YYYY-MM-DD` format. Tags in `daily_entries` are stored as a JSON array string.

## Key rules (never break)
- Savings is always protected — only moved via explicit `touchSavings()` call
- One daily entry per day — `logDailySpend()` upserts, never appends
- Reservations can only be created at cycle start
- All DB access through `services/db.js` — no inline `db.execAsync` in components
- Extra cash is always visually distinct (sky blue `extra` color) from regular budget (indigo)
