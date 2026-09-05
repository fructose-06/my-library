import { IDatabaseClient, IClientTransaction } from '../database/db.js';

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: Date;
  actor_name?: string;
  actor_email?: string;
}

export class AuditLogRepository {
  constructor(private db: IDatabaseClient) {}

  async log(
    entry: {
      id: string;
      actor_id?: string | null;
      action: string;
      resource_type: string;
      resource_id: string;
      details?: Record<string, unknown> | null;
      ip_address?: string | null;
    },
    client?: IClientTransaction
  ): Promise<AuditLogRow> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      `INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        entry.id,
        entry.actor_id || null,
        entry.action,
        entry.resource_type,
        entry.resource_id,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ip_address || null,
      ]
    );

    return this.mapAuditLogRow(res.rows[0]);
  }

  async list(options: {
    resourceType?: string;
    actorId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: AuditLogRow[]; total: number }> {
    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.resourceType) {
      params.push(options.resourceType);
      conditions.push(`al.resource_type = $${params.length}`);
    }

    if (options.actorId) {
      params.push(options.actorId);
      conditions.push(`al.actor_id = $${params.length}`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM audit_logs al ${whereSql}`,
      params
    );
    const total = Number(countRes.rows[0]?.count || 0);

    const queryParams = [...params, limit, offset];
    const res = await this.db.query<any>(
      `SELECT al.*, u.full_name as actor_name, u.email as actor_email
       FROM audit_logs al
       LEFT JOIN users u ON al.actor_id = u.id
       ${whereSql}
       ORDER BY al.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      queryParams
    );

    const logs = res.rows.map((r: any) => this.mapAuditLogRow(r));
    return { logs, total };
  }

  private mapAuditLogRow(row: any): AuditLogRow {
    return {
      id: row.id,
      actor_id: row.actor_id,
      action: row.action,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      ip_address: row.ip_address,
      created_at: new Date(row.created_at),
      actor_name: row.actor_name,
      actor_email: row.actor_email,
    };
  }
}
