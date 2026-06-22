# Use Savings Feature — Design Spec
Date: 2026-06-22

## Problem
Savings set at cycle creation are immutable. If a user spends from savings mid-cycle (emergency), there is no way to record it. The displayed savings balance becomes incorrect and the user has no paper trail.

## Solution
Allow users to record partial or full withdrawals from savings mid-cycle via a two-step modal accessible by tapping the savings pill on the home screen.

## User Flow

### Entry Point
- Tap the savings pill on the home screen (existing green pill showing `Savings ৳X`)
- If savings > 0: opens Step 1 (input modal)
- If savings = 0 (fully used): opens read-only history modal

### Step 1 — Input
- Title: "Use Savings" with "Step 1 of 2"
- Shows remaining savings balance
- Optional note field ("What did you use it for?")
- Amount field (numeric, currency)
- Validation (inline, on Continue press):
  - Amount must be > 0
  - Amount must not exceed remaining savings
- Continue button: disabled until valid amount entered

### Step 2 — Confirmation (friction screen)
- Title: "Step 2 of 2" with amber/warning tone
- Warning heading: "You're dipping into your savings"
- Summary card showing: amount being used, remaining after, percentage of original savings consumed
- Explanatory note: "This is recorded but does not affect your daily budget."
- Two actions: "Yes, I used this ✓" (amber/red) and "Go back"

### After Confirm
- Savings balance decreases by the entered amount
- Daily budget pool is NOT affected (savings are separate from pool)
- Home screen pill updates:
  - Partially used: shows `Savings ৳1,200 / ৳2,000` (remaining / original)
  - Fully used: shows `Savings ৳0 ✓` with tick, pill grayed out but still tappable

### Fully-Used Pill Modal (read-only)
- Title: "Savings (fully used)"
- Shows original amount
- Shows history list: each withdrawal with note, amount, date
- Shows ৳0 remaining

## Data Model
- New table: `savings_withdrawals`
  - `id` INTEGER PRIMARY KEY
  - `cycle_id` INTEGER (FK → cycles.id)
  - `amount` REAL NOT NULL
  - `note` TEXT
  - `created_at` TEXT (ISO timestamp)
- `cycles.savings` field is NOT modified — original intent preserved
- Remaining savings = `cycles.savings` minus sum of all `savings_withdrawals` for the cycle

## What Does NOT Change
- Daily budget calculation — savings withdrawals do not affect pool or daily budget
- The `cycles.savings` column — stores the original goal, never mutated
- Reservation flow — unchanged

## Key Design Decisions
- Two-step modal (vs one-step) to create intentional friction — savings should feel like a significant decision, unlike reservations
- Amber/warning color on confirmation step vs green for normal actions
- Pill persists after full use (with tick) — matches reservation pill behavior, maintains visibility

## Out of Scope
- Undoing a savings withdrawal
- Savings across multiple cycles
- Transferring used savings amount to a spend entry
