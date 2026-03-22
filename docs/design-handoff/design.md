# Duit — App Design Notes

> Living doc. Updated as decisions are made. Not final — things will change.

---

## Global UI Patterns

- **Modals** — all modals are centered on screen. This includes quick-entry flows (add spend, add extra cash) as well as confirmations, warnings, and missed review. There are no bottom sheets in the app.

---

## About the Prototypes

The HTML prototypes in `design-handoff/` are visual references for layout, flow, and interaction logic — not final designs. Spacing, typography sizing, and exact colours will be refined during development. When implementing, treat the prototypes as a directional guide, not a pixel-perfect spec.

---

## What is Duit?

A personal budget app that answers one question: **how much can I spend today?**
Budget runs on pay cycles (pay date → next pay date), not calendar months.
Offline only. Single user.

---

## App Flow

### New user
Loading screen → Welcome screen (app name + "Get Started" button) → Onboarding → Home

### Returning user
Loading screen ("Welcome back, {name}") → Home

---

## Loading Screen

### New user
- Shows app name/logo
- Progress bar (meaningful — reflects actual init steps, e.g. loading fonts → database → ready)
- No spinner

### Returning user
- "Welcome back, {name}"
- Has a minimum display time (feels intentional, not a flash)
- Name comes from onboarding

---

## Onboarding

One-time process for new users only. Step-by-step, one page per step. If the user kills the app mid-onboarding and reopens it, they are returned to whichever page they were on — progress is persisted.

### Page 1 — Welcome
- App name/logo
- "Get Started" button → goes to Page 2

### Page 2 — The basics
- **Name** — required. Single text field, full name or just a first name, max 20 characters
- **Cycle start date** — when they got paid, opens calendar modal when tapped
- **Cycle end date** — when the next pay date is, opens calendar modal when tapped. Hard block if end date is on or before the start date — minimum cycle length is 2 days.
- **Income** — how much they got paid this cycle (in taka). Hard block if ৳0 or below — must be at least ৳1.
- **Budget alert** — the daily budget floor for notifications. When the daily budget drops to or below this, the app warns the user
  - Accepts ৳0 or any positive number. No negative values.
  - If set to ৳0: inline message shown — "৳0 means no warnings — the app won't flag low daily budgets or ask you to pull from savings." All threshold checks and modals (Modal 1 and Modal 2) are skipped for this cycle — but the hard cap check (Step 1) still applies as always. This setting is per-cycle.
  - As the user types a value above ৳0, app calculates a rough daily budget (income ÷ days in cycle) and compares
  - If the budget alert is higher than the estimated daily budget, an inline warning appears below the field: "Your budget alert is higher than your estimated daily budget of ৳X. You may want to lower it."
  - This is not a hard block — the user can still proceed

### Page 3 — Where are you now?
- **Already spent / Still have** — for users starting mid-cycle
  - Two input options:
    - "Already spent" → app calculates: `still have = income − already spent`
    - "Still have" → used directly in calculations
  - These are mutually exclusive — entering a value in one clears the other
  - What drives the math is how much they currently have
  - If both fields are left empty, the Next button is replaced by a **Skip** button. Tapping Skip treats it as ৳0 already spent — full income is available
  - **Validation:**
    - If the amount entered empties the pool entirely (already spent ≥ income, or still have = ৳0) → hard block. Inline error shown, Next button disabled until corrected.
    - If the amount drops the budget pool below the budget alert → inline warning shown (similar to the threshold warning on Page 2), but the user can still proceed.
- **Start from today or tomorrow?** — affects the days divisor in the formula. Belongs here because it's a cycle timing question. Defaults to "today" (most common case). Hidden if the cycle start date is in the future.

### Page 4 — Protect your money *(skippable)*
- **Savings** — fixed amount to set aside from this cycle's income, never touched by spending
- **Reservations** — money set aside for specific planned expenses (e.g. dates, a purchase), multiple allowed, each tagged with a name (required, max 30 characters)
- As the user adds savings/reservations, the daily budget recalculates live and updates visibly on screen
- **Skip:** if no savings or reservations are added, the Next button becomes a Skip button — same pattern as Page 3.
- **Validation** follows the spend validation framework (see Spend Validation Flow). Since savings and reservations are being set for the first time here, there is nothing to pull from — so modals don't apply. Instead: hard block if the pool would hit ৳0, inline warning if the daily budget drops below the budget alert (non-blocking, user can still proceed).

### Page 5 — Summary *(final step)*
- Shows everything in one place for review
- All fields editable inline, date fields open calendar modal when tapped
- Shows the final calculated daily budget
- Every edit on this page triggers the same real-time validation as the earlier pages: hard block if the pool would hit ৳0 (with an inline error and the Confirm button disabled until corrected), inline warning if the daily budget drops below the budget alert (non-blocking). Since all fields are editable on the same page, the user can resolve any blocked state by adjusting other fields inline without going back.
- If the user edits the cycle start date to a future date here, "Start from today or tomorrow?" resets and is hidden — same rule as the new cycle form. If they change it back to today, the field reappears defaulting to "today."
- On confirm → Home screen

---

## Daily Budget Formula

**If "Start from today" was chosen:**
```
Daily Budget = (income + pool leftover − already spent − savings − reservations) / (days remaining + 1)
```
`days remaining` = days after today until cycle end. The `+1` adds today back in, so today counts as a budgeted day.

**If "Start from tomorrow" was chosen:**
```
Daily Budget = (income + pool leftover − already spent − savings − reservations) / days remaining
```
Today is not counted — the budget only covers the days ahead.

`pool leftover` = any amount carried from the previous cycle's budget pool into this one. ৳0 on a brand new cycle.

**When start date is in the future:** The "Start from today or tomorrow?" question is hidden on the form. When the start date arrives and the cycle begins, the formula automatically uses "Start from today" — the first day is counted as a budgeted day.

**Threshold check during spending:**
When a spend is logged, the app calculates the new daily budget for remaining days:
```
New daily budget = (remaining pool − spend amount) / days after today
```
If this drops below the budget alert → Modal 1 or 2. This check is skipped entirely on the last day of the cycle (no remaining days, no threshold to protect). The hard cap check (Step 1) is never skipped — it applies on every day including the last.

- Savings is never subtracted by spending — it's always protected. Savings cannot be added to or changed mid-cycle; it can only be reduced via modal pulls (Modal 1 or 2). Once reduced, the pulled amount moves to the pool and the savings balance is permanently lower for the rest of the cycle.

---

## Open Questions / TBD
- ~~Exact wording/tone for notification messages~~ *(done — "Time to review your day, {name}.")*
- ~~The funny waiting page message~~ *(done — "Unlike your friends that leave when you're broke, we're still here. Waiting patiently.")*
- ~~Splitting card UI for leftover allocations on the end-of-cycle leftover page~~ *(done — see Leftover page section)*
- ~~More tab — not yet designed~~ *(done — see More Tab section)*

---

## Home Screen

### Layout (top to bottom)
1. **Hero area** — indigo background, shows date, day of cycle, and the big "Left today" number. "Left today" = today's daily budget minus total staged spends today. Pulls from savings/reservations do not affect this number — they adjust tomorrow's budget, not today's. Extra cash displayed separately in sky blue below the amount.
2. **Cycle Overview card**
3. **Spending card**
4. **Extra Cash card**
5. **Bottom nav** — Home, Log, Stats, More

---

### Spending Card

- Displays as a card with a dashed "+ Add spend" button like the other cards
- Tapping opens a bottom sheet with:
  - Amount field (keyboard auto-focuses, field is pre-selected). Hard block if ৳0 or below.
  - Optional note field — if left empty, placeholder shown (e.g. "general spending")
- After the app accepts the spend, the entry appears as a row inside the card:
  - Note/label | amount | X (delete button)
- Multiple entries can exist in the card for the same day

#### Deleting a spend entry
- Tapping X removes the entry
- The deleted amount is added back to today's budget
- If that spend had triggered a pull from savings or reservations (via Modal 1 or 2), those pulled amounts are also returned to their original sources

---

### UI Pattern — Amount selection with slider

Anywhere the user needs to select how much to pull or allocate from a source, the interaction follows this pattern (established in modal-prototype.html):
- A checkbox or toggle activates the source
- Once active, a slider appears giving a visual of how much is being taken
- A number input field sits alongside the slider and stays in sync — dragging updates the number, typing updates the slider
- The slider is capped at the source's full balance — it cannot go over

This pattern applies to Modal 1, the withdraw flow, and any future similar situations.

---

### Spend Validation Flow

This is the universal validation framework for any situation in the app where money is being committed — spends, mid-cycle reservations, savings and reservations during onboarding and the new cycle form. The same logic and thought process applies everywhere. Contextual differences (e.g. no modals during onboarding since there's nothing to pull from yet) are noted where relevant, but the underlying rules are the same.

Every time the user inputs an amount and taps save, the app runs through these checks in order:

**Step 1 — Hard cap check**
- If amount > budget pool + savings + all reservations combined → reject, do not proceed
- Show an error telling the user the amount exceeds everything they have
- Only option is to go back and change the number

**Step 2 — Threshold check**
- If amount passes Step 1, app calculates: does this spend make the avg daily budget drop below the budget alert?
- If no → save normally, done
- If yes and savings/reservations exist → route to Modal 1 or Modal 2 depending on the scenario
- If yes and there is nothing to pull from (no savings, no reservations) → show a consequences warning instead of a modal. The warning clearly states what happens next: e.g. "After this spend, you'll have ৳X left for Y remaining days — that's ৳Z/day." If the pool would hit zero: "After this spend, you'll have nothing left for the remaining Y days." Two options: Go back or Proceed anyway

---

### Modal 1 — Soft warning (threshold hit, fixable with partial pulls)

**Trigger:** After the spend, the daily budget drops below the budget alert — but pulling a combination of savings and/or reservations (less than everything) can bring it back above the threshold.

**Modal shows:**
- Warning header
- Current daily budget after spend (shown in red)
- Note that it's below the budget alert
- List of sources (Savings + each Reservation separately), each toggleable. Sources with a ৳0 balance are shown greyed out and cannot be toggled — they're visible for context, not interaction.
- When a source is toggled on: slider appears, defaults to full amount. Slider and number input stay in sync — dragging updates the number, typing updates the slider
- Live-updating "Pulling in" and "New daily budget" at the bottom
- New daily budget turns green with a checkmark when it exceeds the budget alert

**Confirm button:** enables when new daily budget exceeds the budget alert OR when user has selected the maximum available across all sources

**If the user selects everything (pulls max when it's not necessary):**
- App shows a confirmation prompt letting them know pulling everything is not required
- They can still continue if they want

**Options:**
- Confirm — saves the spend and updates savings/reservations accordingly
- Proceed anyway — saves the spend as-is, accepts the lower daily budget

---

### Modal 2 — Pull everything (only way to reach exactly the threshold)

**Trigger:** After the spend, the daily budget drops below the budget alert — and the only way to bring it back to the threshold is to pull everything available (all savings + all reservations). Partial pulls won't reach it.

**Modal shows:**
- Warning header
- Explanation: pulling everything (৳X) brings the daily budget to exactly the budget alert
- List of sources for context (same greyed-out treatment for ৳0 sources as Modal 1)
- One button: "Pull everything — ৳X"
  - Tapping turns the button green and confirms the selection
- Note showing what the new daily budget will be after pulling

**Confirm button:** only enables after tapping "Pull everything"

**Options:**
- Confirm — saves the spend and empties savings + all reservations
- Proceed anyway — saves the spend as-is, accepts the lower daily budget

---

### Cycle Overview Card

Displays three stats:
- Left in cycle — the total remaining budget pool, accounting for all staged entries (staged spends and staged reservations are subtracted from the committed pool balance so the number reflects the true remaining amount). Not the same as "Left today" in the hero — that's today's allocation only.
- Days left
- Daily average — average amount spent per day so far this cycle (total spent ÷ days reviewed). Based on committed entries only — today's staged entries are not included until review is confirmed. Shows "—" until at least one day has been reviewed.

---

### Extra Cash Card

- Each extra cash entry shown as a row: label | amount (sky blue) | X (delete)
- Label is optional — if left empty, placeholder shown (e.g. "extra cash")
- Amount hard blocked at ৳0 or below
- Dashed "+ Add extra cash" button at the bottom
- Extra cash is always visually distinct from regular budget (sky blue, never indigo)

---

### Staging vs. Committed

- All entries on the home screen (spends, extra cash) are **staged** — they are not immediately written to the database
- Staged entries are persisted between app sessions — if the app is closed or killed before review, staged entries survive and are still present when the user reopens the app
- Staged entries can be deleted freely, reversing all effects (amount, savings/reservation pulls)
- Everything gets committed to the database at review time (see Log tab — Review mode)

---

## Log Tab

The log tab has three states depending on the time of day.

---

### State 1 — During the day (view-only)

- Total amount spent today shown at the top — the sum of all staged spend entries for the current day
- Each spend entry shown as a row: note/label | time (e.g. 4:32pm)| amount
- Extra cash entries shown separately
- State 1 is view-only — entries cannot be deleted here. Deletion is done from the home screen spending card.
- Countdown timer showing how long until review time — this always shows regardless of whether notifications are enabled
- At review time, a push notification is sent to the user (if notifications are on): "Time to review your day, {name}. You can change this time in Settings." — tapping it opens the app directly on the log tab
- If the user has not started review 30 minutes after the first notification, a follow-up notification is sent. The follow-up is cancelled if review was completed in the meantime.
- At review time, the countdown timer is replaced by a "Start review" button

---

### State 2 — Review mode

Triggered when the user taps "Start review". The background turns yellow.

**Review time** is set in Settings. Current options: 8pm, 9pm, 10pm, 11pm. If the user changes their review time to a time that has already passed on the same day, the "Start review" button appears on the log tab immediately — review is available as soon as the changed time is saved.

**What the user sees:**
- Total spent (calculated by the app, not manually editable)
- Spend entries — each editable and deletable
  - Editable fields: amount and note only. Time is not editable on existing entries
  - When adding a new spend during review: defaults to current time, but the user can edit the time to reflect when it actually happened. Time can only be set to the past within the current review day — future times and times from previous days (already committed) are both blocked.
  - New spends added during review go through the same validation flow as normal spends (hard cap check + threshold check). The day is not closed until the user confirms, so the budget is still live
  - Deleting a spend during review follows the same reversal rules as deleting on the home screen — amount returns to the pool, and any savings/reservation pulls triggered by that spend are also reversed
- Extra cash entries — amount and note are both editable and deletable
- Notes card — optional free-text field for anything the user wants to remember
- Day flag — automatically calculated live as the user edits entries during review, cannot be changed by the user:
  - **Green** — daily budget minus total spent is positive (underspent)
  - **Blue** — daily budget minus total spent is exactly zero (on budget)
  - **Rough** — daily budget minus total spent is negative (overspent)
  - Extra cash does not factor into the flag calculation — the flag is based on daily budget vs. total spend only. A user can be flagged Rough while still having extra cash, and that extra cash will benefit tomorrow's budget after review, but today's flag reflects only the spend.
- Confirm button

**What happens on confirm:**
- All staged entries are committed to the database
- Underspent amount (if any) is added back to the budget pool
- Extra cash (if any) is added to the budget pool
- Budget pool is recalculated and the daily budget is updated for the remaining days
- User is taken to the Day Wrapped Up screen

---

### State 3 — Day wrapped up

Shown after the user confirms review. Heading: **"Day wrapped up"**

**Shows:**
- Daily budget
- Total spent
- Extra cash (hidden if zero)
- Saved (hidden if zero or less — only shown when the user underspent)
- Day flag
- New daily budget (recalculated daily budget for remaining cycle days) — hidden on the last day of the cycle
- Message — shown for rough flag only, chosen randomly from the list below
- Note — displayed if the user wrote one during review; otherwise an "Add note" button is shown as a gentle nudge. The note is editable from this screen — tapping it (or the "Add note" button) opens an editable text field until midnight.
- Countdown timer showing time until midnight

After midnight, the log tab resets to State 1 for the new day. Exception: if last night was the last day of the cycle, the app transitions to the end-of-cycle flow instead — home shows the congratulations screen, log shows the "cycle ended" blank screen.

**Rough flag messages (chosen randomly):**
- "His mercies are new every morning." — Lamentations 3:23
- "Though you stumble, you will not fall — the Lord upholds you." — Psalms 37:24
- "He restores my soul." — Psalms 23:3
- "Do not worry about tomorrow — today has enough of its own." — Matthew 6:34
- "I can do all things through Christ who strengthens me." — Philippians 4:13
- "Cast all your anxiety on Him, for He cares for you." — 1 Peter 5:7
- "For I know the plans I have for you — plans to prosper you." — Jeremiah 29:11
- "Be strong and courageous. Do not be afraid." — Joshua 1:9
- "The Lord is my shepherd; I shall not want." — Psalms 23:1
- "Come to me, all who are weary, and I will give you rest." — Matthew 11:28

---

### Missed review

If the user does not complete a review before midnight, a badge appears on the log tab showing "Missed yesterday's review" or "X days missed" if multiple days were skipped. The count includes all unreviewed days — they don't have to be consecutive. A red dot also appears on the Log icon in the nav pill across all screens (home, waiting, etc.) as a persistent nudge.

Tapping the badge opens a modal where the user can review missed days one by one, in chronological order (oldest first). A short note under the modal title explains this: e.g. "We're starting from the earliest day so your budget stays accurate." Each missed day follows the same review flow as State 2.

**What the modal shows per missed day:**
- If the day had staged entries (spends, extra cash) → those entries appear in the review. The user can edit or delete them before confirming.
- If the day had no staged entries → the review opens empty (৳0 spent). The user can add entries if they remember what they spent.

**Skipping a missed day:**
If the user genuinely can't remember what they spent, they can tap a skip button to mark the day as acknowledged without entering any data. Before skipping, the app shows a warning: "Skipping this day will discard any staged entries for it. This day won't count toward your stats." The user must confirm. Skipped days:
- Show as grey (untracked) on the calendar — they have no data, same visual treatment as out-of-cycle days
- Are excluded from all stats (same as unreviewed)
- Are no longer counted by the badge — they are considered resolved

**Hard block:**
The "Start new cycle" button on the congratulations screen is disabled until every missed day has been either reviewed or skipped. The user cannot start a new cycle with outstanding unresolved days. This ensures budget calculations stay accurate — reviewing a missed day adjusts the pool based on actual spend, and skipping discards staged entries cleanly.

---

## Stats Tab

Two views toggled at the top: Cycle View and Year View.

---

### Cycle View

Defaults to the current active cycle when opened. If there is no active cycle (end-of-cycle or waiting state), defaults to the most recently ended cycle.

**Navigation:** Left/right arrows to move between cycles. Shows the cycle date range (e.g. Mar 09 – Apr 10).

**Calendar:**
- Displays the full calendar month(s) covered by the cycle
- Each day that has been reviewed shows a colored dot:
  - **Green** — underspent (saved)
  - **Blue** — on budget (normal)
  - **Rough** — overspent
  - **Amber** — missed review
  - **Grey** — untracked (no data, e.g. before cycle start or future days)
- Green and Rough days show an amount on their dot:
  - Green: the amount saved that day (daily budget minus total spent)
  - Rough: the amount overspent that day (total spent minus daily budget)
  - If the amount is large, it is shortened (e.g. 1478 → 1.4k)
  - All other dot types show no amount label

**Tapping a day:**
- Tapping a green, blue, or rough day opens a modal showing that day's summary stats only:
  - Daily budget
  - Total spent
  - Saved or overspent amount
  - Day flag
- No itemised spend list is shown — summary only
- Tapping a grey (untracked/future) day does nothing
- Tapping an amber (missed) day opens a small modal saying the day was missed and directing the user to the log tab to review it

---

**Reservations card (below the calendar):**

Displays all reservations for whichever cycle is currently being viewed. If none exist, shows "No reservations for this cycle."

The user can add a mid-cycle reservation here, but only when viewing the current active cycle. When viewing a past cycle the add option is hidden — the card is read-only. The add option is also locked while review is in progress — a small message is shown: "Complete today's review first." Mid-cycle reservations follow the same staging model as spends: when added, the reservation is staged (not immediately committed to the database), but its effect on the daily budget is reflected immediately as a live preview. Staged reservations survive app kills. They are committed to the database when the next review is confirmed. During review, a staged mid-cycle reservation appears as an entry the user can edit or delete, following the same reversal rules as spend entries.

**Mid-cycle reservation validation** follows the same logic as spend validation:

- **Hard cap check:** If the reservation amount exceeds the budget pool plus savings plus all other reservations combined → reject. The user cannot reserve money that does not exist.
- **Threshold check:** If adding the reservation drops the daily budget below the budget alert → run the same modal flow as spend validation (Modal 1 or Modal 2 depending on whether partial pulls can fix it). The user can pull from savings or other reservations to bring the daily budget back above the threshold, or proceed anyway and accept the lower daily budget.

---

### Year View

Defaults to the current calendar year when opened.

**Navigation:** Left/right arrows to move between years.

**Four stat cards:**
- Total spent
- Daily average
- Total underspent — sum of all daily underspent amounts (green days) across the year
- Total archived — cumulative amount archived across all cycles in the year (see Archived savings card below)

**Monthly spending bar chart:** Shows spending per calendar month across the year (Jan–Dec). Each spend is attributed to the calendar day it occurred — no cycle-based grouping. Bars are indigo. Empty months show no bar.

---

**Archived savings (below the bar chart):**

Shows the user's total accumulated archived savings — money that was unallocated at cycle end and archived over time. Symmetrical to the reservations card in Cycle View.

- Displays the total archived balance
- Lists individual contributions by cycle (e.g. "Mar 09 – Apr 10 — ৳500")
- If no archived savings exist yet, shows ৳0 with a small message (e.g. "Nothing archived yet")
- A **Withdraw** button lets the user move money out of the archive into the current active cycle. Hidden if there is no active cycle (cycle ended, waiting state), if the balance is ৳0, or if review is currently in progress.

**Withdraw flow:**
The user selects an amount using the slider + inline input pattern (see UI Pattern — Amount selection with slider). Hard block if the typed amount exceeds the archived balance. If the user selects the full balance, a confirmation warning is shown: "This will empty your archived savings." — the user must confirm before proceeding.

The user then chooses one of three destinations:
1. **Add to pool** — the amount joins the current cycle's budget pool. Daily budget recalculates.
2. **Add to reservation** — the amount is added to the pool first, then the reservation is created or topped up from the pool. Spend validation runs against the updated pool (with the withdrawn amount already included). The user picks an existing reservation to top up, or creates a new named reservation.
3. **Log as expense** — the amount is added to the pool and immediately spent. Net effect on the pool is zero. The spend appears in the log tab like any other spend entry and goes through the same validation flow. The user does not see the intermediate pool step.

**Timing edge cases for "Log as expense":**
- **During the day** — appears as a staged spend entry on the home screen and log tab as normal.
- **During review** — slots into the active review session as a new spend entry, same rules as adding a spend during review.
- **Post-review waiting period (review done, before midnight, not the last day)** — today is closed. The entry is queued for tomorrow. The user is informed: the entry will appear in tomorrow's staged entries. The entry carries both the date and time it was logged (e.g. "Mar 20, 11:42pm") so the context is clear during tomorrow's review. The user can edit date and time during review as with any spend entry.
- **Post-review waiting period on the last day of the cycle** — today is closed and tomorrow begins a new cycle that doesn't exist yet. The withdrawn amount is added to the budget pool (as always), but the spend does not fire. The app shows a note: "Your day is closed — this will go into your pool and appear on your leftover page." The increased pool balance is then visible on the leftover page when the cycle ends at midnight.

---

## More Tab

The More tab contains app settings. Each setting is a row in a grouped list.

---

### Settings

**Profile**
- **Name** — editable. Used on the loading screen ("Welcome back, {name}"). Set during onboarding, changeable here. Same validation as onboarding: required, max 20 characters, cannot be cleared.

**Notifications**
- **Notifications** — on/off toggle. Controls whether the app sends the daily review reminder push notification.
- **Review time** — time the review reminder is sent. Options: 8pm, 9pm, 10pm, 11pm. Defaults to 10pm. Only shown/active when notifications are on.

**Preferences**
- **Theme** — Follow system (default), light, or dark.

**Future (not in v1)**
- Export data

---

## End of Cycle Flow

---

### Congratulations screen

When the cycle ends, the user opens the app and lands on the home page which shows the congratulations screen. Heading: **"That's a wrap."**

- Confetti animation plays once — only on the first time the user lands on this screen after the cycle ends. Does not replay on subsequent visits.
- Cycle summary stats:
  - Average spent per day
  - Good days (green + blue flags)
  - Rough days
  - Average amount overspent on rough days
  - Average amount saved on good days
  - Total extra cash received
  - Days missed
- Stats are calculated from reviewed days only. If the user has missed days, those days are excluded from the stats. When the user reviews a missed day (via the log tab badge), the stats update automatically to include it.
- Stats with no data show "—" (e.g. if there were no rough days, "Avg overspent on rough days" shows "—"; if there were no good days, "Avg saved on good days" shows "—").
- If there are missed days: a notice is shown on the congratulations screen indicating that X day(s) haven't been reviewed yet, and that the stats will update once they are. The log tab shows the "cycle ended" blank screen with the missed review badge as normal.
- Two buttons:
  - **Start new cycle** — starts the new cycle setup flow. Disabled if there are any unresolved missed days — the user must review or skip all of them first.
  - **Wait — pay was delayed** — goes to the waiting screen. Also disabled if there are unresolved missed days.

---

### Waiting screen

Shown when the user taps "Wait — pay was delayed," or when the user sets a cycle start date that is in the future on the new cycle form.

- Displays a humorous waiting message: "Unlike your friends that leave when you're broke, we're still here. Waiting patiently."
- One button: **Start new cycle** → takes the user to the new cycle form

---

### Log tab during cycle end / waiting state

While the cycle has ended and a new cycle has not yet begun (including during the waiting state when pay is delayed), the log tab shows a blank screen with:
- Message: **"This cycle has ended. Head to Stats to see how it went."**
- A "Go to Stats" button

The Stats tab works normally in both states — the ended cycle's data is available and viewable.

---

### Leftover page

Shown before the new cycle form if any of the following have a balance greater than zero at cycle end: budget pool remainder, savings, or any reservation. If all are zero, this page is skipped entirely.

All three cards are always shown — Pool, Savings, and Reservations. If a card has a zero balance and has not received money from another card, it shows ৳0 with a small message (e.g. "Nothing left over from this cycle") and cannot be expanded. If a zero-balance card receives money from another card, it becomes expandable and the user can allocate that received amount. This avoids the page looking broken or incomplete. The page itself is still only shown if at least one card has a balance greater than zero.

All cards with a balance are collapsed by default. Tapping a card expands it to show allocation options.

**Sources (three cards):**
- **Pool** — the remaining pool balance
- **Savings** — the remaining savings balance
- **Reservations** — one collective card representing all unused reservations combined. When expanded, individual reservation pills are shown at the top (e.g. `Dates ৳200`, `Gym ৳150`). Tapping a pill pre-selects that reservation's amount and lets the user choose a destination for it — each named reservation can be allocated independently, and carry-over is only available this way (via a named pill). An "Add destination" button is also available for custom splits not tied to a specific pill, but "Carry over" is not offered as a destination through this button — only pool, savings, and new reservation are available. This ensures carry-overs always retain a name.

---

#### Allocation model — "cards give to cards"

Each card can send money to any other card, or carry itself forward into the new cycle. A card's allocation options (shown as pills in a dropdown):

1. **Carry over** — moves the amount into that card's equivalent in the new cycle (pool → new pool, savings → new savings, reservations → the allocated amount goes into the new cycle's reservations pool)
2. **→ [Card name]** — sends to another card on this page. The receiving card's total increases and it can then allocate that money further
3. **New reservation** (Reservations card only) — creates a new named reservation for the new cycle

**Unallocated remainder:** Any amount not explicitly allocated is **archived** — added to the user's accumulated archived savings balance. A yellow notice at the bottom of the page shows the live total currently unallocated (e.g. "৳350 unallocated — will be archived"). When everything is explicitly allocated it turns green: "✓ All money allocated".

**Continue confirmation:** If the user taps Continue with any unallocated amount, a confirmation sheet appears: "৳X will be added to your archived savings. You can withdraw it anytime from the Year View." Two options: Confirm or Go back.

**Receiving:** If a card has received money from another card, this is shown inside the expanded card as a "Received from X — ৳Y" line. The card's effective total (own amount + received) is what the user allocates.

**Splitting:** A card's total can be split across multiple destinations. Each allocation is a separate row inside the card with its own amount and destination.

**Circular sends:** If Card A sends to Card B and Card B sends back to Card A, the app allows it. No prevention logic.

**Reset:** A Reset button (shown to the left of Continue) clears all allocations — including any received amounts between cards — and collapses all cards back to their initial state (original balances, no sends or receives). Tapping it opens a confirmation bottom sheet showing each card's original amount. The user can confirm (red button) or cancel.

---

### New cycle form

A single page with all fields, grouped into sections mirroring the onboarding structure. Shown after the leftover page (or directly after the congratulations screen if there were no leftovers). Name is not shown — it was set during onboarding and is only changeable in Settings.

Fields are grouped into cards, one per section:

**The basics**
- Cycle start date
- Cycle end date
- Income
- Carried from last cycle (if any pool amount was directed to the new pool on the leftover page) — shown as a separate line below income, not editable (locked, derived from the leftover page)
- Budget alert — pre-filled with the previous cycle's value, editable. Same validation as onboarding: accepts ৳0 or any positive number, no negatives, cannot be left empty.

**Where are you now?**
- Already spent / Still have — optional. If left empty, treated as ৳0 already spent
- Start from today or tomorrow? — hidden if the cycle start date is set to a future date. All days from the future start date are budgeted by default.

**Protect your money**
- Savings — pre-filled if savings leftover was carried over, locked (not editable or deletable). User can add an additional savings amount via a button; both are shown separately on the form but merge into one total on submission
- Reservations — pre-filled with any carried-over reservations, locked (not editable or deletable). User can add new reservations alongside them

All fields are required except Already spent / Still have, Savings, and Reservations — those three are optional. If no savings or reservations are added, they are treated as ৳0.

**After submitting the form:**
- If cycle start date is today → home screen shows the normal ongoing cycle view
- If cycle start date is in the future → home screen shows the waiting screen

---

### Home screen states

The home screen shows different content depending on the current state:

1. **Normal** — ongoing cycle, current day. Standard home screen layout.
2. **Review in progress** — the entire home screen is replaced by a single blocking message: "Finish your review to continue." Nothing is interactive — no cards, no spending, no extra cash. The user must complete review in the log tab before the home screen returns to normal.
3. **Post-review, pre-midnight** — review is done but the next day has not started yet. The entire home screen shows: **"You're done for today. See you tomorrow."** Nothing is interactive — no cards, no spending, no extra cash. Everything resets at midnight.
4. **Cycle ended** — shows the congratulations screen.
5. **Waiting for new cycle** — shows the waiting screen (pay delayed or future start date).

---

### Open Questions / TBD (end of cycle)

*(none — splitting card UI is resolved, see Leftover page section above)*
