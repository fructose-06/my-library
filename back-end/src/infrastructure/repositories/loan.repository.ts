import { IDatabaseClient, IClientTransaction } from '../database/db.js';
import { LoanStatus, RULES } from '../../domain/constants/rules.js';
import { FineCalculator } from '../../domain/services/fine-calculator.js';

export interface LoanRow {
  id: string;
  user_id: string;
  copy_id: string;
  book_id: string;
  borrow_date: Date;
  due_date: Date;
  return_date: Date | null;
  renewal_count: number;
  status: LoanStatus;
  created_at: Date;
  updated_at: Date;
  book_title?: string;
  copy_barcode?: string;
  borrower_name?: string;
  accrued_late_fine?: number;
  is_overdue?: boolean;
}

export class LoanRepository {
  constructor(private db: IDatabaseClient) {}

  async findById(id: string, client?: IClientTransaction): Promise<LoanRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `SELECT l.*, b.title as book_title, pc.barcode as copy_barcode, u.full_name as borrower_name
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN physical_copies pc ON l.copy_id = pc.id
       JOIN users u ON l.user_id = u.id
       WHERE l.id = $1`,
      [id]
    );

    if (!res.rows[0]) return null;
    return this.mapLoanRow(res.rows[0]);
  }

  async countActiveLoansByUser(userId: string, client?: IClientTransaction): Promise<number> {
    const runner = client || this.db;
    const res = await runner.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM loans WHERE user_id = $1 AND status = 'ACTIVE'`,
      [userId]
    );
    return Number(res.rows[0]?.count || 0);
  }

  async hasActiveLoanForBook(userId: string, bookId: string, client?: IClientTransaction): Promise<boolean> {
    const runner = client || this.db;
    const res = await runner.query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM loans WHERE user_id = $1 AND book_id = $2 AND status = 'ACTIVE'
      ) as exists`,
      [userId, bookId]
    );
    return Boolean(res.rows[0]?.exists);
  }

  async hasOverdueLoans(userId: string, asOfDate: Date = new Date(), client?: IClientTransaction): Promise<boolean> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `SELECT * FROM loans WHERE user_id = $1 AND status = 'ACTIVE'`,
      [userId]
    );

    for (const row of res.rows) {
      const diff = FineCalculator.calculateCalendarDaysDifference(new Date(row.due_date), asOfDate);
      if (diff > 0) {
        return true;
      }
    }
    return false;
  }

  async create(
    loan: {
      id: string;
      user_id: string;
      copy_id: string;
      book_id: string;
      borrow_date?: Date;
      due_date: Date;
    },
    client?: IClientTransaction
  ): Promise<LoanRow> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `INSERT INTO loans (id, user_id, copy_id, book_id, borrow_date, due_date, renewal_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, 0, 'ACTIVE')
       RETURNING *`,
      [
        loan.id,
        loan.user_id,
        loan.copy_id,
        loan.book_id,
        loan.borrow_date || new Date(),
        loan.due_date,
      ]
    );

    const created = await this.findById(loan.id, client);
    return created!;
  }

  async renew(
    loanId: string,
    newDueDate: Date,
    client?: IClientTransaction
  ): Promise<LoanRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `UPDATE loans
       SET due_date = $1, renewal_count = renewal_count + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [newDueDate, loanId]
    );

    if (!res.rows[0]) return null;
    return this.findById(loanId, client);
  }

  async markReturned(
    loanId: string,
    returnDate: Date = new Date(),
    client?: IClientTransaction
  ): Promise<LoanRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `UPDATE loans
       SET return_date = $1, status = 'RETURNED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [returnDate, loanId]
    );

    if (!res.rows[0]) return null;
    return this.findById(loanId, client);
  }

  async markLost(
    loanId: string,
    client?: IClientTransaction
  ): Promise<LoanRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `UPDATE loans
       SET status = 'LOST', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [loanId]
    );

    if (!res.rows[0]) return null;
    return this.findById(loanId, client);
  }

  async listByUser(
    userId: string,
    options: { activeOnly?: boolean; limit?: number; offset?: number } = {}
  ): Promise<{ loans: LoanRow[]; total: number }> {
    const limit = Math.min(options.limit || 20, 100);
    const offset = options.offset || 0;

    let whereClause = `WHERE l.user_id = $1`;
    if (options.activeOnly) {
      whereClause += ` AND l.status = 'ACTIVE'`;
    }

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM loans l ${whereClause}`,
      [userId]
    );
    const total = Number(countRes.rows[0]?.count || 0);

    const res = await this.db.query<any>(
      `SELECT l.*, b.title as book_title, pc.barcode as copy_barcode, u.full_name as borrower_name
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN physical_copies pc ON l.copy_id = pc.id
       JOIN users u ON l.user_id = u.id
       ${whereClause}
       ORDER BY l.borrow_date DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const loans = res.rows.map((r: any) => this.mapLoanRow(r));
    return { loans, total };
  }

  async listAllOverdueLoans(): Promise<LoanRow[]> {
    const res = await this.db.query<any>(
      `SELECT l.*, b.title as book_title, pc.barcode as copy_barcode, u.full_name as borrower_name
       FROM loans l
       JOIN books b ON l.book_id = b.id
       JOIN physical_copies pc ON l.copy_id = pc.id
       JOIN users u ON l.user_id = u.id
       WHERE l.status = 'ACTIVE'`
    );

    const now = new Date();
    const overdueLoans: LoanRow[] = [];

    for (const r of res.rows) {
      const loan = this.mapLoanRow(r);
      if (loan.is_overdue) {
        overdueLoans.push(loan);
      }
    }

    return overdueLoans;
  }

  private mapLoanRow(row: any): LoanRow {
    const dueDate = new Date(row.due_date);
    const now = new Date();
    const returnDate = row.return_date ? new Date(row.return_date) : null;

    let accruedFine = 0;
    let isOverdue = false;

    if (row.status === 'ACTIVE') {
      const { cappedFine, lateDays } = FineCalculator.calculateLateFine(dueDate, now);
      accruedFine = cappedFine;
      isOverdue = lateDays > 0;
    } else if (returnDate) {
      const { cappedFine, lateDays } = FineCalculator.calculateLateFine(dueDate, returnDate);
      accruedFine = cappedFine;
      isOverdue = lateDays > 0;
    }

    return {
      id: row.id,
      user_id: row.user_id,
      copy_id: row.copy_id,
      book_id: row.book_id,
      borrow_date: new Date(row.borrow_date),
      due_date: dueDate,
      return_date: returnDate,
      renewal_count: Number(row.renewal_count || 0),
      status: row.status as LoanStatus,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      book_title: row.book_title,
      copy_barcode: row.copy_barcode,
      borrower_name: row.borrower_name,
      accrued_late_fine: accruedFine,
      is_overdue: isOverdue,
    };
  }
}
