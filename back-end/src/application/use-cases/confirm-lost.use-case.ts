import { IDatabaseClient } from '../../infrastructure/database/db.js';
import { LoanRepository } from '../../infrastructure/repositories/loan.repository.js';
import { CopyRepository } from '../../infrastructure/repositories/copy.repository.js';
import { FineLedgerRepository } from '../../infrastructure/repositories/fine-ledger.repository.js';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log.repository.js';
import { ChargeType, CopyStatus, LoanStatus, RULES } from '../../domain/constants/rules.js';
import { DomainError } from '../../domain/errors/domain-error.js';
import { FineCalculator } from '../../domain/services/fine-calculator.js';

export interface ConfirmLostInput {
  loanId: string;
  librarianId: string;
  confirmDate?: Date;
  ipAddress?: string;
}

export class ConfirmLostUseCase {
  constructor(
    private db: IDatabaseClient,
    private loanRepo: LoanRepository,
    private copyRepo: CopyRepository,
    private fineRepo: FineLedgerRepository,
    private auditRepo: AuditLogRepository
  ) {}

  async execute(input: ConfirmLostInput) {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      const loan = await this.loanRepo.findById(input.loanId, client);
      if (!loan) {
        throw new DomainError('LOAN_NOT_FOUND', `Loan '${input.loanId}' was not found`, 404);
      }
      if (loan.status !== LoanStatus.ACTIVE) {
        throw new DomainError('INVALID_STATE_TRANSITION', `Cannot mark loan as lost from status '${loan.status}'`, 400);
      }

      const copy = await this.copyRepo.findByIdForUpdate(loan.copy_id, client);
      if (!copy) {
        throw new DomainError('COPY_NOT_FOUND', `Physical copy '${loan.copy_id}' was not found`, 404);
      }

      const confirmDate = input.confirmDate || new Date();

      // 1. Calculate lost charges:
      // Replacement Charge = Acquisition Price + Processing Fee (200) + Late fine before confirm lost
      const lostChargeResult = FineCalculator.calculateLostCharges(
        copy.acquisition_price,
        loan.due_date,
        confirmDate
      );

      // 2. Record Fine Charges in fine_ledger
      // a) Lost Replacement
      const replacementCharge = await this.fineRepo.createCharge(
        {
          id: `fine-lost-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: loan.user_id,
          loan_id: loan.id,
          charge_type: ChargeType.LOST_REPLACEMENT,
          amount: lostChargeResult.acquisitionPrice,
        },
        client
      );

      // b) Processing Fee
      const processingFeeCharge = await this.fineRepo.createCharge(
        {
          id: `fine-fee-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: loan.user_id,
          loan_id: loan.id,
          charge_type: ChargeType.PROCESSING_FEE,
          amount: lostChargeResult.processingFee,
        },
        client
      );

      // c) Late fine accrued up to confirm date (if any)
      let lateFineCharge = null;
      if (lostChargeResult.accruedLateFine > 0) {
        lateFineCharge = await this.fineRepo.createCharge(
          {
            id: `fine-late-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            user_id: loan.user_id,
            loan_id: loan.id,
            charge_type: ChargeType.LATE_FINE,
            amount: lostChargeResult.accruedLateFine,
          },
          client
        );
      }

      // 3. Update Loan status to LOST
      const updatedLoan = await this.loanRepo.markLost(loan.id, client);

      // 4. Update Physical Copy status to LOST
      await this.copyRepo.updateStatus(copy.id, CopyStatus.LOST, client);

      // 5. Audit Log
      await this.auditRepo.log(
        {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          actor_id: input.librarianId,
          action: 'CONFIRM_LOST',
          resource_type: 'LOAN',
          resource_id: loan.id,
          details: {
            loan_id: loan.id,
            copy_id: copy.id,
            total_charge: lostChargeResult.totalCharge,
            acquisition_price: lostChargeResult.acquisitionPrice,
            processing_fee: lostChargeResult.processingFee,
            accrued_late_fine: lostChargeResult.accruedLateFine,
          },
          ip_address: input.ipAddress,
        },
        client
      );

      await client.query('COMMIT');

      return {
        loan: updatedLoan,
        copyStatus: CopyStatus.LOST,
        charges: {
          replacementPrice: lostChargeResult.acquisitionPrice,
          processingFee: lostChargeResult.processingFee,
          accruedLateFine: lostChargeResult.accruedLateFine,
          totalCharge: lostChargeResult.totalCharge,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
