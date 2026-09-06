import pg from 'pg';
import type { IMemoryDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface IDatabaseClient {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
  getClient(): Promise<IClientTransaction>;
  close(): Promise<void>;
  isInMemory(): boolean;
}

export interface IClientTransaction {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
  release(): void;
}

class PostgresDatabaseClient implements IDatabaseClient {
  private pool: pg.Pool;

  constructor(connectionString?: string) {
    this.pool = new Pool({
      connectionString: connectionString || process.env.DATABASE_URL || 'postgresql://unilib:unilib_password@localhost:5432/unilib_db',
    });
  }

  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const res = await this.pool.query(text, params);
    return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
  }

  async getClient(): Promise<IClientTransaction> {
    const client = await this.pool.connect();
    return {
      query: async (text: string, params?: any[]) => {
        const res = await client.query(text, params);
        return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
      },
      release: () => client.release(),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  isInMemory(): boolean {
    return false;
  }
}

class InMemoryPostgresClient implements IDatabaseClient {
  private memDb!: IMemoryDb;
  private pgAdapter: any;
  private pool: any;

  async initSchema(schemaSqlPath?: string): Promise<void> {
    const { newDb } = await import('pg-mem');
    this.memDb = newDb();
    
    // Register custom PostgreSQL functions if needed
    this.memDb.public.registerFunction({
      name: 'current_database',
      args: [],
      returns: this.memDb.public.getType('text' as any),
      implementation: () => 'unilib_test_db',
    });

    this.memDb.public.registerFunction({
      name: 'version',
      args: [],
      returns: this.memDb.public.getType('text' as any),
      implementation: () => 'PostgreSQL 16.0 on x86_64-pc-linux-musl',
    });

    this.pgAdapter = this.memDb.adapters.createPg();
    this.pool = new this.pgAdapter.Pool();

    let migrationPath = schemaSqlPath || path.join(__dirname, 'migrations', '001_initial_schema.sql');
    if (!fs.existsSync(migrationPath)) {
      migrationPath = path.join(process.cwd(), 'src', 'infrastructure', 'database', 'migrations', '001_initial_schema.sql');
    }
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      this.memDb.public.none(sql);
    } else {
      console.warn(`Migration file not found at: ${migrationPath}`);
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const res = await this.pool.query(text, params);
    return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
  }

  async getClient(): Promise<IClientTransaction> {
    const client = await this.pool.connect();
    return {
      query: async (text: string, params?: any[]) => {
        const res = await client.query(text, params);
        return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
      },
      release: () => client.release(),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  isInMemory(): boolean {
    return true;
  }

  getRawDb(): IMemoryDb {
    return this.memDb;
  }
}

let dbInstance: IDatabaseClient | null = null;

export async function getDatabase(options?: { forceInMemory?: boolean; connectionString?: string }): Promise<IDatabaseClient> {
  if (dbInstance) {
    return dbInstance;
  }

  const useInMemory = options?.forceInMemory || process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL;

  if (useInMemory) {
    const inMem = new InMemoryPostgresClient();
    await inMem.initSchema();
    dbInstance = inMem;
    return dbInstance;
  }

  dbInstance = new PostgresDatabaseClient(options?.connectionString);
  return dbInstance;
}

export function setDatabaseInstance(db: IDatabaseClient): void {
  dbInstance = db;
}

export async function createTestDatabase(): Promise<InMemoryPostgresClient> {
  const inMem = new InMemoryPostgresClient();
  await inMem.initSchema();
  return inMem;
}
