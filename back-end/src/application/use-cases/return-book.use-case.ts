import { IDatabaseClient } from '../../infrastructure/database/db.js';
import { LoanRepository } from '../../infrastructure/repositories/loan.repository.js';
import { CopyRepository } from '../../infrastructure/repositories/copy.repository.js';
import { ReservationRepository } from '../../infrastructure/repositories/reservation.repository.js';
import { FineLedgerRepository } from '../../infrastructure/repositories/fine-ledger.repository.js';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log.repository.js';
import { FineCalculator } from '../../domain/services/fine-calculator.js';
import { ChargeType, CopyStatus, DamageCondition, LoanStatus, RULES } from '../../domain/constants/rules.js';
import { DomainError } from '../../domain/errors/domain-error.js';

export interface ReturnBookInput {
  loanId: string;
  condition?: DamageCondition;
  returnDate?: Date;
  actorId?: string;
  ipAddress?: string;
}

export class ReturnBookUseCase {
  constructor(
    private db: IDatabaseClient,
    private loanRepo: LoanRepository,
    private copyRepo: CopyRepository,
    private reservationRepo: ReservationRepository,
    private fineRepo: FineLedgerRepository,
    private auditRepo: AuditLogRepository
  ) {}

  async execute(input: ReturnBookInput) {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      const loan = await this.loanRepo.findById(input.loanId, client);
      if (!loan) {
        throw new DomainError('LOAN_NOT_FOUND', `Loan '${input.loanId}' was not found`, 404);
      }
      if (loan.status !== LoanStatus.ACTIVE) {
        throw new DomainError('INVALID_STATE_TRANSITION', `Loan is already '${loan.status}'`, 400);
      }

      const copy = await this.copyRepo.findByIdForUpdate(loan.copy_id, client);
      if (!copy) {
        throw new DomainError('COPY_NOT_FOUND', `Physical copy '${loan.copy_id}' was not found`, 404);
      }

      const returnDate = input.returnDate || new Date();
      const condition = input.condition || DamageCondition.NORMAL;

      // 1. Calculate Late Fine
      const { lateDays, cappedFine } = FineCalculator.calculateLateFine(loan.due_date, returnDate);
      let lateFineCharge = null;
      if (cappedFine > 0) {
        lateFineCharge = await this.fineRepo.createCharge(
          {
            id: `fine-late-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            user_id: loan.user_id,
            loan_id: loan.id,
            charge_type: ChargeType.LATE_FINE,
            amount: cappedFine,
          },
          client
        );
      }

      // 2. Calculate Damage Charge
      const damageResult = FineCalculator.calculateDamageCharge(condition, copy.acquisition_price);
      let damageCharge = null;
      if (damageResult.charge > 0) {
        damageCharge = await this.fineRepo.createCharge(
          {
            id: `fine-dmg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            user_id: loan.user_id,
            loan_id: loan.id,
            charge_type: ChargeType.DAMAGE_CHARGE,
            amount: damageResult.charge,
          },
          client
        );
      }

      // 3. Mark Loan as RETURNED
      const updatedLoan = await this.loanRepo.markReturned(loan.id, returnDate, client);

      // 4. Determine Copy Next Status & Reservation Hold
      let nextCopyStatus = damageResult.nextStatus as CopyStatus;
      let allocatedReservation = null;

      if (condition === DamageCondition.NORMAL) {
        // Check if there is someone in the reservation queue for this book
        const nextReservation = await this.reservationRepo.findNextPendingForBook(loan.book_id, client);
        if (nextReservation) {
          // Allocate copy to reservation: copy status -> ON_HOLD for 48 hours
          nextCopyStatus = CopyStatus.ON_HOLD;
          allocatedReservation = await this.reservationRepo.allocateHold(
            nextReservation.id,
            copy.id,
            RULES.RESERVATION_HOLD_HOURS,
            client
          );
        } else {
          nextCopyStatus = CopyStatus.AVAILABLE;
        }
      }

      await this.copyRepo.updateStatus(copy.id, nextCopyStatus, client);

      // 5. Audit Log
      await this.auditRepo.log(
        {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          actor_id: input.actorId || loan.user_id,
          action: 'RETURN_BOOK',
          resource_type: 'LOAN',
          resource_id: loan.id,
          details: {
            loan_id: loan.id,
            copy_id: copy.id,
            return_date: returnDate.toISOString(),
            late_days: lateDays,
            late_fine: cappedFine,
            condition,
            damage_charge: damageResult.charge,
            next_copy_status: nextCopyStatus,
            allocated_reservation_id: allocatedReservation?.id || null,
          },
          ip_address: input.ipAddress,
        },
        client
      );

      await client.query('COMMIT');

      return {
        loan: updatedLoan,
        lateDays,
        lateFine: cappedFine,
        damageCondition: condition,
        damageCharge: damageResult.charge,
        copyStatus: nextCopyStatus,
        allocatedReservation,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
