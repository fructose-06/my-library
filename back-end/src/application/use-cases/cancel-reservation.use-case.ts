import { IDatabaseClient } from '../../infrastructure/database/db.js';
import { ReservationRepository } from '../../infrastructure/repositories/reservation.repository.js';
import { CopyRepository } from '../../infrastructure/repositories/copy.repository.js';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log.repository.js';
import { CopyStatus, ReservationStatus, RULES } from '../../domain/constants/rules.js';
import { DomainError } from '../../domain/errors/domain-error.js';

export interface CancelReservationInput {
  reservationId: string;
  actorId?: string;
  ipAddress?: string;
}

export class CancelReservationUseCase {
  constructor(
    private db: IDatabaseClient,
    private reservationRepo: ReservationRepository,
    private copyRepo: CopyRepository,
    private auditRepo: AuditLogRepository
  ) {}

  async execute(input: CancelReservationInput) {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      const reservation = await this.reservationRepo.findById(input.reservationId, client);
      if (!reservation) {
        throw new DomainError('RESERVATION_NOT_FOUND', `Reservation '${input.reservationId}' was not found`, 404);
      }
      if (reservation.status === ReservationStatus.FULFILLED || reservation.status === ReservationStatus.CANCELLED) {
        throw new DomainError('INVALID_STATE_TRANSITION', `Cannot cancel reservation in status '${reservation.status}'`, 400);
      }

      // If reservation was holding a copy
      if (reservation.status === ReservationStatus.ON_HOLD && reservation.allocated_copy_id) {
        const copy = await this.copyRepo.findByIdForUpdate(reservation.allocated_copy_id, client);
        if (copy) {
          // Check for next person in queue
          const nextReservation = await this.reservationRepo.findNextPendingForBook(reservation.book_id, client);
          if (nextReservation) {
            await this.reservationRepo.allocateHold(
              nextReservation.id,
              copy.id,
              RULES.RESERVATION_HOLD_HOURS,
              client
            );
          } else {
            await this.copyRepo.updateStatus(copy.id, CopyStatus.AVAILABLE, client);
          }
        }
      }

      const updated = await this.reservationRepo.cancel(reservation.id, client);

      await this.auditRepo.log(
        {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          actor_id: input.actorId || reservation.user_id,
          action: 'CANCEL_RESERVATION',
          resource_type: 'RESERVATION',
          resource_id: reservation.id,
          details: {
            reservation_id: reservation.id,
            previous_status: reservation.status,
          },
          ip_address: input.ipAddress,
        },
        client
      );

      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
