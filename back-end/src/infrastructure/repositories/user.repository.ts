import { IDatabaseClient, IClientTransaction } from '../database/db.js';
import { UserRole, UserStatus } from '../../domain/constants/rules.js';

export interface UserRow {
  id: string;
  university_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

export class UserRepository {
  constructor(private db: IDatabaseClient) {}

  async findById(id: string, client?: IClientTransaction): Promise<UserRow | null> {
    const runner = client || this.db;
    const res = await runner.query<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async findByEmail(email: string, client?: IClientTransaction): Promise<UserRow | null> {
    const runner = client || this.db;
    const res = await runner.query<UserRow>(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    return res.rows[0] || null;
  }

  async findByUniversityId(universityId: string, client?: IClientTransaction): Promise<UserRow | null> {
    const runner = client || this.db;
    const res = await runner.query<UserRow>(
      'SELECT * FROM users WHERE university_id = $1',
      [universityId]
    );
    return res.rows[0] || null;
  }

  async create(user: Omit<UserRow, 'created_at' | 'updated_at'>, client?: IClientTransaction): Promise<UserRow> {
    const runner = client || this.db;
    const res = await runner.query<UserRow>(
      `INSERT INTO users (id, university_id, email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        user.id,
        user.university_id,
        user.email,
        user.password_hash,
        user.full_name,
        user.role,
        user.status || UserStatus.ACTIVE,
      ]
    );
    return res.rows[0];
  }

  async updateStatus(id: string, status: UserStatus, client?: IClientTransaction): Promise<UserRow | null> {
    const runner = client || this.db;
    const res = await runner.query<UserRow>(
      `UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return res.rows[0] || null;
  }

  async updateRole(id: string, role: UserRole, client?: IClientTransaction): Promise<UserRow | null> {
    const runner = client || this.db;
    const res = await runner.query<UserRow>(
      `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [role, id]
    );
    return res.rows[0] || null;
  }

  async list(options: { limit?: number; offset?: number; search?: string }): Promise<{ users: UserRow[]; total: number }> {
    const limit = Math.min(options.limit || 20, 100);
    const offset = options.offset || 0;

    let whereClause = '';
    const params: any[] = [];

    if (options.search) {
      params.push(`%${options.search}%`);
      whereClause = `WHERE full_name ILIKE $1 OR email ILIKE $1 OR university_id ILIKE $1`;
    }

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const queryParams = [...params, limit, offset];
    const dataRes = await this.db.query<UserRow>(
      `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      queryParams
    );

    return { users: dataRes.rows, total };
  }
}
