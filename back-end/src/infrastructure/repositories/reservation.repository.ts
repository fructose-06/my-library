import { IDatabaseClient, IClientTransaction } from '../database/db.js';
import { ReservationStatus, RULES } from '../../domain/constants/rules.js';

export interface ReservationRow {
  id: string;
  user_id: string;
  book_id: string;
  allocated_copy_id: string | null;
  queue_position: number;
  status: ReservationStatus;
  hold_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  book_title?: string;
  borrower_name?: string;
  copy_barcode?: string;
}

export class ReservationRepository {
  constructor(private db: IDatabaseClient) {}

  async findById(id: string, client?: IClientTransaction): Promise<ReservationRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `SELECT r.*, b.title as book_title, u.full_name as borrower_name, pc.barcode as copy_barcode
       FROM reservations r
       JOIN books b ON r.book_id = b.id
       JOIN users u ON r.user_id = u.id
       LEFT JOIN physical_copies pc ON r.allocated_copy_id = pc.id
       WHERE r.id = $1`,
      [id]
    );

    if (!res.rows[0]) return null;
    return this.mapReservationRow(res.rows[0]);
  }

  async countActiveReservationsByUser(userId: string, client?: IClientTransaction): Promise<number> {
    const runner = client || this.db;
    const res = await runner.query<{ count: string }>(
      `SELECT COUNT(*)::int as count
       FROM reservations
       WHERE user_id = $1 AND status IN ('PENDING', 'ON_HOLD')`,
      [userId]
    );
    return Number(res.rows[0]?.count || 0);
  }

  async hasActiveReservationForBook(userId: string, bookId: string, client?: IClientTransaction): Promise<boolean> {
    const runner = client || this.db;
    const res = await runner.query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM reservations
        WHERE user_id = $1 AND book_id = $2 AND status IN ('PENDING', 'ON_HOLD')
      ) as exists`,
      [userId, bookId]
    );
    return Boolean(res.rows[0]?.exists);
  }

  async hasPendingQueueForBook(bookId: string, client?: IClientTransaction): Promise<boolean> {
    const runner = client || this.db;
    const res = await runner.query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM reservations
        WHERE book_id = $1 AND status = 'PENDING'
      ) as exists`,
      [bookId]
    );
    return Boolean(res.rows[0]?.exists);
  }

  /**
   * FIFO Queue: Find the first pending reservation for a book
   * Deterministic ordering by created_at ASC, id ASC
   */
  async findNextPendingForBook(bookId: string, client?: IClientTransaction): Promise<ReservationRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `SELECT r.*, b.title as book_title, u.full_name as borrower_name
       FROM reservations r
       JOIN books b ON r.book_id = b.id
       JOIN users u ON r.user_id = u.id
       WHERE r.book_id = $1 AND r.status = 'PENDING'
       ORDER BY r.created_at ASC, r.id ASC
       LIMIT 1`,
      [bookId]
    );

    if (!res.rows[0]) return null;
    return this.mapReservationRow(res.rows[0]);
  }

  async create(
    reservation: {
      id: string;
      user_id: string;
      book_id: string;
    },
    client?: IClientTransaction
  ): Promise<ReservationRow> {
    const runner = client || this.db;

    // Calculate queue position
    const countRes = await runner.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM reservations WHERE book_id = $1 AND status = 'PENDING'`,
      [reservation.book_id]
    );
    const position = Number(countRes.rows[0]?.count || 0) + 1;

    const res = await runner.query<any>(
      `INSERT INTO reservations (id, user_id, book_id, queue_position, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING *`,
      [reservation.id, reservation.user_id, reservation.book_id, position]
    );

    const created = await this.findById(reservation.id, client);
    return created!;
  }

  /**
   * Allocate copy to user and set 48-hour hold expiration
   */
  async allocateHold(
    reservationId: string,
    copyId: string,
    holdDurationHours: number = RULES.RESERVATION_HOLD_HOURS,
    client?: IClientTransaction
  ): Promise<ReservationRow | null> {
    const runner = client || this.db;
    const expiresAt = new Date(Date.now() + holdDurationHours * 60 * 60 * 1000);

    const res = await runner.query<any>(
      `UPDATE reservations
       SET status = 'ON_HOLD', allocated_copy_id = $1, hold_expires_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [copyId, expiresAt, reservationId]
    );

    if (!res.rows[0]) return null;
    return this.findById(reservationId, client);
  }

  async fulfill(reservationId: string, client?: IClientTransaction): Promise<ReservationRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `UPDATE reservations
       SET status = 'FULFILLED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [reservationId]
    );

    if (!res.rows[0]) return null;
    return this.findById(reservationId, client);
  }

  async cancel(reservationId: string, client?: IClientTransaction): Promise<ReservationRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `UPDATE reservations
       SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [reservationId]
    );

    if (!res.rows[0]) return null;
    return this.findById(reservationId, client);
  }

  async markExpired(reservationId: string, client?: IClientTransaction): Promise<ReservationRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `UPDATE reservations
       SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [reservationId]
    );

    if (!res.rows[0]) return null;
    return this.findById(reservationId, client);
  }

  async findExpiredHolds(asOfDate: Date = new Date(), client?: IClientTransaction): Promise<ReservationRow[]> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `SELECT r.*, b.title as book_title, u.full_name as borrower_name, pc.barcode as copy_barcode
       FROM reservations r
       JOIN books b ON r.book_id = b.id
       JOIN users u ON r.user_id = u.id
       LEFT JOIN physical_copies pc ON r.allocated_copy_id = pc.id
       WHERE r.status = 'ON_HOLD' AND r.hold_expires_at <= $1`,
      [asOfDate]
    );

    return res.rows.map((r: any) => this.mapReservationRow(r));
  }

  async listByUser(userId: string): Promise<ReservationRow[]> {
    const res = await this.db.query<any>(
      `SELECT r.*, b.title as book_title, u.full_name as borrower_name, pc.barcode as copy_barcode
       FROM reservations r
       JOIN books b ON r.book_id = b.id
       JOIN users u ON r.user_id = u.id
       LEFT JOIN physical_copies pc ON r.allocated_copy_id = pc.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    return res.rows.map((r: any) => this.mapReservationRow(r));
  }

  private mapReservationRow(row: any): ReservationRow {
    return {
      id: row.id,
      user_id: row.user_id,
      book_id: row.book_id,
      allocated_copy_id: row.allocated_copy_id,
      queue_position: Number(row.queue_position),
      status: row.status as ReservationStatus,
      hold_expires_at: row.hold_expires_at ? new Date(row.hold_expires_at) : null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      book_title: row.book_title,
      borrower_name: row.borrower_name,
      copy_barcode: row.copy_barcode,
    };
  }
}
