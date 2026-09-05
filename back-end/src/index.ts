import dotenv from 'dotenv';
dotenv.config();

import { getDatabase } from './infrastructure/database/db.js';
import { buildApp } from './infrastructure/http/server.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function bootstrap() {
  try {
    const db = await getDatabase();
    console.log(`Database connected (${db.isInMemory() ? 'In-Memory PostgreSQL Engine' : 'PostgreSQL Server'})`);

    const userCount = await db.query<{ count: string }>('SELECT COUNT(*)::int as count FROM users');
    if (Number(userCount.rows[0]?.count || 0) === 0) {
      console.log('Database empty, initializing seed data...');
      const { runSeed } = await import('./infrastructure/database/seeds/seed.js');
      await runSeed(db);
    }

    const app = await buildApp({ db });

    await app.listen({ port: PORT, host: HOST });
    console.log(`UniLib Core Server running on http://${HOST}:${PORT}`);
    console.log(`Swagger OpenAPI Documentation: http://${HOST}:${PORT}/docs`);
  } catch (err) {
    console.error('Failed to start UniLib Core server:', err);
    process.exit(1);
  }
}

bootstrap();
