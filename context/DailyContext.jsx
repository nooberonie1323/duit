import { createContext, useContext, useState } from "react";

const DailyContext = createContext(null);

export function DailyProvider({ children }) {
  // Each item: { id, amount, type: "deduct"|"credit", timestamp }
  const [pendingDeductions, setPendingDeductions] = useState([]);
  // Each item: { id, note, amount, timestamp }
  const [bigExpenses, setBigExpenses] = useState([]);
  // Hour (0-23) at which review unlocks — default 22 = 10pm
  const [reviewHour, setReviewHour] = useState(22);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [confirmedTotal, setConfirmedTotal] = useState(0);

  // ── Quick deductions ──────────────────────────────────────────────────────

  function addDeduction(amount) {
    setPendingDeductions((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), amount, type: "deduct", timestamp: new Date() },
    ]);
  }

  function addCredit(amount) {
    const net = pendingDeductions.reduce(
      (sum, d) => (d.type === "deduct" ? sum + d.amount : sum - d.amount),
      0
    );
    if (net <= 0) return;
    const creditAmount = Math.min(amount, net);
    setPendingDeductions((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), amount: creditAmount, type: "credit", timestamp: new Date() },
    ]);
  }

  function removeDeductionItem(id) {
    setPendingDeductions((prev) => prev.filter((d) => d.id !== id));
  }

  // ── Big expenses ──────────────────────────────────────────────────────────

  function addBigExpense(note, amount) {
    setBigExpenses((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), note, amount, timestamp: new Date() },
    ]);
  }

  function editBigExpense(id, note, amount) {
    setBigExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, note, amount } : e))
    );
  }

  function removeBigExpense(id) {
    setBigExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  // ── Confirm review ────────────────────────────────────────────────────────

  function confirmAndSave(total) {
    setConfirmedTotal(total);
    setReviewConfirmed(true);
    setPendingDeductions([]);
    setBigExpenses([]);
  }

  // ── Derived totals ────────────────────────────────────────────────────────

  const totalDeductions = Math.max(
    0,
    pendingDeductions.reduce(
      (sum, d) => (d.type === "deduct" ? sum + d.amount : sum - d.amount),
      0
    )
  );
  const totalBigExpenses = bigExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPending = totalDeductions + totalBigExpenses;

  return (
    <DailyContext.Provider
      value={{
        pendingDeductions,
        bigExpenses,
        reviewHour,
        setReviewHour,
        reviewConfirmed,
        confirmedTotal,
        totalPending,
        totalDeductions,
        addDeduction,
        addCredit,
        removeDeductionItem,
        addBigExpense,
        editBigExpense,
        removeBigExpense,
        confirmAndSave,
      }}
    >
      {children}
    </DailyContext.Provider>
  );
}

export function useDailyContext() {
  return useContext(DailyContext);
}
