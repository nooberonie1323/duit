# Carryover & Savings Balance — Build Plan

Status: plan approved, Phases 1–4 complete.

## Progress

Last updated: 2026-11-06

| Phase | Status |
| --- | --- |
| 1 — Foundation | Done |
| 2 — Close cycle & leftovers | Done |
| 3 — New cycle plan & apply | Done |
| 4 — Screens, hardening, rollout | Done |

### Phase 1 — done

- Added `model_version` to `cycles` (default 1) so existing cycles keep the old maths.
- Added `savings_account` (one running balance) and `savings_ledger` (signed history).
- Existing users' balance is seeded once from the latest cycle's remaining savings.
- Added `cycle_plans`, `cycle_plan_reservations`, and `carryover_choices` for the pending plan.
- Added `cycle_closings` and `cycle_close_spends` for close summaries and "already spent" money.
- Reset now clears the new tables and reseeds an empty savings account.
- No screen or service reads the new model yet, so app behaviour is unchanged.
- `npx tsc --noEmit` and `expo lint` pass.

### Phase 2 — done

- Added a Close cycle screen that opens from the ended state and the pay-delayed state.
- Unreviewed days must be settled with the existing catch-up review before leftovers show.
- Leftovers show the pocket pool, each reservation's remaining amount, and remaining savings.
- Every item gets four choices: pool, savings, reservation, or "I already spent it."
- Savings defaults to staying in savings; reservations default to carrying forward by name.
- Duplicate reservation names prompt merge or rename.
- Choices save as a draft plan only. No money moves; the old cycle stays unchanged.
- Reopening the screen restores the saved choices.
- `npx tsc --noEmit` and `expo lint` pass.

### Phase 3 — done

- The new-cycle form now builds on the saved close plan instead of the old leftover step.
- Carried pool, savings, and reservations are shown and included in the maths.
- Live preview: available cash, savings total, reservations total, already spent, new pool, daily budget.
- Blocks already spent above income, and blocks savings/reservations above available cash.
- Warns (but allows) when the daily budget falls below the budget alert.
- Duplicate reservation names prompt merge or rename, including against carried reservations.
- Future start dates save the plan and put home in a "planned" state; the app asks for confirmation on or after the start date.
- A late confirmation starts the cycle on the confirmation day; the end date stays editable.
- Applying creates the cycle, reservations, savings balance, close record, and old-cycle settlements in one transaction.
- Home reloads on focus, so it reflects the close/plan screens immediately.
- `npx tsc --noEmit` and `expo lint` pass.

### Phase 4 — done

- The savings pill, savings modal, and cycle-end screen now show the one running balance.
- Withdrawals are limited to the full savings balance and update the balance plus the ledger together.
- The savings modal shows the signed ledger history instead of only this cycle's withdrawals.
- Onboarding savings become the opening balance for the new account.
- Loan money sent to savings adds to both the running balance and this cycle's protected savings.
- Auto loan-repayment reservations are no longer offered as leftovers. Their unused amount returns to the pool, and they are released from the old cycle when the new one starts, so they are not carried twice.
- The dev seed re-syncs the running balance from the latest seeded cycle.
- Existing (model version 1) cycles keep their account in step with savings minus withdrawals until they end.
- Edge cases checked: zero leftovers, no reviewed days, fully spent reservations, duplicate names, tiny rounding remainders, and a start date already in the past.
- `npx tsc --noEmit` and `expo lint` pass.

### Rollout

1. Send the Phase 2–4 update because Phase 1 is already installed.
2. Run the phone checklist below.
3. If anything is wrong, roll back with `npx eas update:republish` to the previous update. Schema changes are additive, so rollback is safe.
4. The active (model version 1) cycle keeps the old maths until it ends; the new flow starts with the next cycle.

### Next

Manual phone testing, then send the EAS update when the owner is ready. No further build phases.

## 1. Purpose

Fix how money left over at the end of a cycle is handled, and turn savings into a
running balance that survives across cycles.

The core rule:

> Money carried over from the old cycle already belongs to the user. It is added
> to the new cycle. It is never subtracted from the new income.

## 2. Decisions locked

- Pool, reservations, and savings each carry over separately.
- The user is asked about every leftover item.
- Savings defaults to staying in savings.
- Reservations are always asked about; there is no default.
- Destinations per item: spending pool, savings, reservation, or "I already spent it."
- "I already spent it" records the money as spent rather than silently dropping it.
- Savings is a safe, separate from pocket money.
- Using savings is recorded as spent from savings and does not touch the spending pool.
- Duplicate reservation names prompt a merge or rename.
- A close-cycle step settles unreviewed days before leftovers are shown.
- Carryover is confirmed on or after the planned cycle start date.
- If the user is late, the cycle starts on the confirmation date.
- The end date stays as originally chosen but can be edited at confirmation.
  If the end date has already passed, the user must choose a new one.
- Carryover choices lock after confirmation. No mid-cycle editing.
- Savings starts from the latest cycle's remaining savings for existing users.
- Both loan handling and mid-cycle savings deposits are out of scope for now.

## 3. Target money model

A cycle's spendable pocket pool is:

```
income
+ money carried into the pool
− savings balance
− all reservations
− already spent
```

Carried savings and carried reservations are included in "available cash" and then
subtracted again as savings or reservations, so they cancel out. This prevents them
from being taken out of the new income a second time.

The savings balance is one persistent number:

- New contribution from income increases it.
- Using savings decreases it.
- Moving savings to the pool decreases it.
- Marking savings as already spent decreases it.
- Keeping it at cycle end leaves it unchanged.

## 4. Target user flow

1. Old cycle ends. Home shows **Close cycle**.
2. Close cycle forces catch-up reviews, then shows the final numbers.
3. Leftovers screen lists pool, each reservation, and the savings balance.
4. User chooses a destination for each item.
5. New cycle form: dates, income, new savings contribution, new reservations, alert.
6. Form shows a live pool and daily budget preview with validation.
7. If the start date is today, everything is applied immediately.
8. If the start date is future, the plan is saved and home shows "waiting".
9. On or after the start date, the app asks for final confirmation before the
   daily loop starts.
10. After confirmation, carryover is applied once and locked.

## 5. Build phases

### Phase 1 — Foundation, no visible change

Goal: prepare the database without touching current behaviour.

- Add a version marker so existing cycles keep the old maths.
- Add storage for the savings running balance and its history.
- Add storage for a pending cycle plan and each leftover choice.
- Add storage for money marked as already spent at close.
- Update reset so the new storage is cleared.
- Use additive migrations only. No renames or drops.

Checkpoint: the app opens exactly as before. Current cycle, savings, reservations,
reviews, and log all behave the same.

### Phase 2 — Close cycle and leftovers

Goal: settle the old cycle and collect choices without moving money yet.

- Add a Close cycle step when the old cycle ends.
- Force catch-up reviews before showing final numbers.
- Calculate pool leftover, each reservation's remaining amount, and the savings balance.
- Build the leftovers screen with one card per item.
- Add the four destinations: pool, savings, reservation, already spent.
- Default savings to staying in savings.
- Prompt merge or rename when a carried reservation matches an existing name.
- Save the choices as a plan only.

Checkpoint: the screen can be opened, changed, and backed out of. Old cycle numbers
do not change until confirmation.

### Phase 3 — New cycle plan and apply

Goal: turn choices into the actual next cycle.

- Rework the setup form: carried values, income, dates, new savings contribution,
  new reservations, budget alert.
- Show a live preview of the pool and daily budget.
- Block savings plus reservations from exceeding available cash.
- Block already spent from exceeding income.
- Warn when the projected daily budget falls below the budget alert.
- Handle late starts: confirm on or after the start date, set start date to that day,
  keep the end date editable, and require a new one if it has passed.
- Apply everything in a single all-or-nothing save.
- Add the pending-setup home state so the daily loop cannot start before confirmation.

Checkpoint: every destination type works, the maths checks out by hand, and retrying
does not apply anything twice.

### Phase 4 — Remaining screens, hardening, rollout

Goal: make the rest of the app agree with the new model.

- Savings pill, savings modal, and end screen show the running balance.
- Withdrawal limit becomes the full savings balance.
- Onboarding savings becomes the starting balance.
- Loan money sent to savings lands in the new balance. No loan behaviour changes.
- Auto loan-repayment reservations are excluded from carryover.
- Update reset and the dev seed.
- Cover edge cases: zero leftovers, no reviewed days, fully spent reservations,
  duplicate names, rounding, and a start date already in the past.
- Run typecheck and lint.
- Write and run the phone test checklist.
- Send the EAS update with a rollback plan.

## 6. Edge cases and rules

- Overspending through the spend flow is already blocked by the pocket-pool cap.
  Setup validation closes the remaining gap.
- Rounding: carry exact amounts; round only for display. Treat tiny remainders as zero.
- If there are no leftovers, skip the leftovers screen.
- If a reservation is fully spent, it does not appear in the leftovers list.
- If a carried reservation is already used in the new cycle, it is locked.
- If the app crashes during confirmation, the single transaction rolls back.
- If the update misbehaves, rolling back the update is safe because schema changes
  are additive.

## 7. Rollout recommendation

Because there is no local test environment, ship in two updates:

1. **Phase 1 alone.** Open the app on the phone and confirm it behaves identically.
2. **Phases 2–4.** Then test the new flow as the next cycle ends.

## 8. Phone test checklist

After the Phase 1 update:

1. Current cycle opens with the same daily budget.
2. Add, edit, and delete a spend.
3. Complete a review.
4. Spend from a reservation, then undo it.
5. Open savings and confirm the balance and history.
6. Open the Log tab.

After the Phase 2–4 update:

1. Open savings: the pill, modal, and end screen show the same running balance.
2. Use part of savings, then check the balance drops by exactly that amount and the history shows it.
3. Try to use more than the balance; it should be blocked.
4. Let or force a cycle to end and run Close cycle.
5. Confirm unreviewed days are settled first.
6. Try each leftover destination.
7. Check the new cycle's pool and daily budget against a calculator.
8. Set a future start date, then reopen before and after it to confirm the prompt.
9. Confirm rejecting or backing out applies nothing.
10. If a borrowed loan has an auto reservation, confirm it does not appear as a leftover and that the unused amount is back in the pool.
11. If a lent loan is returned to savings, confirm the running balance increases.

## 9. Out of scope

- Loan flow changes.
- Mid-cycle savings deposits.
- Stats screen work.
- Editing old cycles after confirmation.
