import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDatabase } from '../src/infrastructure/database/db.js';
import { runSeed } from '../src/infrastructure/database/seeds/seed.js';
import { buildApp } from '../src/infrastructure/http/server.js';
import { FastifyInstance } from 'fastify';

describe('UniLib Core — API Integration & E2E Tests', () => {
  let app: FastifyInstance;
  let db: any;
  let studentToken: string;
  let librarianToken: string;
  let adminToken: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    await runSeed(db);

    app = await buildApp({ db, jwtSecret: 'test-secret-key-123' });
    await app.ready();

    // Authenticate student
    const stuLogin = await request(app.server)
      .post('/api/auth/login')
      .send({ identifier: 'student1@unilib.ac.th', password: 'password123' });
    studentToken = stuLogin.body.data.token;

    // Authenticate librarian
    const libLogin = await request(app.server)
      .post('/api/auth/login')
      .send({ identifier: 'librarian@unilib.ac.th', password: 'password123' });
    librarianToken = libLogin.body.data.token;

    // Authenticate admin
    const admLogin = await request(app.server)
      .post('/api/auth/login')
      .send({ identifier: 'admin@unilib.ac.th', password: 'password123' });
    adminToken = admLogin.body.data.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 OK', async () => {
    const res = await request(app.server).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/auth/me returns current user profile and account standing', async () => {
    const res = await request(app.server)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('student1@unilib.ac.th');
    expect(res.body.data.standing.can_borrow).toBe(true);
  });

  it('GET /api/books returns paginated catalog list', async () => {
    const res = await request(app.server).get('/api/books?limit=10&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
  });

  it('GET /api/books/:id returns book details with copies inventory', async () => {
    const res = await request(app.server).get('/api/books/book-clean-arch');
    expect(res.status).toBe(200);
    expect(res.body.data.title).toContain('Clean Architecture');
    expect(res.body.data.copies.length).toBe(5);
  });

  it('POST /api/circulation/borrow allows student to borrow an available copy', async () => {
    const res = await request(app.server)
      .post('/api/circulation/borrow')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ barcode: 'CA-000001' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.copy_id).toBe('copy-ca-01');
  });

  it('POST /api/fines/waive rejects non-admin with 403 Forbidden', async () => {
    const res = await request(app.server)
      .post('/api/fines/waive')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ user_id: 'usr-stu-01', amount: 100, reason: 'Librarian trying to waive' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/reports/inventory returns counts by status for librarians', async () => {
    const res = await request(app.server)
      .get('/api/reports/inventory')
      .set('Authorization', `Bearer ${librarianToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
