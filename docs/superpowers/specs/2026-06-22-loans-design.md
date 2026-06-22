# Loans Feature — Design Spec
Date: 2026-06-22

## Problem
Users lend and borrow money in real life with no way to track it inside the app. No visibility into who owes them, who they owe, or how repayments connect to their budget cycles.

## Solution
A dedicated Loans tab for tracking money given and borrowed. Loans are standalone but integrate with the cycle at two points: (1) the new-cycle form surfaces active loans so the user can act on returned money or see auto-created repayment reservations, and (2) mid-cycle, users can mark returned money and choose what to do with it immediately.

---

## Navigation
- New 4th tab: **Loans**, added to the existing NavPill alongside Home, Log, More.

---

## Loans Tab (main view)

Two sections: **I Lent** and **I Borrowed**.

Each loan card shows:
- Person name
- Original amount + date
- Status: active or settled (✓)
- For borrowed with repayment plan: progress bar + "X of Y paid"
- "Pending" badge if any receipt exists with action = 'pending' (money returned but no action taken yet)

Settled loans stay visible in both sections (historical record).

Empty state: illustrated prompt to add first loan via [+].

[+] button opens a sheet asking direction: "I lent" or "I borrowed."

---

## Adding a Loan — I Lent

Fields:
- Person name (required)
- Amount (required)
- Date given (optional, defaults to today)
- Note (optional)

No repayment plan. Loan is created as `active`.

---

## Adding a Loan — I Borrowed

Fields:
- Person name (required)
- Amount (required)
- Date borrowed (optional, defaults to today)
- Note (optional)
- Repayment plan toggle (optional)

**Repayment plan (when toggled on):**
Two-way live calculator:
- Enter amount/month → app calculates months needed (amount ÷ monthly = months, rounded up)
- Enter number of months → app calculates amount/month (amount ÷ months)
Both fields update each other as the user types.

Repayment starts from the next cycle created after saving the loan.

---

## Loan Detail — I Lent

Shows: person, original amount, date, note, status, list of all receipts (partial returns).

**If active:**
- "Record return" button → opens return flow (see below)
- "Mark as settled" button (for when loan is fully returned/forgiven)
- "Delete" button (removes loan entirely)

**Return flow:**
User enters the amount being returned (partial or full).
Then picks what to do with it:
- **Add to pool** — increases leftInCycle and recalculates daily budget
- **Add to savings** — increases cycle savings balance
- **Create a reservation** — opens reservation creation with amount pre-filled
- **Already used it** — closes the loan/partial without any budget action
- **Do nothing yet** — records receipt as "pending"; user can act on it later

Pending receipts surface again at the next cycle start.

**If settled:** read-only view showing full history of returns.

---

## Loan Detail — I Borrowed

Shows: person, original amount, date, note, repayment plan (if any), status, repayment history.

**If active with repayment plan:**
- Progress bar: months paid / total months
- List of each cycle's repayment reservation with status

**If active:**
- "Mark as fully settled" button
- "Delete" button

**If settled:** read-only history.

---

## Cycle Start Integration (new-cycle.tsx)

A new **Loans** step is always shown when at least one active loan exists. It appears after the existing cycle setup steps, before the final confirmation.

### Money owed to you (I Lent — active)
Each active "I lent" loan is listed. For each:
- Toggle: "Got it back?" 
- If toggled on: shows inline "what to do" options (same as return flow above)
- Pending receipts from previous cycles also appear here for resolution

### Auto-reservations (I Borrowed — with repayment plan)
For each active borrowed loan with a repayment plan that hasn't been fully paid:
- A reservation is auto-created for this cycle: "৳X for [person] (loan repayment)"
- Shown in the loans step as a preview — user can see it but it's already added
- This reservation behaves exactly like any other reservation (editable, deletable)
- If the user deletes or edits it, that month's repayment is not counted toward loan progress unless marked manually

### Loan progress tracking
A repayment month is counted as paid only when the auto-created reservation is marked as **spent** (not just created). If the reservation is deleted or released, that month is skipped — loan progress does not advance.

---

## Mid-Cycle: Acting on Pending Receipts
From the Loans tab, any loan with a pending receipt (money returned but no action taken) shows a "Pending" badge. Tapping opens the detail where the user can pick an action at any time.

---

## Data Model

### `loans` table
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| type | TEXT | 'lent' or 'borrowed' |
| person_name | TEXT | |
| original_amount | REAL | |
| note | TEXT nullable | |
| loaned_at | TEXT | date string |
| status | TEXT | 'active' or 'settled' |
| created_at | TEXT | timestamp |

### `loan_receipts` table
Tracks each instance of money coming back on a "lent" loan (partial or full).

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| loan_id | INTEGER FK → loans | CASCADE delete |
| amount | REAL | amount returned |
| action | TEXT | 'pool', 'savings', 'reservation', 'used', 'pending' |
| cycle_id | INTEGER FK nullable | which cycle this was actioned in |
| created_at | TEXT | |

### `loan_repayment_plans` table
One row per borrowed loan with a plan.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| loan_id | INTEGER FK → loans | CASCADE delete, UNIQUE |
| amount_per_month | REAL | |
| total_months | INTEGER | |

### `loan_repayment_records` table
One row per cycle where a repayment reservation was auto-created.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| loan_id | INTEGER FK → loans | CASCADE delete |
| cycle_id | INTEGER FK → cycles | |
| reservation_id | INTEGER FK nullable → reservations | null if user deleted it |
| created_at | TEXT | |

---

## Key Logic Rules

- `amount_returned` on a lent loan = SUM of all `loan_receipts.amount` for that loan
- Loan auto-settles when `amount_returned >= original_amount`
- Repayment progress = COUNT of `loan_repayment_records` WHERE the linked reservation was fully spent
- Loan auto-settles when `months_paid >= total_months`
- Auto-reservation creation happens inside `createCycle()` — for every active borrowed loan with a plan that has remaining months
- Adding to pool: increases `pool_leftover` equivalent — implemented by updating `days.pool_after_review` on the last reviewed day if one exists, otherwise adjusts the cycle's effective pool
- "Already used it" and "pending" actions require no budget mutation

---

## What's Out of Scope
- Interest / fees tracking
- Multiple partial lenders for one loan
- Loan notifications / reminders
- Cross-currency loans
- Spending time analytics (future, separate feature)
- Log tab accordion (separate feature, separate branch)
