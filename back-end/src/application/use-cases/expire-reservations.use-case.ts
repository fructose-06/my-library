import { IDatabaseClient } from '../../infrastructure/database/db.js';
import { ReservationRepository } from '../../infrastructure/repositories/reservation.repository.js';
import { CopyRepository } from '../../infrastructure/repositories/copy.repository.js';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log.repository.js';
import { CopyStatus, RULES } from '../../domain/constants/rules.js';

export class ExpireReservationsUseCase {
  constructor(
    private db: IDatabaseClient,
    private reservationRepo: ReservationRepository,
    private copyRepo: CopyRepository,
    private auditRepo: AuditLogRepository
  ) {}

  async execute(asOfDate: Date = new Date()) {
    const expiredList = await this.reservationRepo.findExpiredHolds(asOfDate);
    const processed: any[] = [];

    for (const resItem of expiredList) {
      const client = await this.db.getClient();
      try {
        await client.query('BEGIN');

        // Mark current reservation expired
        await this.reservationRepo.markExpired(resItem.id, client);

        let nextReservation = null;
        let copyStatus = CopyStatus.AVAILABLE;

        if (resItem.allocated_copy_id) {
          const copy = await this.copyRepo.findByIdForUpdate(resItem.allocated_copy_id, client);
          if (copy) {
            // Check if another user is waiting in the queue for this book
            const nextInQueue = await this.reservationRepo.findNextPendingForBook(resItem.book_id, client);
            if (nextInQueue) {
              nextReservation = await this.reservationRepo.allocateHold(
                nextInQueue.id,
                copy.id,
                RULES.RESERVATION_HOLD_HOURS,
                client
              );
              copyStatus = CopyStatus.ON_HOLD;
            } else {
              await this.copyRepo.updateStatus(copy.id, CopyStatus.AVAILABLE, client);
              copyStatus = CopyStatus.AVAILABLE;
            }
          }
        }

        await this.auditRepo.log(
          {
            id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            actor_id: null,
            action: 'EXPIRE_RESERVATION',
            resource_type: 'RESERVATION',
            resource_id: resItem.id,
            details: {
              expired_reservation_id: resItem.id,
              user_id: resItem.user_id,
              book_id: resItem.book_id,
              copy_id: resItem.allocated_copy_id,
              reallocated_to_reservation_id: nextReservation?.id || null,
              copy_status: copyStatus,
            },
          },
          client
        );

        await client.query('COMMIT');
        processed.push({
          expiredReservationId: resItem.id,
          reallocatedTo: nextReservation?.id || null,
        });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error processing expired reservation ${resItem.id}:`, err);
      } finally {
        client.release();
      }
    }

    return processed;
  }
}
