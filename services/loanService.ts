import type { SQLiteDatabase } from 'expo-sqlite';

export type LoanType = 'lent' | 'borrowed';
export type LoanStatus = 'active' | 'settled';
export type ReceiptAction = 'pool' | 'savings' | 'reservation' | 'used' | 'pending';

export interface LoanRow {
  id: number;
  type: LoanType;
  person_name: string;
  original_amount: number;
  note: string | null;
  loaned_at: string;
  status: LoanStatus;
  created_at: string;
}

export interface LoanReceiptRow {
  id: number;
  loan_id: number;
  amount: number;
  action: ReceiptAction;
  cycle_id: number | null;
  created_at: string;
}

export interface LoanRepaymentPlanRow {
  id: number;
  loan_id: number;
  amount_per_month: number;
  total_months: number;
}

export interface LoanRepaymentRecordRow {
  id: number;
  loan_id: number;
  cycle_id: number;
  reservation_id: number | null;
  created_at: string;
}

export interface LoanWithComputed extends LoanRow {
  amount_returned: number;
  has_pending_receipt: boolean;
  repayment_plan: LoanRepaymentPlanRow | null;
  months_paid: number;
}

export interface CreateLoanInput {
  type: LoanType;
  person_name: string;
  original_amount: number;
  note: string;
  loaned_at: string;
  repayment_plan?: { amount_per_month: number; total_months: number };
}

export interface AddLoanReceiptParams {
  loanId: number;
  originalAmount: number;
  amount: number;
  action: ReceiptAction;
  cycleId: number | null;
  reservationName?: string;
}

export interface ActiveBorrowedLoan {
  loan_id: number;
  person_name: string;
  amount_per_month: number;
  months_remaining: number;
}

export async function getLoans(db: SQLiteDatabase): Promise<LoanWithComputed[]> {
  const loans = await db.getAllAsync<LoanRow>(
    'SELECT * FROM loans ORDER BY created_at DESC'
  );

  const result: LoanWithComputed[] = [];

  for (const loan of loans) {
    const receiptRow = await db.getFirstAsync<{ total: number; has_pending: number }>(
      `SELECT
        COALESCE(SUM(amount), 0) as total,
        MAX(CASE WHEN action = 'pending' THEN 1 ELSE 0 END) as has_pending
       FROM loan_receipts WHERE loan_id = ?`,
      [loan.id]
    );

    const plan = await db.getFirstAsync<LoanRepaymentPlanRow>(
      'SELECT * FROM loan_repayment_plans WHERE loan_id = ?',
      [loan.id]
    );

    const paidRow = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM loan_repayment_records WHERE loan_id = ? AND reservation_id IS NOT NULL',
      [loan.id]
    );

    result.push({
      ...loan,
      amount_returned: receiptRow?.total ?? 0,
      has_pending_receipt: (receiptRow?.has_pending ?? 0) === 1,
      repayment_plan: plan ?? null,
      months_paid: paidRow?.count ?? 0,
    });
  }

  return result;
}

export async function getLoanReceipts(
  db: SQLiteDatabase,
  loanId: number
): Promise<LoanReceiptRow[]> {
  return db.getAllAsync<LoanReceiptRow>(
    'SELECT * FROM loan_receipts WHERE loan_id = ? ORDER BY created_at DESC',
    [loanId]
  );
}

export async function createLoan(
  db: SQLiteDatabase,
  input: CreateLoanInput
): Promise<number> {
  await db.execAsync('BEGIN');
  try {
    const result = await db.runAsync(
      `INSERT INTO loans (type, person_name, original_amount, note, loaned_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.type,
        input.person_name.trim(),
        input.original_amount,
        input.note.trim() || null,
        input.loaned_at,
      ]
    );
    const loanId = result.lastInsertRowId;

    if (input.repayment_plan) {
      await db.runAsync(
        'INSERT INTO loan_repayment_plans (loan_id, amount_per_month, total_months) VALUES (?, ?, ?)',
        [loanId, input.repayment_plan.amount_per_month, input.repayment_plan.total_months]
      );
    }

    await db.execAsync('COMMIT');
    return loanId;
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

export async function settleLoan(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync("UPDATE loans SET status = 'settled' WHERE id = ?", [id]);
}

export async function deleteLoan(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM loans WHERE id = ?', [id]);
}

export async function addLoanReceipt(
  db: SQLiteDatabase,
  params: AddLoanReceiptParams
): Promise<void> {
  const { loanId, originalAmount, amount, action, cycleId, reservationName } = params;

  await db.execAsync('BEGIN');
  try {
    await db.runAsync(
      'INSERT INTO loan_receipts (loan_id, amount, action, cycle_id) VALUES (?, ?, ?, ?)',
      [loanId, amount, action, cycleId]
    );

    if (action === 'pool' && cycleId !== null) {
      const lastReview = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM days
         WHERE cycle_id = ? AND reviewed_at IS NOT NULL AND pool_after_review IS NOT NULL
         ORDER BY date DESC LIMIT 1`,
        [cycleId]
      );
      if (lastReview) {
        await db.runAsync(
          'UPDATE days SET pool_after_review = pool_after_review + ? WHERE id = ?',
          [amount, lastReview.id]
        );
      }
    }

    if (action === 'savings' && cycleId !== null) {
      await db.runAsync(
        'UPDATE cycles SET savings = savings + ? WHERE id = ?',
        [amount, cycleId]
      );
    }

    if (action === 'reservation' && cycleId !== null && reservationName) {
      await db.runAsync(
        'INSERT INTO reservations (cycle_id, name, amount) VALUES (?, ?, ?)',
        [cycleId, reservationName.trim(), amount]
      );
    }

    // Auto-settle when fully returned
    const totalRow = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM loan_receipts WHERE loan_id = ?',
      [loanId]
    );
    if ((totalRow?.total ?? 0) >= originalAmount) {
      await db.runAsync("UPDATE loans SET status = 'settled' WHERE id = ?", [loanId]);
    }

    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

export async function getActiveBorrowedLoansForCycle(
  db: SQLiteDatabase
): Promise<ActiveBorrowedLoan[]> {
  const rows = await db.getAllAsync<{
    loan_id: number;
    person_name: string;
    amount_per_month: number;
    total_months: number;
    months_paid: number;
  }>(
    `SELECT
       l.id as loan_id,
       l.person_name,
       p.amount_per_month,
       p.total_months,
       COUNT(r.id) as months_paid
     FROM loans l
     JOIN loan_repayment_plans p ON p.loan_id = l.id
     LEFT JOIN loan_repayment_records r ON r.loan_id = l.id AND r.reservation_id IS NOT NULL
     WHERE l.type = 'borrowed' AND l.status = 'active'
     GROUP BY l.id`,
    []
  );

  return rows
    .filter(r => r.months_paid < r.total_months)
    .map(r => ({
      loan_id: r.loan_id,
      person_name: r.person_name,
      amount_per_month: r.amount_per_month,
      months_remaining: r.total_months - r.months_paid,
    }));
}

export async function recordRepaymentReservation(
  db: SQLiteDatabase,
  loanId: number,
  cycleId: number,
  reservationId: number | null
): Promise<void> {
  await db.runAsync(
    'INSERT INTO loan_repayment_records (loan_id, cycle_id, reservation_id) VALUES (?, ?, ?)',
    [loanId, cycleId, reservationId]
  );
}

export async function getLoanRepaymentRecords(
  db: SQLiteDatabase,
  loanId: number
): Promise<LoanRepaymentRecordRow[]> {
  return db.getAllAsync<LoanRepaymentRecordRow>(
    'SELECT * FROM loan_repayment_records WHERE loan_id = ? ORDER BY created_at DESC',
    [loanId]
  );
}
