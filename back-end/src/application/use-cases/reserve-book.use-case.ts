import { IDatabaseClient } from '../../infrastructure/database/db.js';
import { UserRepository } from '../../infrastructure/repositories/user.repository.js';
import { BookRepository } from '../../infrastructure/repositories/book.repository.js';
import { LoanRepository } from '../../infrastructure/repositories/loan.repository.js';
import { ReservationRepository } from '../../infrastructure/repositories/reservation.repository.js';
import { FineLedgerRepository } from '../../infrastructure/repositories/fine-ledger.repository.js';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log.repository.js';
import { DomainErrors } from '../../domain/errors/domain-error.js';
import { RULES, UserStatus, UserRole } from '../../domain/constants/rules.js';

export interface ReserveBookInput {
  userId: string;
  bookId: string;
  actorId?: string;
  ipAddress?: string;
}

export class ReserveBookUseCase {
  constructor(
    private db: IDatabaseClient,
    private userRepo: UserRepository,
    private bookRepo: BookRepository,
    private loanRepo: LoanRepository,
    private reservationRepo: ReservationRepository,
    private fineRepo: FineLedgerRepository,
    private auditRepo: AuditLogRepository
  ) {}

  async execute(input: ReserveBookInput) {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      const user = await this.userRepo.findById(input.userId, client);
      if (!user) {
        throw DomainErrors.USER_NOT_FOUND(input.userId);
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw DomainErrors.USER_DISABLED();
      }
      // Only STUDENT and LECTURER are permitted to reserve books (Section 5 & 45)
      if (user.role !== UserRole.STUDENT && user.role !== UserRole.LECTURER) {
        throw DomainErrors.FORBIDDEN('Only students and lecturers are permitted to reserve books');
      }

      const book = await this.bookRepo.findById(input.bookId, client);
      if (!book) {
        throw DomainErrors.BOOK_NOT_FOUND(input.bookId);
      }

      // 1. Max active reservations limit (capped at 3)
      const activeCount = await this.reservationRepo.countActiveReservationsByUser(user.id, client);
      if (activeCount >= RULES.MAX_ACTIVE_RESERVATIONS) {
        throw DomainErrors.RESERVATION_LIMIT_EXCEEDED(activeCount, RULES.MAX_ACTIVE_RESERVATIONS);
      }

      // 2. Outstanding balance >= 500 THB blocks reservations
      const balance = await this.fineRepo.getOutstandingBalance(user.id, client);
      if (balance >= RULES.FINE_BLOCK_THRESHOLD) {
        throw DomainErrors.FINE_LIMIT_EXCEEDED(balance, RULES.FINE_BLOCK_THRESHOLD);
      }

      // 3. User cannot reserve a book they are already actively borrowing
      const isBorrowing = await this.loanRepo.hasActiveLoanForBook(user.id, book.id, client);
      if (isBorrowing) {
        throw DomainErrors.RESERVATION_BORROWING_OWN();
      }

      // 4. User cannot create duplicate reservation for the same book
      const alreadyReserved = await this.reservationRepo.hasActiveReservationForBook(user.id, book.id, client);
      if (alreadyReserved) {
        throw DomainErrors.RESERVATION_ALREADY_EXISTS();
      }

      // 5. If any copy of the book is AVAILABLE, reject reservation (user can borrow directly)
      const availRes = await client.query<{ count: string }>(
        `SELECT COUNT(*)::int as count FROM physical_copies WHERE book_id = $1 AND status = 'AVAILABLE'`,
        [book.id]
      );
      if (Number(availRes.rows[0]?.count || 0) > 0) {
        throw DomainErrors.BOOK_CURRENTLY_AVAILABLE();
      }

      // 6. Create reservation in FIFO queue
      const reservationId = `res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const reservation = await this.reservationRepo.create(
        {
          id: reservationId,
          user_id: user.id,
          book_id: book.id,
        },
        client
      );

      // 7. Audit log
      await this.auditRepo.log(
        {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          actor_id: input.actorId || user.id,
          action: 'CREATE_RESERVATION',
          resource_type: 'RESERVATION',
          resource_id: reservation.id,
          details: {
            user_id: user.id,
            book_id: book.id,
            queue_position: reservation.queue_position,
          },
          ip_address: input.ipAddress,
        },
        client
      );

      await client.query('COMMIT');
      return reservation;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
