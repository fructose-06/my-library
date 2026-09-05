import { IDatabaseClient, IClientTransaction } from '../database/db.js';
import { CopyStatus } from '../../domain/constants/rules.js';

export interface CopyRow {
  id: string;
  barcode: string;
  book_id: string;
  acquisition_price: number;
  acquisition_date: Date;
  status: CopyStatus;
  version: number;
  created_at: Date;
  updated_at: Date;
  book_title?: string;
}

export class CopyRepository {
  constructor(private db: IDatabaseClient) {}

  async findById(id: string, client?: IClientTransaction): Promise<CopyRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `SELECT pc.*, b.title as book_title
       FROM physical_copies pc
       JOIN books b ON pc.book_id = b.id
       WHERE pc.id = $1`,
      [id]
    );

    if (!res.rows[0]) return null;
    return this.mapCopyRow(res.rows[0]);
  }

  async findByBarcode(barcode: string, client?: IClientTransaction): Promise<CopyRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `SELECT pc.*, b.title as book_title
       FROM physical_copies pc
       JOIN books b ON pc.book_id = b.id
       WHERE pc.barcode = $1`,
      [barcode]
    );

    if (!res.rows[0]) return null;
    return this.mapCopyRow(res.rows[0]);
  }

  /**
   * CRITICAL FOR CONCURRENCY:
   * Acquires row-level exclusive lock on physical copy using SELECT ... FOR UPDATE
   * Prevents race conditions and double-borrowing across parallel requests
   */
  async findByIdForUpdate(id: string, client: IClientTransaction): Promise<CopyRow | null> {
    const res = await client.query<any>(
      `SELECT pc.*, b.title as book_title
       FROM physical_copies pc
       JOIN books b ON pc.book_id = b.id
       WHERE pc.id = $1
       FOR UPDATE`,
      [id]
    );

    if (!res.rows[0]) return null;
    return this.mapCopyRow(res.rows[0]);
  }

  async findByBarcodeForUpdate(barcode: string, client: IClientTransaction): Promise<CopyRow | null> {
    const res = await client.query<any>(
      `SELECT pc.*, b.title as book_title
       FROM physical_copies pc
       JOIN books b ON pc.book_id = b.id
       WHERE pc.barcode = $1
       FOR UPDATE`,
      [barcode]
    );

    if (!res.rows[0]) return null;
    return this.mapCopyRow(res.rows[0]);
  }

  async create(
    copy: {
      id: string;
      barcode: string;
      book_id: string;
      acquisition_price: number;
      acquisition_date?: Date;
      status?: CopyStatus;
    },
    client?: IClientTransaction
  ): Promise<CopyRow> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `INSERT INTO physical_copies (id, barcode, book_id, acquisition_price, acquisition_date, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, 1)
       RETURNING *`,
      [
        copy.id,
        copy.barcode,
        copy.book_id,
        copy.acquisition_price,
        copy.acquisition_date || new Date(),
        copy.status || CopyStatus.AVAILABLE,
      ]
    );

    return this.mapCopyRow(res.rows[0]);
  }

  async claimCopyForLoan(
    id: string,
    client: IClientTransaction
  ): Promise<CopyRow | null> {
    const res = await client.query<any>(
      `UPDATE physical_copies
       SET status = 'ON_LOAN', version = version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status IN ('AVAILABLE', 'ON_HOLD')
       RETURNING *`,
      [id]
    );

    if (!res.rows[0]) return null;
    return this.mapCopyRow(res.rows[0]);
  }

  async updateStatus(
    id: string,
    status: CopyStatus,
    client?: IClientTransaction
  ): Promise<CopyRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `UPDATE physical_copies
       SET status = $1, version = version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (!res.rows[0]) return null;
    return this.mapCopyRow(res.rows[0]);
  }

  async listByBookId(bookId: string): Promise<CopyRow[]> {
    const res = await this.db.query<any>(
      `SELECT pc.*, b.title as book_title
       FROM physical_copies pc
       JOIN books b ON pc.book_id = b.id
       WHERE pc.book_id = $1
       ORDER BY pc.barcode ASC`,
      [bookId]
    );

    return res.rows.map((r: any) => this.mapCopyRow(r));
  }

  private mapCopyRow(row: any): CopyRow {
    return {
      id: row.id,
      barcode: row.barcode,
      book_id: row.book_id,
      acquisition_price: Number(row.acquisition_price),
      acquisition_date: new Date(row.acquisition_date),
      status: row.status as CopyStatus,
      version: Number(row.version),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      book_title: row.book_title,
    };
  }
}
