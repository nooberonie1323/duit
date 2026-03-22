# Duit — Database Schema

> Reference for Claude Code when building the app. Do not modify without also updating `design.md` if the change reflects a design decision.

---

## Overview

Everything lives in a single SQLite database on-device via `expo-sqlite`. No backend, no sync, no auth.

**10 tables:**

```
settings
cycles
days
spend_entries
extra_cash_entries
modal_pulls
reservations
archived_savings
archive_withdrawals
onboarding_state
```

---

## Relationships (quick map)

```
settings          — single row, global
onboarding_state  — single row, transient

cycles
  └── days               (cycle_id)
  └── spend_entries      (cycle_id)
  └── extra_cash_entries (cycle_id)
  └── reservations       (cycle_id)
  └── archived_savings   (from_cycle_id)

spend_entries
  └── modal_pulls        (spend_entry_id)

modal_pulls
  └── reservations       (reservation_id, nullable)

archive_withdrawals — standalone, no FK needed
```

---

## Tables

---

### `settings`

Always exactly one row. Created on first launch.

```sql
CREATE TABLE settings (
  id                    INTEGER PRIMARY KEY DEFAULT 1,
  name                  TEXT    NOT NULL,
  notifications_enabled INTEGER NOT NULL DEFAULT 1,  -- 0 or 1
  review_time           TEXT    NOT NULL DEFAULT '22:00', -- '20:00' | '21:00' | '22:00' | '23:00'
  theme                 TEXT    NOT NULL DEFAULT 'system', -- 'system' | 'light' | 'dark'
  onboarding_complete   INTEGER NOT NULL DEFAULT 0   -- 0 or 1
);
```

**Notes:**
- `review_time` is stored as a 24-hour time string. The four valid options map to 8pm, 9pm, 10pm, 11pm.
- `onboarding_complete` flips to 1 when the user confirms the final onboarding summary page. Until then, the app returns to the onboarding flow on every open.
- Only one row ever exists (id = 1). Use `UPDATE` not `INSERT` after initial creation.

---

### `onboarding_state`

Persists mid-onboarding progress so that if the user kills the app before finishing, they return to the right page with their data intact.

```sql
CREATE TABLE onboarding_state (
  id           INTEGER PRIMARY KEY DEFAULT 1,
  current_page INTEGER NOT NULL DEFAULT 1, -- 1 through 5
  partial_data TEXT    NOT NULL DEFAULT '{}' -- JSON blob of form values entered so far
);
```

**Notes:**
- Only one row ever exists (id = 1).
- `partial_data` stores whatever the user has typed so far as a JSON object — name, dates, income, savings, reservations, etc. Shape matches the onboarding form fields.
- Delete this row (or reset it) once `onboarding_complete` is set to 1 in settings.

---

### `cycles`

One row per pay cycle, past and present.

```sql
CREATE TABLE cycles (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date        TEXT    NOT NULL, -- YYYY-MM-DD
  end_date          TEXT    NOT NULL, -- YYYY-MM-DD
  income            REAL    NOT NULL,
  budget_alert      REAL    NOT NULL DEFAULT 0, -- the daily threshold warning. 0 = no warnings
  savings_amount    REAL    NOT NULL DEFAULT 0, -- savings set at cycle start (protected)
  already_spent     REAL    NOT NULL DEFAULT 0, -- amount entered on "where are you now" page
  starts_from       TEXT    NOT NULL DEFAULT 'today', -- 'today' | 'tomorrow'
  pool_carryover    REAL    NOT NULL DEFAULT 0, -- pool amount carried in from previous cycle's leftover page
  pool_balance      REAL    NOT NULL DEFAULT 0, -- running committed pool balance, updated on each review confirm
  savings_balance   REAL    NOT NULL DEFAULT 0, -- starts = savings_amount, decreases when modal pulls happen
  status            TEXT    NOT NULL DEFAULT 'active', -- 'active' | 'ended' | 'waiting'
  created_at        TEXT    NOT NULL  -- ISO timestamp
);
```

**Notes:**
- `pool_balance` is updated every time review is confirmed. It reflects committed entries only — staged entries do not affect it.
- `savings_balance` starts equal to `savings_amount` and decreases permanently each time a modal pull takes from savings. It never increases mid-cycle.
- `starts_from` affects the daily budget formula: 'today' divides by (days remaining + 1), 'tomorrow' divides by days remaining.
- `pool_carryover` is set from the leftover allocation page at the end of the previous cycle. It is added to the initial pool balance.
- `status` transitions: active → ended (at midnight on end_date) → (waiting, if user taps "pay was delayed") → back to active when a new cycle starts.
- A cycle with `status = 'waiting'` means the previous cycle ended but the user hasn't started a new one yet (pay delayed or future start date chosen).

**Initial pool balance formula (computed once at cycle creation):**
```
initial pool = income + pool_carryover - savings_amount - already_spent - SUM(reservation original_amounts)
```
Store this as the starting `pool_balance`.

---

### `days`

One row per calendar day that has been reviewed or skipped. Days that have not yet been reviewed do not have a row.

```sql
CREATE TABLE days (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id      INTEGER NOT NULL,
  date          TEXT    NOT NULL, -- YYYY-MM-DD
  daily_budget  REAL    NOT NULL, -- the budget allocated for this day, calculated and stored at review time
  total_spent   REAL    NOT NULL DEFAULT 0, -- sum of committed spend entries for this day
  total_extra   REAL    NOT NULL DEFAULT 0, -- sum of committed extra cash entries for this day
  flag          TEXT    NOT NULL, -- 'green' | 'blue' | 'rough' | 'amber' | 'grey'
  note          TEXT,             -- optional review note, editable until midnight
  is_reviewed   INTEGER NOT NULL DEFAULT 0, -- 1 = user confirmed review
  is_skipped    INTEGER NOT NULL DEFAULT 0, -- 1 = user skipped this missed day (flag will be 'grey')
  reviewed_at   TEXT,             -- ISO timestamp of when review was confirmed
  FOREIGN KEY (cycle_id) REFERENCES cycles(id),
  UNIQUE (cycle_id, date)
);
```

**Notes:**
- `daily_budget` is calculated at review time and locked in. It reflects the pool balance divided by remaining days, incorporating any changes from that day's spends and extra cash.
- `flag` rules:
  - `green` — daily_budget − total_spent > 0 (underspent)
  - `blue` — daily_budget − total_spent = 0 (exactly on budget)
  - `rough` — daily_budget − total_spent < 0 (overspent)
  - `amber` — missed review (day passed without the user reviewing). `is_reviewed = 0`, `is_skipped = 0`.
  - `grey` — skipped (`is_skipped = 1`). Has no spend data.
- Extra cash does not affect the flag. Flag is based on daily_budget vs. total_spent only.
- `note` is editable from the "day wrapped up" screen until midnight. After midnight it becomes read-only in the Stats tab.
- Amber days: a row is created for them when a missed review is detected (e.g. at midnight or when the user opens the app the next day). `flag = 'amber'`, `is_reviewed = 0`, `is_skipped = 0`.

---

### `spend_entries`

Individual spend items. Each spend is its own row. Multiple spends can exist per day.

```sql
CREATE TABLE spend_entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id     INTEGER NOT NULL,
  day_date     TEXT    NOT NULL, -- YYYY-MM-DD — the date this spend belongs to
  amount       REAL    NOT NULL,
  note         TEXT,             -- optional label. If empty, UI shows "general spending"
  entry_time   TEXT    NOT NULL, -- HH:MM — when the spend happened (user can edit during review)
  is_staged    INTEGER NOT NULL DEFAULT 1, -- 1 = staged (not yet committed), 0 = committed
  created_at   TEXT    NOT NULL,           -- ISO timestamp
  committed_at TEXT,                       -- ISO timestamp, set when review is confirmed
  FOREIGN KEY (cycle_id) REFERENCES cycles(id)
);
```

**Notes:**
- Staged entries (is_staged = 1) are written to the DB immediately when the user logs a spend. They persist across app kills.
- Entries are committed (is_staged = 0) when the user confirms review. `committed_at` is set at that point.
- Deleting a staged entry reverses all effects: the amount returns to the pool, and any `modal_pulls` linked to this entry are also reversed (savings_balance and reservation balances restored).
- Entries cannot be deleted after being committed (only editable during the active review session before confirm).
- `entry_time` can be edited during review. New entries added during review default to current time. Time must be within the current review day — future times and times from already-committed days are blocked.

---

### `extra_cash_entries`

Individual extra cash items. Same staging model as spend_entries.

```sql
CREATE TABLE extra_cash_entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id     INTEGER NOT NULL,
  day_date     TEXT    NOT NULL, -- YYYY-MM-DD
  amount       REAL    NOT NULL,
  note         TEXT,             -- optional. If empty, UI shows "extra cash"
  entry_time   TEXT    NOT NULL, -- HH:MM
  is_staged    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL,
  committed_at TEXT,
  FOREIGN KEY (cycle_id) REFERENCES cycles(id)
);
```

**Notes:**
- Extra cash does not affect the day flag calculation. It adds to the pool when committed (via review confirm), which recalculates the daily budget for remaining days.
- Same deletion rules as spend_entries. No modal pulls are ever triggered by extra cash entries.

---

### `modal_pulls`

Tracks which source (savings or a specific reservation) was pulled from when a spend was logged, and how much. This is the only way to correctly reverse a staged spend entry when the user deletes it.

```sql
CREATE TABLE modal_pulls (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  spend_entry_id   INTEGER NOT NULL,
  source_type      TEXT    NOT NULL, -- 'savings' | 'reservation'
  reservation_id   INTEGER,          -- FK to reservations.id, only set when source_type = 'reservation'
  amount           REAL    NOT NULL,
  FOREIGN KEY (spend_entry_id) REFERENCES spend_entries(id),
  FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);
```

**Notes:**
- One spend entry can have multiple modal_pulls (e.g. pulled ৳200 from savings AND ৳150 from a reservation).
- When a staged spend entry is deleted: loop through its modal_pulls and restore each amount to its source. For savings: add back to cycles.savings_balance. For reservations: add back to reservations.current_balance.
- When review is confirmed, modal_pulls are kept as a permanent record — they document what happened to savings and reservations.
- If the user hits "Proceed anyway" (accepts the lower daily budget without pulling anything), no modal_pulls rows are created for that spend.

---

### `reservations`

Per-cycle named reservations. Each reservation is money set aside from the pool for a specific planned expense.

```sql
CREATE TABLE reservations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id              INTEGER NOT NULL,
  name                  TEXT    NOT NULL, -- required, max 30 characters
  original_amount       REAL    NOT NULL, -- amount set when reservation was created
  current_balance       REAL    NOT NULL, -- decreases as modal pulls happen; starts = original_amount
  is_staged             INTEGER NOT NULL DEFAULT 0, -- 1 = mid-cycle reservation not yet committed
  carried_from_cycle_id INTEGER,          -- if carried from a previous cycle's leftover page, the source cycle id
  created_at            TEXT    NOT NULL,
  FOREIGN KEY (cycle_id) REFERENCES cycles(id)
);
```

**Notes:**
- Reservations created during onboarding or the new cycle form have `is_staged = 0` from the start (they are committed immediately as part of cycle creation).
- Mid-cycle reservations (added from the Stats tab Cycle View) have `is_staged = 1` until review is confirmed. They behave like spend entries: staged immediately, committed at review, reversible while staged.
- `current_balance` decreases when a modal pull takes from this reservation. It cannot go below 0.
- The initial pool_balance on the cycle is reduced by `original_amount` at creation.
- When `current_balance = 0`, the reservation is depleted. It still shows in the UI for context but is greyed out in modal flows.

---

### `archived_savings`

One row per contribution to the archive. The archive grows over time as cycles end and unallocated leftovers are archived.

```sql
CREATE TABLE archived_savings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  from_cycle_id INTEGER NOT NULL, -- which cycle's leftover created this entry
  amount        REAL    NOT NULL,
  archived_at   TEXT    NOT NULL, -- ISO timestamp
  FOREIGN KEY (from_cycle_id) REFERENCES cycles(id)
);
```

**Notes:**
- The total archive balance is: `SUM(archived_savings.amount) − SUM(archive_withdrawals.amount)`.
- Do not store a running total — always calculate it from these two tables.
- Each row corresponds to one cycle's unallocated leftover being archived. If the user explicitly archived everything (no unallocated remainder), no row is created.

---

### `archive_withdrawals`

Records each withdrawal from the archive (money moved back into the active cycle).

```sql
CREATE TABLE archive_withdrawals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  amount      REAL NOT NULL,
  destination TEXT NOT NULL, -- 'pool' | 'reservation' | 'expense'
  cycle_id    INTEGER NOT NULL, -- the active cycle at the time of withdrawal
  created_at  TEXT NOT NULL
);
```

**Notes:**
- `destination` records where the money went: into the pool, into a reservation (pool → reservation), or logged as a spend (pool → spend).
- The downstream effects (pool_balance update, reservation creation, spend_entry creation) happen in the respective tables. This table is just the withdrawal record.
- Used together with `archived_savings` to compute the current archive balance.

---

## Calculated values (do not store)

These are derived on the fly from the tables above. Do not add columns for them.

| Value | How to calculate |
|---|---|
| **Left today** | Today's `daily_budget` (from cycle formula) − SUM of today's staged + committed spend_entries |
| **Current daily budget** | `pool_balance ÷ days remaining in cycle` |
| **Days remaining** | Count of calendar days from today to `cycles.end_date` inclusive |
| **Savings balance** | `cycles.savings_balance` (already stored — updated on each modal pull) |
| **Total archive balance** | `SUM(archived_savings.amount) − SUM(archive_withdrawals.amount)` |
| **Cycle avg per day** | `SUM(total_spent of reviewed days) ÷ COUNT(reviewed days)` |
| **Good days count** | COUNT of days where flag = 'green' or 'blue' |
| **Rough days count** | COUNT of days where flag = 'rough' |
| **Days missed count** | COUNT of days where flag = 'amber' (excludes skipped) |

---

## Key rules (never break these)

- **Savings is protected.** `cycles.savings_balance` only decreases via explicit modal pulls. Never touch it for regular spending.
- **Staged entries survive app kills.** Always write to the DB immediately when an entry is created — never hold in memory only.
- **Staged entries are reversible.** Deleting a staged spend must reverse its modal_pulls. Deleting a staged extra_cash entry just removes the row.
- **Committed entries are permanent.** Once review is confirmed (is_staged → 0), entries cannot be deleted — only editable during the active review session before confirm is tapped.
- **pool_balance reflects committed entries only.** Staged entries affect the live UI preview but not pool_balance. Update pool_balance only on review confirm.
- **One day row per date per cycle.** Enforce with the UNIQUE constraint on (cycle_id, date).
- **Missed days get a row.** When a day passes without review, create a row with flag = 'amber', is_reviewed = 0, is_skipped = 0. Do this at midnight or on next app open — whichever comes first.
- **All DB access goes through a service layer.** No component queries SQLite directly. All reads and writes go through a dedicated db service (equivalent to the `db.js` pattern in prd.md).
