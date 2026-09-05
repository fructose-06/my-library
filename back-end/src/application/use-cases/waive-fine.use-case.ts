import { IDatabaseClient } from '../../infrastructure/database/db.js';
import { FineLedgerRepository } from '../../infrastructure/repositories/fine-ledger.repository.js';
import { UserRepository } from '../../infrastructure/repositories/user.repository.js';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log.repository.js';
import { DomainErrors } from '../../domain/errors/domain-error.js';
import { UserRole } from '../../domain/constants/rules.js';

export interface WaiveFineInput {
  userId: string;
  amount: number;
  reason: string;
  adminId: string;
  ipAddress?: string;
}

export class WaiveFineUseCase {
  constructor(
    private db: IDatabaseClient,
    private fineRepo: FineLedgerRepository,
    private userRepo: UserRepository,
    private auditRepo: AuditLogRepository
  ) {}

  async execute(input: WaiveFineInput) {
    if (input.amount <= 0) {
      throw DomainErrors.INVALID_AMOUNT('Waiver amount must be greater than zero');
    }
    if (!input.reason || input.reason.trim().length === 0) {
      throw DomainErrors.INVALID_AMOUNT('Reason is strictly required for waiving fines');
    }

    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      // Verify Admin
      const admin = await this.userRepo.findById(input.adminId, client);
      if (!admin) {
        throw DomainErrors.USER_NOT_FOUND(input.adminId);
      }
      if (admin.role !== UserRole.ADMIN) {
        throw DomainErrors.FORBIDDEN('Only administrators are authorized to waive fines');
      }

      const borrower = await this.userRepo.findById(input.userId, client);
      if (!borrower) {
        throw DomainErrors.USER_NOT_FOUND(input.userId);
      }

      const outstanding = await this.fineRepo.getOutstandingBalance(borrower.id, client);
      if (input.amount > outstanding) {
        throw DomainErrors.PAYMENT_EXCEEDS_OUTSTANDING(input.amount, outstanding);
      }

      const waiverId = `waive-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const waiver = await this.fineRepo.recordWaiver(
        {
          id: waiverId,
          user_id: borrower.id,
          amount_waived: input.amount,
          reason: input.reason,
          approved_by: admin.id,
        },
        client
      );

      const newOutstanding = await this.fineRepo.getOutstandingBalance(borrower.id, client);

      await this.auditRepo.log(
        {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          actor_id: admin.id,
          action: 'WAIVE_FINE',
          resource_type: 'WAIVER',
          resource_id: waiver.id,
          details: {
            user_id: borrower.id,
            amount_waived: input.amount,
            reason: input.reason,
            previous_outstanding: outstanding,
            new_outstanding: newOutstanding,
          },
          ip_address: input.ipAddress,
        },
        client
      );

      await client.query('COMMIT');

      return {
        waiver,
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
