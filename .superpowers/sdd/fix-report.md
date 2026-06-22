# Fix Report: use-savings feature

## Status: DONE

## Fixes Applied

### Fix 1: Eliminate double-fetch of savings data
- **`services/cycleService.ts`**: Removed the `withdrawalRow` query and `savingsWithdrawn` field from `ActiveCycleData` interface and the `getActiveCycle` return object.
- **`app/(tabs)/index.tsx`**: Derived `savingsWithdrawn` locally via `data.savingsWithdrawals.reduce(...)`, updated `savingsRemaining` to use it, updated `NormalState` prop from `cycleData.savingsWithdrawn` to `savingsWithdrawn`, and fixed the "ended" cycle summary section that also referenced `cycleData.savingsWithdrawn`.

### Fix 2: Gray out fully-used savings pill
- **`components/home/NormalState.tsx`**: Added `opacity: fullyUsed ? 0.6 : 1` to the savings pill `Pressable` style.

## Verification
- `npx tsc --noEmit`: clean (no output)
- `npx expo lint`: clean (no output)
