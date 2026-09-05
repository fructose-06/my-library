import fs from 'fs';
import path from 'path';
import { createTestDatabase } from '../database/db.js';
import { buildApp } from './server.js';

async function generateOpenApi() {
  const db = await createTestDatabase();
  const app = await buildApp({ db });
  await app.ready();

  const swaggerObject = app.swagger();
  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const outputPath = path.join(docsDir, 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(swaggerObject, null, 2), 'utf8');
  console.log(`OpenAPI documentation generated at: ${outputPath}`);
  await app.close();
}

generateOpenApi().catch(console.error);
