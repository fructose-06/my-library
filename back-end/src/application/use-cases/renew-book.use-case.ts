import { IDatabaseClient } from '../../infrastructure/database/db.js';
import { LoanRepository } from '../../infrastructure/repositories/loan.repository.js';
import { UserRepository } from '../../infrastructure/repositories/user.repository.js';
import { ReservationRepository } from '../../infrastructure/repositories/reservation.repository.js';
import { FineLedgerRepository } from '../../infrastructure/repositories/fine-ledger.repository.js';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log.repository.js';
import { DomainErrors, DomainError } from '../../domain/errors/domain-error.js';
import { LoanStatus, RULES, UserStatus } from '../../domain/constants/rules.js';
import { FineCalculator } from '../../domain/services/fine-calculator.js';

export interface RenewBookInput {
  loanId: string;
  actorId?: string;
  ipAddress?: string;
}

export class RenewBookUseCase {
  constructor(
    private db: IDatabaseClient,
    private loanRepo: LoanRepository,
    private userRepo: UserRepository,
    private reservationRepo: ReservationRepository,
    private fineRepo: FineLedgerRepository,
    private auditRepo: AuditLogRepository
  ) {}

  async execute(input: RenewBookInput) {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      const loan = await this.loanRepo.findById(input.loanId, client);
      if (!loan) {
        throw new DomainError('LOAN_NOT_FOUND', `Loan '${input.loanId}' was not found`, 404);
      }
      if (loan.status !== LoanStatus.ACTIVE) {
        throw new DomainError('INVALID_STATE_TRANSITION', `Cannot renew loan in status '${loan.status}'`, 400);
      }

      const borrower = await this.userRepo.findById(loan.user_id, client);
      if (!borrower) {
        throw DomainErrors.USER_NOT_FOUND(loan.user_id);
      }

      // Condition 4: User disabled
      if (borrower.status !== UserStatus.ACTIVE) {
        throw DomainErrors.USER_DISABLED();
      }

      // Condition 1: Loan is already overdue
      const now = new Date();
      const lateDays = FineCalculator.calculateCalendarDaysDifference(loan.due_date, now);
      if (lateDays > 0) {
        throw DomainErrors.RENEW_OVERDUE_LOAN();
      }

      // Condition 2: Max renewals reached (2 times max)
      if (loan.renewal_count >= RULES.MAX_RENEWALS) {
        throw DomainErrors.RENEW_LIMIT_EXCEEDED(loan.renewal_count, RULES.MAX_RENEWALS);
      }

      // Condition 3: Book has active reservation queue from other users
      const hasQueue = await this.reservationRepo.hasPendingQueueForBook(loan.book_id, client);
      if (hasQueue) {
        throw DomainErrors.RENEW_BLOCKED_BY_RESERVATION();
      }

      // Condition 5: Outstanding fine >= 500 THB
      const balance = await this.fineRepo.getOutstandingBalance(borrower.id, client);
      if (balance >= RULES.FINE_BLOCK_THRESHOLD) {
        throw DomainErrors.FINE_LIMIT_EXCEEDED(balance, RULES.FINE_BLOCK_THRESHOLD);
      }

      // Condition 6: Borrower has other overdue loans
      const hasOtherOverdue = await this.loanRepo.hasOverdueLoans(borrower.id, now, client);
      if (hasOtherOverdue) {
        throw DomainErrors.USER_HAS_OVERDUE_LOAN();
      }

      // Calculate new due date (+7 calendar days from current due date)
      const newDueDate = new Date(loan.due_date.getTime() + RULES.RENEWAL_EXTENSION_DAYS * 24 * 60 * 60 * 1000);

      const renewedLoan = await this.loanRepo.renew(loan.id, newDueDate, client);

      // Audit Log
      await this.auditRepo.log(
        {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          actor_id: input.actorId || borrower.id,
          action: 'RENEW_BOOK',
          resource_type: 'LOAN',
          resource_id: loan.id,
          details: {
            loan_id: loan.id,
            previous_due_date: loan.due_date.toISOString(),
            new_due_date: newDueDate.toISOString(),
            renewal_count: (loan.renewal_count || 0) + 1,
          },
          ip_address: input.ipAddress,
        },
        client
      );

      await client.query('COMMIT');
      return renewedLoan;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
