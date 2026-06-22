# Use Savings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to record partial withdrawals from their cycle savings via a two-step modal accessible from the savings pill on the home screen.

**Architecture:** New `savings_withdrawals` table stores each withdrawal; `cycles.savings` stays immutable (original intent). `savingsWithdrawn` is computed and added to `ActiveCycleData` so the whole app sees it. A two-step `SavingsModal` component mirrors the `ReservationModal` pattern but adds an amber confirmation screen to signal that touching savings is a significant decision.

**Tech Stack:** React Native, Expo, expo-sqlite (SQLite), TypeScript, PlusJakartaSans fonts, theme-aware colors via `useThemeColors()`

## Global Constraints

- Font family always one of: `PlusJakartaSans_400Regular`, `PlusJakartaSans_500Medium`, `PlusJakartaSans_600SemiBold`, `PlusJakartaSans_700Bold`, `PlusJakartaSans_800ExtraBold`
- Colors only from `useThemeColors()` — never hardcode hex except for known design tokens: `rgba(0,0,0,0.45)` overlay, `#FFFBEB` amber bg, `#FDE68A` amber border, `#92400E` amber text (these are intentional non-theme values for the warning step)
- Currency symbol is `৳`, amounts floored with `.toLocaleString()` for display
- All DB operations wrap multi-step mutations in `BEGIN` / `COMMIT` / `ROLLBACK`
- `cycles.savings` column is never mutated after cycle creation
- `note` field: trim, store `null` when empty (not empty string)
- Branch: `feat/use-savings`

---

### Task 1: DB migration + savingsService

**Files:**
- Modify: `lib/db.ts`
- Create: `services/savingsService.ts`

**Interfaces produced (consumed by Tasks 2, 3, 5):**
```ts
// services/savingsService.ts
export interface SavingsWithdrawalRow {
  id: number;
  cycle_id: number;
  amount: number;
  note: string | null;
  created_at: string;
}
export async function getSavingsWithdrawals(db, cycleId): Promise<SavingsWithdrawalRow[]>
export async function addSavingsWithdrawal(db, cycleId, amount, note): Promise<void>
```

- [ ] **Step 1: Add `savings_withdrawals` table to `lib/db.ts`**

Inside `migrateDb`, add the new table to the `execAsync` block right after `archived_savings`:

```ts
    CREATE TABLE IF NOT EXISTS savings_withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
```

- [ ] **Step 2: Create `services/savingsService.ts`**

```ts
import type { SQLiteDatabase } from 'expo-sqlite';

export interface SavingsWithdrawalRow {
  id: number;
  cycle_id: number;
  amount: number;
  note: string | null;
  created_at: string;
}

export async function getSavingsWithdrawals(
  db: SQLiteDatabase,
  cycleId: number
): Promise<SavingsWithdrawalRow[]> {
  return db.getAllAsync<SavingsWithdrawalRow>(
    'SELECT * FROM savings_withdrawals WHERE cycle_id = ? ORDER BY id DESC',
    [cycleId]
  );
}

export async function addSavingsWithdrawal(
  db: SQLiteDatabase,
  cycleId: number,
  amount: number,
  note: string
): Promise<void> {
  await db.runAsync(
    'INSERT INTO savings_withdrawals (cycle_id, amount, note) VALUES (?, ?, ?)',
    [cycleId, amount, note.trim() || null]
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts services/savingsService.ts
git commit -m "feat: add savings_withdrawals table and savingsService"
```

---

### Task 2: Extend ActiveCycleData with savingsWithdrawn

**Files:**
- Modify: `services/cycleService.ts`

**Interfaces produced (consumed by Tasks 3, 4, 5):**
```ts
// ActiveCycleData gains:
savingsWithdrawn: number;
// savingsRemaining = cycle.savings - savingsWithdrawn (computed at call site)
```

- [ ] **Step 1: Add `savingsWithdrawn` to the `ActiveCycleData` interface**

In `cycleService.ts`, add to `ActiveCycleData`:

```ts
export interface ActiveCycleData {
  cycle: CycleRow;
  reservations: ReservationRow[];
  pool: number;
  reservationsTotal: number;
  dailyBudget: number;
  daysLeft: number;
  dayOfCycle: number;
  totalDays: number;
  leftInCycle: number;
  activeDays: number;
  savingsWithdrawn: number;  // ← add this
}
```

- [ ] **Step 2: Query and populate `savingsWithdrawn` in `getActiveCycle`**

After the `activeDaysRow` query (around line 138), add:

```ts
  const withdrawalRow = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM savings_withdrawals WHERE cycle_id = ?',
    [cycle.id]
  );
  const savingsWithdrawn = withdrawalRow?.total ?? 0;
```

Then add `savingsWithdrawn` to the return object:

```ts
  return {
    cycle,
    reservations,
    pool,
    reservationsTotal,
    dailyBudget,
    daysLeft: daysAfterToday + 1,
    dayOfCycle: Math.max(1, dayOfCycle),
    totalDays: totalDays + 1,
    leftInCycle,
    activeDays,
    savingsWithdrawn,
  };
```

- [ ] **Step 3: Commit**

```bash
git add services/cycleService.ts
git commit -m "feat: add savingsWithdrawn to ActiveCycleData"
```

---

### Task 3: SavingsModal component

**Files:**
- Create: `components/home/SavingsModal.tsx`

**Interfaces consumed:** `SavingsWithdrawalRow` from `services/savingsService`  
**Interfaces produced (consumed by Task 5):**
```ts
interface Props {
  visible: boolean;
  onClose: () => void;
  originalSavings: number;
  savingsRemaining: number;
  withdrawals: SavingsWithdrawalRow[];
  step: 1 | 2;
  amount: string;
  note: string;
  onChangeAmount: (v: string) => void;
  onChangeNote: (v: string) => void;
  amountError: string | null;
  canContinue: boolean;
  saving: boolean;
  onContinue: () => void;
  onBack: () => void;
  onConfirm: () => void;
}
```

- [ ] **Step 1: Create `components/home/SavingsModal.tsx`**

```tsx
import { useThemeColors } from '@/contexts/theme';
import type { SavingsWithdrawalRow } from '@/services/savingsService';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

const NOTE_MAX_LENGTH = 60;

interface Props {
  visible: boolean;
  onClose: () => void;
  originalSavings: number;
  savingsRemaining: number;
  withdrawals: SavingsWithdrawalRow[];
  step: 1 | 2;
  amount: string;
  note: string;
  onChangeAmount: (v: string) => void;
  onChangeNote: (v: string) => void;
  amountError: string | null;
  canContinue: boolean;
  saving: boolean;
  onContinue: () => void;
  onBack: () => void;
  onConfirm: () => void;
}

function WithdrawalHistory({ withdrawals }: { withdrawals: SavingsWithdrawalRow[] }) {
  const colors = useThemeColors();
  if (withdrawals.length === 0) return null;
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
        History
      </Text>
      {withdrawals.map((w, i) => {
        const dateStr = new Date(w.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return (
          <View
            key={w.id}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textPrimary }}>
                Used · {dateStr}
              </Text>
              {w.note ? (
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 1 }}>
                  {w.note}
                </Text>
              ) : null}
            </View>
            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.warning }}>
              −৳{Math.floor(w.amount).toLocaleString()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function SavingsModal({
  visible, onClose,
  originalSavings, savingsRemaining, withdrawals,
  step, amount, note,
  onChangeAmount, onChangeNote,
  amountError, canContinue, saving,
  onContinue, onBack, onConfirm,
}: Props) {
  const colors = useThemeColors();
  const amountNum = parseFloat(amount) || 0;
  const fullyUsed = savingsRemaining <= 0;

  const headerSubtitle = fullyUsed
    ? 'Fully used this cycle'
    : `৳${Math.floor(savingsRemaining).toLocaleString()} of ৳${Math.floor(originalSavings).toLocaleString()} remaining`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxHeight: '85%' }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textPrimary }}>
                  {fullyUsed ? 'Savings' : step === 1 ? 'Use Savings' : 'Are you sure?'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
                  {headerSubtitle}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={{ fontSize: 22, color: colors.textSecondary, lineHeight: 24, includeFontPadding: false }}>×</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {fullyUsed ? (
                <FullyUsedView withdrawals={withdrawals} />
              ) : step === 1 ? (
                <Step1View
                  savingsRemaining={savingsRemaining}
                  amount={amount}
                  note={note}
                  amountNum={amountNum}
                  amountError={amountError}
                  canContinue={canContinue}
                  withdrawals={withdrawals}
                  onChangeAmount={onChangeAmount}
                  onChangeNote={onChangeNote}
                  onContinue={onContinue}
                />
              ) : (
                <Step2View
                  amountNum={amountNum}
                  savingsRemaining={savingsRemaining}
                  originalSavings={originalSavings}
                  saving={saving}
                  onConfirm={onConfirm}
                  onBack={onBack}
                />
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FullyUsedView({ withdrawals }: { withdrawals: SavingsWithdrawalRow[] }) {
  const colors = useThemeColors();
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ backgroundColor: colors.primaryLight, borderRadius: 12, padding: 14, marginBottom: 4 }}>
        <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
          ✓ Fully used this cycle
        </Text>
      </View>
      <WithdrawalHistory withdrawals={withdrawals} />
    </View>
  );
}

interface Step1ViewProps {
  savingsRemaining: number;
  amount: string;
  note: string;
  amountNum: number;
  amountError: string | null;
  canContinue: boolean;
  withdrawals: SavingsWithdrawalRow[];
  onChangeAmount: (v: string) => void;
  onChangeNote: (v: string) => void;
  onContinue: () => void;
}

function Step1View({
  savingsRemaining, amount, note, amountNum, amountError,
  canContinue, withdrawals, onChangeAmount, onChangeNote, onContinue,
}: Step1ViewProps) {
  const colors = useThemeColors();
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
        Note (optional)
      </Text>
      <View style={{ backgroundColor: colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 }}>
        <TextInput
          value={note}
          onChangeText={onChangeNote}
          placeholder="What did you use it for?"
          placeholderTextColor={colors.textSecondary}
          style={{ fontSize: 15, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_400Regular' }}
          maxLength={NOTE_MAX_LENGTH}
          returnKeyType="next"
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          Amount
        </Text>
        <Pressable onPress={() => onChangeAmount(String(Math.floor(savingsRemaining)))} hitSlop={8}>
          <Text style={{ fontSize: 12, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
            Use full ৳{Math.floor(savingsRemaining).toLocaleString()}
          </Text>
        </Pressable>
      </View>
      <View style={{
        flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
        borderColor: amountError ? colors.error : amountNum > 0 ? colors.primary : colors.border,
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
      }}>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginRight: 6, fontFamily: 'PlusJakartaSans_400Regular' }}>৳</Text>
        <TextInput
          value={amount}
          onChangeText={onChangeAmount}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: colors.textPrimary }}
        />
      </View>
      {amountError ? (
        <Text style={{ fontSize: 12, color: colors.error, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 8 }}>
          {amountError}
        </Text>
      ) : null}

      <Pressable
        onPress={onContinue}
        disabled={!canContinue}
        style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: colors.primary, opacity: canContinue ? 1 : 0.4, marginTop: 8 }}
      >
        <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Continue →</Text>
      </Pressable>

      <WithdrawalHistory withdrawals={withdrawals} />
    </View>
  );
}

interface Step2ViewProps {
  amountNum: number;
  savingsRemaining: number;
  originalSavings: number;
  saving: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

function Step2View({ amountNum, savingsRemaining, originalSavings, saving, onConfirm, onBack }: Step2ViewProps) {
  const colors = useThemeColors();
  const remainingAfter = savingsRemaining - amountNum;
  const pct = originalSavings > 0 ? Math.round((amountNum / originalSavings) * 100) : 0;

  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' }}>
        <Text style={{ fontSize: 14, color: '#92400E', fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 4 }}>
          You're dipping into your savings
        </Text>
        <Text style={{ fontSize: 13, color: '#92400E', fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 19 }}>
          This is recorded but does not affect your daily budget.
        </Text>
      </View>

      <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 14, marginBottom: 20, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>Using</Text>
          <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_700Bold' }}>৳{Math.floor(amountNum).toLocaleString()}</Text>
        </View>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>Remaining after</Text>
          <Text style={{ fontSize: 13, color: colors.textPrimary, fontFamily: 'PlusJakartaSans_700Bold' }}>৳{Math.floor(Math.max(0, remainingAfter)).toLocaleString()}</Text>
        </View>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_400Regular' }}>That's</Text>
          <Text style={{ fontSize: 13, color: colors.warning, fontFamily: 'PlusJakartaSans_700Bold' }}>{pct}% of your savings</Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Pressable
          onPress={onConfirm}
          disabled={saving}
          style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: colors.warning }}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ fontSize: 15, color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold' }}>Yes, I used this ✓</Text>
          }
        </Pressable>
        <Pressable
          onPress={onBack}
          disabled={saving}
          style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border }}
        >
          <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Go back</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/home/SavingsModal.tsx
git commit -m "feat: add SavingsModal two-step component"
```

---

### Task 4: Update savings pill in NormalState

**Files:**
- Modify: `components/home/NormalState.tsx`

**Interfaces consumed:** `ActiveCycleData.savingsWithdrawn` (from Task 2)

- [ ] **Step 1: Add new props to `NormalState`**

Add to the `Props` interface:

```ts
  savingsWithdrawn: number;
  onPressSavings: () => void;
```

Add to the destructured parameters:

```ts
export function NormalState({
  cycleData, entries, cycleTotalSpent,
  navPillOffset, insets,
  reviewAvailable, onStartReview, onSnoozeReview,
  onOpenAdd, onOpenEdit, onDeleteEntry,
  onSelectReservation,
  savingsWithdrawn,
  onPressSavings,
}: Props) {
```

- [ ] **Step 2: Replace the static savings `View` pill with a `Pressable`**

Replace this block (lines ~108-113):
```tsx
            {cycleData.cycle.savings > 0 && (
              <View style={{ backgroundColor: colors.primaryLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Savings</Text>
                <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }}>৳{Math.floor(cycleData.cycle.savings).toLocaleString()}</Text>
              </View>
            )}
```

With:
```tsx
            {cycleData.cycle.savings > 0 && (() => {
              const savingsRemaining = cycleData.cycle.savings - savingsWithdrawn;
              const fullyUsed = savingsRemaining <= 0;
              const partiallyUsed = savingsWithdrawn > 0 && !fullyUsed;
              return (
                <Pressable
                  onPress={onPressSavings}
                  style={{
                    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: colors.primaryLight,
                    borderWidth: fullyUsed ? 1 : 0,
                    borderColor: fullyUsed ? '#86EFAC' : 'transparent',
                  }}
                >
                  {fullyUsed && <Text style={{ fontSize: 11, color: colors.primary }}>✓</Text>}
                  <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Savings</Text>
                  {partiallyUsed ? (
                    <>
                      <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }}>
                        ৳{Math.floor(savingsRemaining).toLocaleString()}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'PlusJakartaSans_400Regular', opacity: 0.6 }}>
                        / ৳{Math.floor(cycleData.cycle.savings).toLocaleString()}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }}>
                      ৳{fullyUsed ? '0' : Math.floor(cycleData.cycle.savings).toLocaleString()}
                    </Text>
                  )}
                </Pressable>
              );
            })()}
```

- [ ] **Step 3: Commit**

```bash
git add components/home/NormalState.tsx
git commit -m "feat: make savings pill interactive with partial/full-used states"
```

---

### Task 5: Wire up savings modal in index.tsx

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces consumed:** all prior tasks

- [ ] **Step 1: Add imports**

Add to the import block at the top of `app/(tabs)/index.tsx`:

```ts
import { SavingsModal } from '@/components/home/SavingsModal';
import {
  addSavingsWithdrawal,
  getSavingsWithdrawals,
  type SavingsWithdrawalRow,
} from '@/services/savingsService';
```

- [ ] **Step 2: Add `savingsWithdrawals` to `HomeData`**

```ts
interface HomeData {
  name: string;
  reviewTime: number;
  cycleData: ActiveCycleData;
  entries: EntryRow[];
  cycleTotalSpent: number;
  todayReviewed: boolean;
  missedDays: MissedDay[];
  missedEntries: EntryRow[];
  savingsWithdrawals: SavingsWithdrawalRow[];  // ← add
}
```

- [ ] **Step 3: Load savings withdrawals in `load()`**

Inside `load()`, add `getSavingsWithdrawals` to the parallel fetch:

```ts
  const load = useCallback(async () => {
    const [settings, cycleData] = await Promise.all([getSettings(db), getActiveCycle(db)]);
    if (!settings || !cycleData) { setData(null); setLoading(false); return; }
    const [entries, cycleTotalSpent, todayDay, missedDays, savingsWithdrawals] = await Promise.all([
      getTodayEntries(db, cycleData.cycle.id),
      getCycleTotalSpent(db, cycleData.cycle.id),
      db.getFirstAsync<{ reviewed_at: string | null }>(
        'SELECT reviewed_at FROM days WHERE cycle_id = ? AND date = ?',
        [cycleData.cycle.id, toDateStr(new Date())]
      ),
      getMissedDays(db, cycleData.cycle.id),
      getSavingsWithdrawals(db, cycleData.cycle.id),
    ]);
    const missedEntries = await getMissedEntries(db, missedDays.map(d => d.id));
    const todayReviewed = !!(todayDay?.reviewed_at);
    const snooze = reviewSnoozedUntilRef.current;
    if (settings.notifications_enabled === 1 && (!snooze || new Date() >= snooze)) {
      scheduleReviewNotifications(settings.review_time).catch(() => {});
    }
    setData({ name: settings.name, reviewTime: settings.review_time, cycleData, entries, cycleTotalSpent, todayReviewed, missedDays, missedEntries, savingsWithdrawals });
    setLoading(false);
  }, [db]);
```

- [ ] **Step 4: Add savings modal state variables**

Add after the reservation modal state block (around line 113):

```ts
  // Savings modal
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [savingsStep, setSavingsStep] = useState<1 | 2>(1);
  const [savingsAmount, setSavingsAmount] = useState('');
  const [savingsNote, setSavingsNote] = useState('');
  const [savingsSaving, setSavingsSaving] = useState(false);
```

- [ ] **Step 5: Add savings handlers**

Add after `handleResDelete` (around line 333):

```ts
  // ── Savings handlers ────────────────────────────────────────────────────────
  function openSavings() {
    setSavingsStep(1);
    setSavingsAmount('');
    setSavingsNote('');
    setShowSavingsModal(true);
  }

  function closeSavings() {
    setShowSavingsModal(false);
    setSavingsStep(1);
    setSavingsAmount('');
    setSavingsNote('');
  }

  async function handleSavingsWithdraw() {
    if (!data || savingsSaving) return;
    const amount = parseFloat(savingsAmount);
    if (!amount || amount <= 0) return;
    setSavingsSaving(true);
    try {
      await addSavingsWithdrawal(db, data.cycleData.cycle.id, amount, savingsNote);
      await load();
      closeSavings();
    } catch (e) {
      console.error('[savings withdraw error]', e);
      showError('Failed to record savings use. Please try again.');
    } finally {
      setSavingsSaving(false);
    }
  }
```

- [ ] **Step 6: Compute savings derived values**

Add to the derived values section (after `resCanSubmit`, around line 386):

```ts
  const savingsRemaining = cycleData.cycle.savings - cycleData.savingsWithdrawn;
  const savingsAmountNum = parseFloat(savingsAmount) || 0;
  const savingsAmountValid = savingsAmountNum > 0;
  const savingsAmountError = savingsAmountValid && savingsAmountNum > savingsRemaining
    ? `Exceeds ৳${Math.floor(savingsRemaining).toLocaleString()} remaining`
    : null;
  const savingsCanContinue = savingsAmountValid && !savingsAmountError;
```

- [ ] **Step 7: Pass `savingsWithdrawn` and `onPressSavings` to `NormalState`**

Find the `<NormalState` JSX (around line 600+) and add the two new props:

```tsx
          <NormalState
            cycleData={cycleData}
            entries={entries}
            cycleTotalSpent={cycleTotalSpent}
            navPillOffset={navPillOffset}
            insets={insets}
            reviewAvailable={reviewAvailable}
            onStartReview={() => setIsReviewMode(true)}
            onSnoozeReview={handleSnoozeReview}
            onOpenAdd={openAdd}
            onOpenEdit={openEdit}
            onDeleteEntry={e => setConfirmDeleteEntry(e)}
            onSelectReservation={openReservation}
            savingsWithdrawn={cycleData.savingsWithdrawn}
            onPressSavings={openSavings}
          />
```

- [ ] **Step 8: Render `SavingsModal` in the JSX return**

Add after the `<ReservationModal` block:

```tsx
        <SavingsModal
          visible={showSavingsModal}
          onClose={closeSavings}
          originalSavings={cycleData.cycle.savings}
          savingsRemaining={savingsRemaining}
          withdrawals={data.savingsWithdrawals}
          step={savingsStep}
          amount={savingsAmount}
          note={savingsNote}
          onChangeAmount={setSavingsAmount}
          onChangeNote={setSavingsNote}
          amountError={savingsAmountError}
          canContinue={savingsCanContinue}
          saving={savingsSaving}
          onContinue={() => setSavingsStep(2)}
          onBack={() => setSavingsStep(1)}
          onConfirm={handleSavingsWithdraw}
        />
```

- [ ] **Step 9: Update cycle-ended screen to show actual remaining savings**

Find the cycle-ended "Savings (untouched)" row (around line 464) and replace:

```tsx
                    {statRow('Savings (untouched)', `৳${Math.floor(cycleData.cycle.savings).toLocaleString()}`, colors.primary)}
```

With:
```tsx
                    {(() => {
                      const remaining = cycleData.cycle.savings - cycleData.savingsWithdrawn;
                      const label = cycleData.savingsWithdrawn > 0 ? 'Savings (partially used)' : 'Savings (untouched)';
                      return statRow(label, `৳${Math.floor(Math.max(0, remaining)).toLocaleString()}`, colors.primary);
                    })()}
```

- [ ] **Step 10: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: wire up savings modal in home screen"
```

---

### Task 6: TypeScript check + final cleanup

**Files:** none created, read-only verification

- [ ] **Step 1: Run TypeScript compiler**

```bash
npx tsc --noEmit
```

Expected: no errors. If errors appear, fix them — common issues:
- `savingsWithdrawn` missing from a spread or destructure of `ActiveCycleData`
- `savingsWithdrawals` missing from `HomeData` spread

- [ ] **Step 2: Run linter**

```bash
npx expo lint
```

Expected: no new errors or warnings.

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve type errors in savings withdrawal feature"
```
