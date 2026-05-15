# duit

A personal offline budget tracker built around pay cycles, not calendar months.

The core question it answers: **how much can I spend today?**

---

## Features

- **Pay cycle tracking** — set your income period (e.g. 25th to 25th), not tied to calendar months
- **Daily budget** — automatically calculated from your remaining pool divided by days left
- **Daily review** — confirm your spending each evening, pool recalculates for tomorrow
- **Reservations** — set aside money for recurring expenses (rent, bills) that won't affect daily budget
- **Savings** — protect a portion of income from the daily spending pool
- **Missed review catch-up** — if you skip a review, the app prompts you to catch up
- **Spend history** — full log grouped by pay cycle
- **Notifications** — daily reminder at your chosen review time
- **Offline** — everything runs locally on device, no account required

---

## Tech stack

- **Expo SDK 54** — managed workflow, new architecture
- **Expo Router v6** — file-based navigation
- **expo-sqlite** — local SQLite database
- **React Native** — inline styles
- **EAS Build + Update** — build and OTA update delivery

---

## Development setup

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (Android/iOS) to run on device.

---

## Build

```bash
npx eas build -p android --profile preview
```

Produces an APK for direct installation (no Play Store).

## Update (after code changes)

```bash
npx eas update --branch preview --message "what changed"
```

Pushes JS bundle update to installed apps — no reinstall needed.

---

## Project structure

```
app/
  (tabs)/         # Main tab screens: Home, Log, More
  onboarding/     # First-time setup flow
  new-cycle.tsx   # New pay cycle form
components/
  home/           # Home screen state components + modals
  ui/             # Shared UI components
services/         # All database access (no direct DB calls in components)
lib/
  db.ts           # Schema, migrations, date utilities
```

---

## Version

`0.1.0`
