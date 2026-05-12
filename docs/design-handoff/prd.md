# Duit — MVP Product Requirements Document

> Working doc. This is the simplified MVP spec agreed on May 2026. Built web-first with Expo, intended for mobile after.

---

## What is Duit?

A personal budgeting app that answers one question: **how much can I spend today?**

Budget runs on pay cycles (pay date → next pay date), not calendar months. Offline only. Single user.

---

## Tech Stack

- Expo (web-first, mobile later)
- React Native / NativeWind
- SQLite (via expo-sqlite)
- Currency: Bangladeshi Taka (৳)

---

## App Flow

### New user

Loading screen → Onboarding → Home

### Returning user

Loading screen → Home (or Missed Review prompt if applicable)

---

## Screens & Features

---

### 1. Loading Screen

**New user:**

- App name / logo
- Progress bar (reflects real init steps: loading fonts → database → ready)

**Returning user:**

- "Welcome back, {name}"
- Minimum display time so it feels intentional, not a flash

---

### 2. Onboarding

One-time, step-by-step. Progress is persisted — if the user kills the app mid-onboarding and reopens, they return to where they left off.

---

#### Page 1 — Welcome

- App name / logo
- "Get Started" button

---

#### Page 2 — The Basics

| Field            | Rules                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name             | Required. Max 20 characters.                                                                                                                               |
| Cycle start date | Date picker. When they got paid.                                                                                                                           |
| Cycle end date   | Date picker. Must be at least 2 days after start date. Hard block otherwise.                                                                               |
| Income           | How much they have this cycle. Must be ৳1 or more. Hard block if ৳0 or below.                                                                              |
| Budget alert     | Daily budget floor. When daily budget drops to or below this after a spend, user is warned. Accepts ৳0 (no warnings) or any positive number. No negatives. |

**Budget alert behaviour:**

- If ৳0 → inline message: "৳0 means no warnings — the app won't flag low daily budgets."
- If above ৳0 → app calculates estimated daily budget (income ÷ days in cycle) and compares. If alert > estimated daily budget → inline warning: "Your budget alert is higher than your estimated daily budget of ৳X. You may want to lower it." Non-blocking — user can still proceed.

---

#### Page 3 — Where Are You Now? _(skippable)_

For users who are starting mid-cycle and have already spent some money.

Two mutually exclusive inputs:

- **Already spent** → app calculates `still have = income − already spent`
- **Still have** → used directly

If both fields left empty → Next button becomes **Skip**. Treated as ৳0 already spent.

**Validation:**

- If already spent ≥ income, or still have = ৳0 → hard block. Cannot proceed.
- If result drops pool below budget alert → inline warning. Non-blocking.

**Start from today or tomorrow?**

- Affects the days divisor in the daily budget formula.
- Defaults to "today."
- Hidden if cycle start date is in the future.

---

#### Page 4 — Protect Your Money _(skippable)_

| Field        | Rules                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| Savings      | Fixed amount set aside. Never touched by spending. Optional.                                               |
| Reservations | Named amounts for specific planned expenses. Each needs a name (max 30 chars). Multiple allowed. Optional. |

- As user adds savings/reservations, daily budget recalculates live on screen.
- If nothing added → Next becomes **Skip**.
- Hard block if pool would hit ৳0.
- Inline warning if daily budget drops below budget alert. Non-blocking.

---

#### Page 5 — Summary

- Shows all fields from Pages 2–4 in one place.
- All fields editable inline.
- Shows the final calculated daily budget.
- Confirm → Home screen.

**Validation on this page:**

- Hard block if pool would hit ৳0. Confirm button disabled until resolved.
- Inline warning if daily budget drops below budget alert. Non-blocking.
- If cycle start date is changed to a future date → "Start from today or tomorrow?" is hidden. If changed back to today, it reappears defaulting to "today."

---

### 3. Home Screen

Bottom nav: **Home | Log | Stats | More**

#### Layout (top to bottom)

1. **Hero area** — forest green card. Shows date, day of cycle, and the big "Left today" number.
   - "Left today" = today's daily budget minus total staged spends for today.
2. **Cycle Overview card** — three stats:
   - Left in cycle (total remaining budget pool)
   - Days left
   - Daily average (total spent ÷ days reviewed so far. Shows "—" until one day is reviewed)
3. **Spending card** — shows total spent today + "+ Add spend" button.
4. **Log card** — appears below spending card when entries exist. Scrollable list (internal scroll, max height ~280px). Tapping a row opens edit/delete modal.

#### Home screen states

| State                                 | What shows                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| Normal                                | Standard layout above                                                              |
| Review in progress                    | Entire home replaced with: "Finish your review to continue." Nothing interactive.  |
| Post-review, pre-midnight             | Entire home shows: "You're done for today. See you tomorrow." Nothing interactive. |
| Cycle ended                           | Congratulations screen                                                             |
| Waiting (pay delayed or future start) | Waiting screen                                                                     |

---

### 4. Spending Card + Log Card

**Spending card:**
- Header: "Spending" + total spent today.
- "+ Add spend" button opens a modal:
  - Note field (optional). Placeholder: "general spending".
  - Amount field. Hard block if ৳0 or below.
- Multiple entries per day allowed.

**Log card (appears below spending card when entries exist):**
- Internally scrollable list, max height ~280px. Does not cause page to scroll.
- Each row: note | amount | › chevron (tappable).
- Tapping a row opens the edit modal pre-filled with that row's data.
- Edit modal has Save + Delete options.

**Threshold warning (non-modal):**
After a spend is staged:
```
Projected daily budget = (remaining pool − spend amount) / days after today
```
If this drops below budget alert → inline warning on spending card. Non-blocking. Skipped on last day of cycle.

**Hard cap check:**
If spend amount > entire remaining pool → hard block. Error shown. Cannot proceed.

---

### 5. Staging vs. Committed

- All spend entries on the home screen are **staged** — written to the DB immediately but flagged `staged = 1`.
- Staged entries persist between app sessions.
- Staged entries can be edited or deleted freely from the log card.
- Everything is committed (`staged = 0`) at **review time**.

---

### 7. Log Tab

Three states:

#### State 1 — During the day (view-only)

- Total amount staged today at the top.
- Each spend entry: note | time | amount
- Extra cash entries shown separately.
- Entries cannot be edited or deleted here — only from the home screen spending card.
- Countdown timer showing time until review time.
- At review time → countdown replaced by "Start review" button.
- Push notification sent at review time (if notifications on): "Time to review your day, {name}."
- Follow-up notification sent 30 minutes later if review hasn't been completed.

#### State 2 — Review mode

Background turns yellow.

What the user sees:

- Total spent (calculated, not manually editable)
- Spend entries — each editable (amount and note only) and deletable
  - New spends can be added during review. Same validation applies (hard cap + threshold warning).
  - Deleting a spend during review reverses the amount back to the pool.
- Notes card — optional free-text field
- Confirm button

**On confirm:**

- All staged entries committed to database.
- Underspent amount (if any) added back to the budget pool.
- Budget pool recalculated. New daily budget = remaining pool ÷ days left.
- User taken to "Day Wrapped Up" screen.

#### State 3 — Day Wrapped Up

Heading: "Day wrapped up"

Shows:

- Daily budget
- Total spent
- Extra cash (hidden if zero)
- Saved (hidden if zero or negative)
- New daily budget for remaining days (hidden on last day of cycle)
- Notes field (editable until midnight. Shows "Add note" button if empty)
- Countdown to midnight

After midnight → log tab resets to State 1 for the new day.
Exception: if last night was the last day of the cycle → transition to end-of-cycle flow.

---

### 8. Missed Review

If the user does not complete review before midnight:

- Next time they open the app, a prompt appears: "You missed yesterday's review. How much did you spend?"
- Single amount input. Optional note.
- User fills in (or enters ৳0 if they don't remember) and confirms.
- Amount is committed, pool recalculates.
- App proceeds normally.

If multiple days are missed (e.g. user was away for 3 days), the prompt repeats once per missed day in chronological order before the home screen is accessible.

---

### 9. Stats Tab (History)

Simple. Two views toggled at the top: **Cycle View** | **Year View**

#### Cycle View

- Defaults to current active cycle.
- Left/right arrows to navigate between cycles.
- Shows cycle date range (e.g. Mar 09 – Apr 10).
- A simple list of reviewed days: date | total spent | saved or overspent amount.
- No calendar, no color dots for MVP.

#### Year View

- Defaults to current calendar year.
- Left/right arrows to navigate between years.
- Four stat cards:
  - Total spent
  - Daily average
  - Total saved (sum of all underspent amounts)
  - Total archived (from end-of-cycle leftover page)
- Monthly spending bar chart (Jan–Dec). Each spend attributed to the calendar day it occurred.

---

### 10. End of Cycle Flow

Triggered when the cycle end date is reached and the user opens the app.

#### Congratulations Screen

Home screen shows this. Heading: "That's a wrap."

- Simple cycle summary:
  - Total spent
  - Average spent per day
  - Total saved
- Two buttons:
  - **Start new cycle** → goes to Leftover page (if any leftover), then New Cycle Form
  - **Wait — pay was delayed** → goes to Waiting screen

---

#### Waiting Screen

Shown when pay is delayed or future start date is set.

- Message: "Unlike your friends that leave when you're broke, we're still here. Waiting patiently."
- One button: **Start new cycle** → New Cycle Form

---

#### Leftover Page

Shown before the New Cycle Form if the combined total of (budget pool remainder + savings + all reservations) is greater than ৳0. Skipped entirely if everything is zero.

- Shows one combined leftover amount: "You have ৳X left from this cycle. What do you want to do with it?"
- User splits it however they want across destinations:
  - **Save it** — goes to archived savings
  - **Reserve for something** — user names a reservation, goes into the new cycle's reservations
  - **Add to next cycle's pool** — carried into new cycle's budget pool
  - Can split across multiple destinations in any combination
- Any unallocated remainder is automatically archived.
- A live counter shows unallocated amount at the bottom: "৳X unallocated — will be archived."
- When fully allocated → "✓ All money allocated" in green.
- **Continue** button. If there is unallocated money, a confirmation prompt: "৳X will be added to your archived savings." Two options: Confirm or Go back.

---

#### New Cycle Form

Single page. All fields grouped into sections.

**The Basics:**

- Cycle start date
- Cycle end date
- Income
- Carried from last cycle (if pool amount was directed here from leftover page) — shown as a locked line below income
- Budget alert — pre-filled with previous cycle's value, editable

**Where Are You Now?** _(optional)_

- Already spent / Still have
- Start from today or tomorrow? (hidden if future start date)

**Protect Your Money** _(optional)_

- Savings — pre-filled if savings were carried over (locked). User can add additional savings separately.
- Reservations — pre-filled with carried reservations (locked). User can add new ones alongside.

After submitting:

- If start date is today → normal home screen
- If start date is in the future → waiting screen

---

### 11. More Tab

Settings only.

| Setting       | Details                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name          | Editable. Same rules as onboarding. Required, max 20 characters.                                                                                                          |
| Notifications | On/off toggle.                                                                                                                                                            |
| Review time   | 8pm, 9pm, 10pm, 11pm. Default 10pm. Only shown when notifications are on. If changed to a time already past today → "Start review" button appears on log tab immediately. |
| Theme         | Follow system (default), Light, Dark.                                                                                                                                     |

---

## Daily Budget Formula

**Start from today:**

```
Daily Budget = (income + pool leftover − already spent − savings − total reservations) / (days remaining + 1)
```

`days remaining` = days after today until cycle end. +1 includes today.

**Start from tomorrow:**

```
Daily Budget = (income + pool leftover − already spent − savings − total reservations) / days remaining
```

**After each confirmed review:**

```
New daily budget = remaining pool / days left in cycle
```

**Threshold warning check (during staging):**

```
Projected daily budget = (remaining pool − staged spend) / days after today
```

If projected < budget alert → show inline warning. Skipped on last day of cycle.

**Hard cap check (always):**

```
If spend amount > remaining pool → reject
```

---

## Data Model (simplified)

**cycles** — id, name, start_date, end_date, income, savings, budget_alert, pool_leftover, created_at

**reservations** — id, cycle_id, name, amount

**days** — id, cycle_id, date, daily_budget, total_spent, pool_after_review, reviewed_at

**entries** — id, day_id, type (spend | extra_cash), amount, note, time, staged (bool)

**archived_savings** — id, cycle_id, amount, created_at

**onboarding_state** — id (always 1), current_page (int), partial_data (JSON blob). Single row. Deleted when onboarding completes.

---

## Out of Scope for MVP

- Flags (green/blue/rough day classification)
- Modal 1 / Modal 2 (mid-cycle savings pulls)
- Per-card leftover allocation (combined total only)
- Export data
- Year view bar chart animations
- Multi-device sync
