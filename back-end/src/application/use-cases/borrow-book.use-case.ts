import { IDatabaseClient } from '../../infrastructure/database/db.js';
import { UserRepository } from '../../infrastructure/repositories/user.repository.js';
import { BookRepository } from '../../infrastructure/repositories/book.repository.js';
import { CopyRepository } from '../../infrastructure/repositories/copy.repository.js';
import { LoanRepository } from '../../infrastructure/repositories/loan.repository.js';
import { ReservationRepository } from '../../infrastructure/repositories/reservation.repository.js';
import { FineLedgerRepository } from '../../infrastructure/repositories/fine-ledger.repository.js';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log.repository.js';
import { DomainErrors } from '../../domain/errors/domain-error.js';
import { CopyStatus, RULES, UserStatus, UserRole } from '../../domain/constants/rules.js';

export interface BorrowBookInput {
  borrowerId: string;
  barcode: string;
  actorId?: string;
  ipAddress?: string;
}

export class BorrowBookUseCase {
  constructor(
    private db: IDatabaseClient,
    private userRepo: UserRepository,
    private bookRepo: BookRepository,
    private copyRepo: CopyRepository,
    private loanRepo: LoanRepository,
    private reservationRepo: ReservationRepository,
    private fineRepo: FineLedgerRepository,
    private auditRepo: AuditLogRepository
  ) {}

  async execute(input: BorrowBookInput) {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      // 1. Verify borrower
      const borrower = await this.userRepo.findById(input.borrowerId, client);
      if (!borrower) {
        throw DomainErrors.USER_NOT_FOUND(input.borrowerId);
      }
      if (borrower.status !== UserStatus.ACTIVE) {
        throw DomainErrors.USER_DISABLED();
      }
      // Only STUDENT and LECTURER are permitted to hold book loans (Section 5 & 42)
      if (borrower.role !== UserRole.STUDENT && borrower.role !== UserRole.LECTURER) {
        throw DomainErrors.FORBIDDEN('Only students and lecturers are permitted to borrow books');
      }

      // 2. Check active loans limit (capped at 5)
      const activeLoansCount = await this.loanRepo.countActiveLoansByUser(borrower.id, client);
      if (activeLoansCount >= RULES.MAX_ACTIVE_LOANS) {
        throw DomainErrors.LOAN_LIMIT_EXCEEDED(activeLoansCount, RULES.MAX_ACTIVE_LOANS);
      }

      // 3. Check for any overdue loans
      const hasOverdue = await this.loanRepo.hasOverdueLoans(borrower.id, new Date(), client);
      if (hasOverdue) {
        throw DomainErrors.USER_HAS_OVERDUE_LOAN();
      }

      // 4. Check outstanding fine balance (>= 500 THB blocks borrowing)
      const outstandingBalance = await this.fineRepo.getOutstandingBalance(borrower.id, client);
      if (outstandingBalance >= RULES.FINE_BLOCK_THRESHOLD) {
        throw DomainErrors.FINE_LIMIT_EXCEEDED(outstandingBalance, RULES.FINE_BLOCK_THRESHOLD);
      }

      // 5. Pessimistic Row Lock: SELECT ... FOR UPDATE on physical copy
      // This is the core concurrency defense against double-borrowing!
      const copy = await this.copyRepo.findByBarcodeForUpdate(input.barcode, client);
      if (!copy) {
        throw DomainErrors.COPY_NOT_FOUND(input.barcode);
      }

      // 6. Check if borrower is already holding a copy of this book
      const isAlreadyBorrowingBook = await this.loanRepo.hasActiveLoanForBook(borrower.id, copy.book_id, client);
      if (isAlreadyBorrowingBook) {
        const book = await this.bookRepo.findById(copy.book_id, client);
        throw DomainErrors.DUPLICATE_ACTIVE_LOAN(book?.title || 'this book');
      }

      // 7. Check copy availability & hold status
      if (copy.status === CopyStatus.AVAILABLE) {
        // Can borrow immediately
      } else if (copy.status === CopyStatus.ON_HOLD) {
        // Can only borrow if on hold for this specific user
        const holdRes = await client.query<any>(
          `SELECT * FROM reservations
           WHERE allocated_copy_id = $1 AND user_id = $2 AND status = 'ON_HOLD'`,
          [copy.id, borrower.id]
        );
        if (holdRes.rows.length === 0) {
          throw DomainErrors.COPY_NOT_AVAILABLE(copy.status);
        }
        // Fulfill the reservation
        await this.reservationRepo.fulfill(holdRes.rows[0].id, client);
      } else {
        throw DomainErrors.COPY_NOT_AVAILABLE(copy.status);
      }

      // 8. Atomic compare-and-swap state transition to ON_LOAN
      const claimedCopy = await this.copyRepo.claimCopyForLoan(copy.id, client);
      if (!claimedCopy) {
        throw DomainErrors.COPY_NOT_AVAILABLE(CopyStatus.ON_LOAN);
      }

      // 9. Calculate due date: 14 Calendar days from now
      const now = new Date();
      const dueDate = new Date(now.getTime() + RULES.LOAN_DURATION_DAYS * 24 * 60 * 60 * 1000);

      // 10. Create loan record
      const loanId = `loan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const loan = await this.loanRepo.create(
        {
          id: loanId,
          user_id: borrower.id,
          copy_id: copy.id,
          book_id: copy.book_id,
          borrow_date: now,
          due_date: dueDate,
        },
        client
      );

      // 11. Write immutable audit log
      await this.auditRepo.log(
        {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          actor_id: input.actorId || borrower.id,
          action: 'BORROW_BOOK',
          resource_type: 'LOAN',
          resource_id: loan.id,
          details: {
            borrower_id: borrower.id,
            copy_id: copy.id,
            barcode: copy.barcode,
            book_id: copy.book_id,
            due_date: dueDate.toISOString(),
          },
          ip_address: input.ipAddress,
        },
        client
      );

      await client.query('COMMIT');
      return loan;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
