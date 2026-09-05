import { IDatabaseClient, IClientTransaction } from '../database/db.js';
import { ChargeType, FineStatus } from '../../domain/constants/rules.js';

export interface FineChargeRow {
  id: string;
  user_id: string;
  loan_id: string | null;
  charge_type: ChargeType;
  amount: number;
  status: FineStatus;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentRow {
  id: string;
  user_id: string;
  amount_paid: number;
  received_by: string;
  notes: string | null;
  created_at: Date;
  receiver_name?: string;
}

export interface WaiverRow {
  id: string;
  user_id: string;
  amount_waived: number;
  reason: string;
  approved_by: string;
  created_at: Date;
  approver_name?: string;
}

export class FineLedgerRepository {
  constructor(private db: IDatabaseClient) {}

  async createCharge(
    charge: {
      id: string;
      user_id: string;
      loan_id?: string;
      charge_type: ChargeType;
      amount: number;
    },
    client?: IClientTransaction
  ): Promise<FineChargeRow> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `INSERT INTO fine_ledger (id, user_id, loan_id, charge_type, amount, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING *`,
      [
        charge.id,
        charge.user_id,
        charge.loan_id || null,
        charge.charge_type,
        charge.amount,
      ]
    );

    return this.mapFineChargeRow(res.rows[0]);
  }

  async recordPayment(
    payment: {
      id: string;
      user_id: string;
      amount_paid: number;
      received_by: string;
      notes?: string;
    },
    client?: IClientTransaction
  ): Promise<PaymentRow> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `INSERT INTO payments (id, user_id, amount_paid, received_by, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        payment.id,
        payment.user_id,
        payment.amount_paid,
        payment.received_by,
        payment.notes || null,
      ]
    );

    return this.mapPaymentRow(res.rows[0]);
  }

  async recordWaiver(
    waiver: {
      id: string;
      user_id: string;
      amount_waived: number;
      reason: string;
      approved_by: string;
    },
    client?: IClientTransaction
  ): Promise<WaiverRow> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `INSERT INTO waivers (id, user_id, amount_waived, reason, approved_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        waiver.id,
        waiver.user_id,
        waiver.amount_waived,
        waiver.reason,
        waiver.approved_by,
      ]
    );

    return this.mapWaiverRow(res.rows[0]);
  }

  /**
   * Outstanding Balance = Total Charges - Total Payments - Total Approved Waivers
   * Minimum is 0 (Never negative)
   */
  async getOutstandingBalance(userId: string, client?: IClientTransaction): Promise<number> {
    const runner = client || this.db;

    const chargesRes = await runner.query<{ sum: string }>(
      `SELECT COALESCE(SUM(amount), 0) as sum FROM fine_ledger WHERE user_id = $1`,
      [userId]
    );
    const totalCharges = Number(chargesRes.rows[0]?.sum || 0);

    const paymentsRes = await runner.query<{ sum: string }>(
      `SELECT COALESCE(SUM(amount_paid), 0) as sum FROM payments WHERE user_id = $1`,
      [userId]
    );
    const totalPayments = Number(paymentsRes.rows[0]?.sum || 0);

    const waiversRes = await runner.query<{ sum: string }>(
      `SELECT COALESCE(SUM(amount_waived), 0) as sum FROM waivers WHERE user_id = $1`,
      [userId]
    );
    const totalWaivers = Number(waiversRes.rows[0]?.sum || 0);

    const balance = Math.max(0, totalCharges - totalPayments - totalWaivers);
    return Number(balance.toFixed(2));
  }

  async listChargesByUser(userId: string): Promise<FineChargeRow[]> {
    const res = await this.db.query<any>(
      `SELECT * FROM fine_ledger WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows.map((r: any) => this.mapFineChargeRow(r));
  }

  async listPaymentsByUser(userId: string): Promise<PaymentRow[]> {
    const res = await this.db.query<any>(
      `SELECT p.*, u.full_name as receiver_name
       FROM payments p
       JOIN users u ON p.received_by = u.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );
    return res.rows.map((r: any) => this.mapPaymentRow(r));
  }

  async listWaiversByUser(userId: string): Promise<WaiverRow[]> {
    const res = await this.db.query<any>(
      `SELECT w.*, u.full_name as approver_name
       FROM waivers w
       JOIN users u ON w.approved_by = u.id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [userId]
    );
    return res.rows.map((r: any) => this.mapWaiverRow(r));
  }

  private mapFineChargeRow(row: any): FineChargeRow {
    return {
      id: row.id,
      user_id: row.user_id,
      loan_id: row.loan_id,
      charge_type: row.charge_type as ChargeType,
      amount: Number(row.amount),
      status: row.status as FineStatus,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private mapPaymentRow(row: any): PaymentRow {
    return {
      id: row.id,
      user_id: row.user_id,
      amount_paid: Number(row.amount_paid),
      received_by: row.received_by,
      notes: row.notes,
      created_at: new Date(row.created_at),
      receiver_name: row.receiver_name,
    };
  }

  private mapWaiverRow(row: any): WaiverRow {
    return {
      id: row.id,
      user_id: row.user_id,
      amount_waived: Number(row.amount_waived),
      reason: row.reason,
      approved_by: row.approved_by,
      created_at: new Date(row.created_at),
      approver_name: row.approver_name,
    };
  }
}
