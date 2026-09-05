import { IDatabaseClient } from '../../infrastructure/database/db.js';
import { FineLedgerRepository } from '../../infrastructure/repositories/fine-ledger.repository.js';
import { UserRepository } from '../../infrastructure/repositories/user.repository.js';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log.repository.js';
import { DomainErrors } from '../../domain/errors/domain-error.js';

export interface PayFineInput {
  userId: string;
  amount: number;
  librarianId: string;
  notes?: string;
  ipAddress?: string;
}

export class PayFineUseCase {
  constructor(
    private db: IDatabaseClient,
    private fineRepo: FineLedgerRepository,
    private userRepo: UserRepository,
    private auditRepo: AuditLogRepository
  ) {}

  async execute(input: PayFineInput) {
    if (input.amount <= 0) {
      throw DomainErrors.INVALID_AMOUNT('Payment amount must be greater than zero');
    }

    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      const borrower = await this.userRepo.findById(input.userId, client);
      if (!borrower) {
        throw DomainErrors.USER_NOT_FOUND(input.userId);
      }

      const outstanding = await this.fineRepo.getOutstandingBalance(borrower.id, client);
      if (input.amount > outstanding) {
        throw DomainErrors.PAYMENT_EXCEEDS_OUTSTANDING(input.amount, outstanding);
      }

      const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const payment = await this.fineRepo.recordPayment(
        {
          id: paymentId,
          user_id: borrower.id,
          amount_paid: input.amount,
          received_by: input.librarianId,
          notes: input.notes,
        },
        client
      );

      const newOutstanding = await this.fineRepo.getOutstandingBalance(borrower.id, client);

      await this.auditRepo.log(
        {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          actor_id: input.librarianId,
          action: 'PAY_FINE',
          resource_type: 'PAYMENT',
          resource_id: payment.id,
          details: {
            user_id: borrower.id,
            amount_paid: input.amount,
            previous_outstanding: outstanding,
            new_outstanding: newOutstanding,
          },
          ip_address: input.ipAddress,
        },
        client
      );

      await client.query('COMMIT');

      return {
        payment,
        previousOutstanding: outstanding,
        newOutstanding,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
