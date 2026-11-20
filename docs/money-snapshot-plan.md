# Money snapshot card + editable catch-up

Status: **implemented**. This document is the single source of truth for the feature.

Branch: `feat/money-snapshot`, created from `main` at `7417abd` (the fast-forward
merge of `docs/agents-session-learnings`, which was already live on the preview
channel).

---

## 1. Problem

The daily review can be missed when the clock rolls past midnight (phone died, fell
asleep). The next morning the home screen shows only the catch-up screen, which lists
staged entries and asks for one total. All the money-position numbers from the home
screen ("left today", "left in cycle", savings, reservations) disappear exactly when
the user needs them to reconcile what they logged against the cash they actually have.

Today the user cannot:

- see how much money the app thinks is left, split by pool / savings / reservations;
- add, edit or delete items for the missed day(s) from the catch-up screen — only type
  a single overriding total;
- see a per-day preview when several days were missed.

## 2. Decisions (agreed with the owner)

| Topic | Decision |
| --- | --- |
| Card placement | Top of the content on three screens: catch-up, daily review, post-review. The whole screen scrolls; only the existing confirm button stays pinned |
| Card's main number | **Total across everything**, large and extra-bold; breakdown in small secondary rows underneath |
| Card contents | Left to spend, Savings (hidden if 0), each reservation with money left (hidden if 0), Total, then "Daily budget after" |
| Total maths | `left to spend + savings balance + reservation remainders` |
| Catch-up total | No input box. The total is the sum of the listed spends and updates live |
| Catch-up list | Editable: tap to edit, `×` to delete, `+ Add spend` to add |
| New entry's day | Latest missed day (only affects the stored record, not the money) |
| One day missed | That day stores the sum of its items |
| Several days missed | The total is spread evenly across the missed days on confirm; the last day absorbs rounding; a `≈ per day` line previews it |
| Savings / reservations | Untouched. Shown separately on the card. No footnote, no change to their maths |
| Negative numbers | "Left to spend" clamps at 0, matching the home screen |
| Database | No schema changes, no migrations, no new dependencies |
| Post-review screen | Card omits the daily-budget row; the old summary card loses its duplicate "New daily budget" row |

## 3. Wireframes (final)

### Card

```
┌───────────────────────────────────┐
│ WHERE YOUR MONEY STANDS           │
│                                   │
│ ৳9,540                            │  <- large, extra-bold
│ Total across everything           │
│ ───────────────────────────────── │
│ Left to spend          ৳4,240     │
│ Savings                ৳1,500     │
│ Rent (reserved)        ৳3,000     │
│ Loan (reserved)          ৳800     │
│ ───────────────────────────────── │
│ Daily budget after       ৳530     │
└───────────────────────────────────┘
```

### Catch-up screen — before

```
MISSED REVIEW
Catch up first.
You missed 2 reviews (Nov 16 - Nov 17). How much did you spend?

┌ Logged entries (3) ───────────────┐
│ coffee                     ৳120   │
│ bus                         ৳40   │
│ groceries                  ৳850   │
└───────────────────────────────────┘

TOTAL SPENT (ALL DAYS COMBINED)
┌ ৳ 1010 ───────────────────────────┐
└───────────────────────────────────┘

NOTE (OPTIONAL)
┌ Add a note... ────────────────────┐
└───────────────────────────────────┘

[        Confirm & continue        ]
```

### Catch-up screen — after

```
MISSED REVIEW
Catch up first.
You missed 2 reviews (Nov 16 - Nov 17). Check what's logged and add
anything you forgot.

┌ WHERE YOUR MONEY STANDS ──────────┐
│ ৳9,540                            │
│ Total across everything           │
│ ───────────────────────────────── │
│ Left to spend          ৳4,240     │
│ Savings                ৳1,500     │
│ Rent (reserved)        ৳3,000     │
│ Loan (reserved)          ৳800     │
│ ───────────────────────────────── │
│ Daily budget after       ৳530     │
└───────────────────────────────────┘

┌ Spending                  ৳1,010 ┐
│ coffee      ৳120              ×   │
│ bus          ৳40              ×   │
│ groceries   ৳850              ×   │
│         +  Add spend              │
└───────────────────────────────────┘
৳1,010 over 2 days ≈ ৳505/day

NOTE (OPTIONAL)
┌ Add a note... ────────────────────┐
└───────────────────────────────────┘

[        Confirm & continue        ]
```

### Daily review — after

Heading (`DAILY REVIEW` / `How'd today go?` / date), then the card, then the existing
spending card, then notes, then the pinned `Confirm review` button.

### Post-review — after

```
✅
You're done for today.
See you tomorrow.

┌ WHERE YOUR MONEY STANDS ──────────┐
│ ৳9,790                            │
│ Total across everything           │
│ ───────────────────────────────── │
│ Left to spend          ৳4,490     │
│ Savings                ৳1,500     │
│ Rent (reserved)        ৳3,000     │
│ Loan (reserved)          ৳800     │
└───────────────────────────────────┘

┌ Spent today              ৳760     ┐
│ Saved today              ৳140     │
└───────────────────────────────────┘

7h 12m until tomorrow
```

## 4. Spec

### 4.1 New file: `components/home/MoneySnapshot.tsx`

```ts
interface Props {
  poolLeft: number;                 // already clamped at 0 by the caller
  savingsBalance: number;
  reservations: ReservationRow[];   // remaining computed inside
  dailyBudgetAfter?: number | null; // null/undefined hides the row
}
```

Render order inside one card:

1. `WHERE YOUR MONEY STANDS` — 11pt `600SemiBold`, `colors.textSecondary`,
   letterSpacing 1, uppercase.
2. Big number `৳9,540` — ~40pt, `PlusJakartaSans_800ExtraBold`,
   `colors.textPrimary`, letterSpacing -1.5.
3. `Total across everything` — 12pt `400Regular`, `colors.textSecondary`.
4. Divider: 1px `colors.border`, ~14pt vertical margin.
5. Rows (flex row, space-between, ~6pt vertical padding):
   - `Left to spend` — label 13pt `600SemiBold` `textPrimary`; value 13pt
     `600SemiBold` `textPrimary`.
   - `Savings` — only when `savingsBalance > 0`; label 13pt `400Regular`
     `textSecondary`; value 13pt `600SemiBold` `textPrimary`.
   - One row per reservation whose remaining is `> 0`: label
     `${name} (reserved)`, same secondary style.
6. Divider.
7. `Daily budget after` — only when `dailyBudgetAfter` is a number; 12pt label
   `textSecondary`, 12pt value `600SemiBold` `textPrimary`.

Rules:

- `remaining = Math.max(0, r.amount - r.spent - r.released)`.
- `grandTotal = poolLeft + savingsBalance + sum(remaining)`.
- Card style: `backgroundColor: colors.card`, `borderRadius: 20`, padding 16, shadow
  `#000` / opacity 0.06 / radius 8 / offset `{ width: 0, height: 2 }` / elevation 2
  (same as the other home cards).
- **No horizontal margin inside the component.** Each screen supplies its own, because
  the screens differ: catch-up uses `paddingHorizontal: 20` on the scroll view, daily
  review uses `marginHorizontal: 16` on cards, post-review uses `paddingHorizontal: 24`.
- Money format everywhere: `৳${Math.floor(n).toLocaleString()}`.
- Use `useThemeColors()`; no inline hex colours.

### 4.2 Rewrite: `components/home/MissedReviewState.tsx`

Current props are replaced entirely (no `catchUpAmount` / `onChangeAmount`):

```ts
interface Props {
  cycleData: ActiveCycleData;
  savingsBalance: number;
  missedDays: MissedDay[];
  missedEntries: EntryRow[];
  navPillOffset: number;
  insets: EdgeInsets;
  note: string;
  onChangeNote: (v: string) => void;
  confirming: boolean;
  onConfirm: () => void;
  onReload: () => Promise<void>;      // parent re-fetches missedEntries
  onError: (message: string) => void; // parent shows its existing ErrorToast
}
```

Derived values:

```
missedTotal     = sum(missedEntries.amount)
poolLeft        = Math.max(0, cycleData.leftInCycle - missedTotal)
dailyBudgetAfter = cycleData.daysLeft > 0 ? poolLeft / cycleData.daysLeft : 0
```

Content inside the existing `KeyboardAvoidingView` -> `ScrollView` (keep current
paddings: `paddingTop: insets.top + 24`, `paddingHorizontal: 20`,
`paddingBottom: Math.max(insets.bottom, 24) + navPillOffset`):

1. `MISSED REVIEW` kicker (warning colour, unchanged).
2. Title `Catch up first.` (unchanged).
3. Subtitle (new copy):
   - 1 day: `You missed your review on {date}. Check what's logged and add anything you forgot.`
   - n days: `You missed {n} reviews ({firstDate} – {lastDate}). Check what's logged and add anything you forgot.`
   - Dates formatted as today (`month: 'short', day: 'numeric'`, via `fromDateStr`).
4. `MoneySnapshot` (wrapper `marginBottom: 16`).
5. Spending card, visually identical to the daily review's card:
   - Header row `Spending` + right-aligned total (both as in `ReviewState`).
   - One row per entry: `entry.note || 'general spending'` on the left, amount, then
     a `×` that opens the delete confirmation. The row body is `Pressable` -> edit.
   - Footer `+ Add spend`.
   - Empty list: header still shows `৳0`, footer still shows `+ Add spend`.
6. When `missedDays.length > 1`, a line under the card:
   `৳{missedTotal} over {n} days ≈ ৳{Math.floor(missedTotal / n)}/day`
   (12pt `textSecondary`).
7. Note field: unchanged label `NOTE (OPTIONAL)` and styling.
8. `Confirm & continue` button (unchanged).

Behaviour:

- `const db = useSQLiteContext()` in the component (existing pattern).
- Add target: `missedDays[missedDays.length - 1].id` -> `addEntry(db, dayId, note, amount)`.
- Edit: `updateEntry(db, entry.id, note, amount)`.
- Delete: `deleteEntry(db, entry.id)` after `DeleteConfirmModal`.
- Every successful mutation: `await onReload()`, then reset/close modal state.
- Failure: `console.error('[catch-up ...]', error)` + `onError('...')` with a plain
  message. **No empty catch blocks.**
- Reuse `SpendModal` with `poolExhausted={false}`, `hardCapError={null}`,
  `thresholdWarning={null}`, `canSave = amountNum > 0 && !saving`.
  So no pool caps or budget warnings on this screen.
- Amount input sanitising stays `v.replace(/[^0-9.]/g, '')`.
- Delete uses the existing `DeleteConfirmModal`.
- Follow the row layout and press targets used in `NormalState.tsx`.

### 4.3 `services/reviewService.ts` — `confirmCatchUpReview`

Keep the signature:

```ts
confirmCatchUpReview(db, missedDays, totalSpent, leftInCycle, note)
```

Algorithm:

```
if (missedDays.length === 0) return
const n = missedDays.length
const poolAfter = Math.max(0, leftInCycle - totalSpent)

let shares: number[]
if (n === 1) {
  shares = [totalSpent]
} else {
  const whole = Math.floor(totalSpent / n)
  shares = [...Array(n - 1).fill(whole), totalSpent - whole * (n - 1)]
}

BEGIN
for each day i:
  total_spent       = shares[i]
  reviewed_at       = new Date().toISOString()   // one timestamp for all
  pool_after_review = i === n - 1 ? poolAfter : null
  notes             = i === n - 1 ? (note.trim() || null) : null
  staged = 0 for every entry of every missed day
COMMIT
```

Keep the existing `BEGIN` / `COMMIT` / `ROLLBACK` structure. No other service changes.

### 4.4 `app/(tabs)/index.tsx`

- Remove `catchUpAmount` state, the pre-fill `useEffect` (around line 194), and the
  `parseFloat(catchUpAmount) || stagedTotal` fallback.
- `handleConfirmCatchUp`:
  `const total = data.missedEntries.reduce((s, e) => s + e.amount, 0);`
  then `confirmCatchUpReview(db, data.missedDays, total, data.cycleData.leftInCycle, catchUpNote)`.
- Catch-up render: pass `cycleData={cycleData}`, `savingsBalance={data.savingsBalance}`,
  `onReload={load}`, `onError={showError}`; drop `catchUpAmount` / `onChangeAmount`.
- `ReviewState`: add `savingsBalance={data.savingsBalance}`.
- Post-review block: after "See you tomorrow." insert

  ```tsx
  <MoneySnapshot
    poolLeft={Math.max(0, cycleData.leftInCycle)}
    savingsBalance={data.savingsBalance}
    reservations={cycleData.reservations}
  />
  ```

  and remove the `New daily budget` row from the existing summary card (the card above
  already covers it). Order: card, summary card (Spent today / Saved today), countdown.
- Keep everything else untouched.

### 4.5 `app/close-cycle.tsx`

- Remove `catchUpAmount` state and its use in `handleConfirmCatchUp`; compute the total
  from `missedEntries` the same way.
- Pass `cycleData={activeData}`, `savingsBalance={closeData?.savingsRemaining ?? 0}`,
  `onReload={load}`, `onError={setErrorMsg}`, `navPillOffset={0}`.
- No other changes.

### 4.6 `components/home/ReviewState.tsx`

- Add `savingsBalance: number` to props.
- Compute `todayTotal`, `poolLeft = Math.max(0, cycleData.leftInCycle - todayTotal)`,
  `dailyBudgetAfter = cycleData.daysLeft > 0 ? poolLeft / cycleData.daysLeft : 0`.
- Insert directly under the screen heading, above the spending card:

  ```tsx
  <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
    <MoneySnapshot
      poolLeft={poolLeft}
      savingsBalance={savingsBalance}
      reservations={cycleData.reservations}
      dailyBudgetAfter={dailyBudgetAfter}
    />
  </View>
  ```

## 5. Out of scope

- No change to savings or reservation maths. Using savings still lowers savings without
  adding to the spendable pool (deliberate; the savings modal says so).
- No changes to Log, Stats, Loans, onboarding, or the new-cycle planner.
- No date picker for added entries.
- No collapsible card.
- No database migration.
- No new dependencies.

## 6. Known limitations (accepted)

1. With several missed days, all itemised entries sit on the latest missed day while the
   stored day totals are even shares, so that day's Log detail list will not add up to
   its header total. Single-day misses are exact.
2. Backfilled day rows store the current daily budget, not the historical one. Pre-existing.
3. Money spent from savings or reservations still isn't reflected in "left to spend".
   That is why the card lists those balances separately.

## 7. Git workflow and constraints

- Base: `main` at `7417abd` (fast-forward merge of `docs/agents-session-learnings`).
- Feature branch: `feat/money-snapshot`.
- Pre-existing **uncommitted, unrelated** changes that must stay untouched:
  - deleted: `.superpowers/sdd/fix-report.md`, three files under
    `docs/superpowers/plans/`, three under `docs/superpowers/specs/`
  - untracked: `.opencode/`, `docs/future-plans.md`, `docs/images/Duit.png`,
    `docs/next-session-todo.md`
- Stage only by explicit path. Never `git add -A` / `git add .`. On Windows PowerShell,
  quote paths with parentheses, e.g. `git add 'app/(tabs)/index.tsx'`.
- Commit order:
  1. `docs: add money snapshot plan and spec` (this file)
  2. `feat(home): add money snapshot card and editable catch-up`
- No co-author attribution.
- Do not push. Do not merge to `main`. Do not touch `dev`.
- `docs/agents-session-learnings` must remain at `7417abd`.
- Do not update `docs/carryover-plan.md`; it belongs to a different feature.

## 8. Acceptance checklist

Build:

- [ ] `npx tsc --noEmit` clean
- [ ] `expo lint` clean
- [ ] no `catchUpAmount` references remain
- [ ] no empty catch blocks, no `console.log`, no commented-out code
- [ ] `git status --short` shows only the pre-existing unrelated changes
- [ ] `git log -1 docs/agents-session-learnings` still `7417abd`
- [ ] work is committed only on `feat/money-snapshot`

On the phone (after push + `npx eas update --channel preview`):

1. Close and reopen the app to pick up the update.
2. Normal home before review time: unchanged.
3. Force a missed review by moving the phone's date forward a day or two, then reopening.
4. Catch-up screen: card on top with the big total; compare wallet with `Left to spend`;
   tap `+ Add spend` with the difference and watch the big number and `Left to spend`
   drop live.
5. Edit one item and delete another; numbers follow every change.
6. With two or more missed days: the `≈ ৳X/day` line appears; after confirming, Log shows
   even per-day amounts.
7. Daily review screen: card appears between heading and spending; deleting a spend raises
   the numbers immediately.
8. Post-review screen: card without the daily-budget row; the summary card no longer
   repeats "New daily budget".
9. Close Cycle with unreviewed days: the same catch-up screen.
10. Set the phone's date back.

## 9. Progress

- [x] Plan and spec agreed
- [x] Branch created from merged main
- [x] Implementation
- [x] Typecheck, lint, commit
