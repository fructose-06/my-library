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

  it('POST /api/circulation/borrow rejects Admin trying to borrow on behalf of user with 403 Forbidden', async () => {
    const res = await request(app.server)
      .post('/api/circulation/borrow')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ barcode: 'CA-000002', borrower_id: 'usr-stu-01' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/circulation/return rejects Admin with 403 Forbidden', async () => {
    const res = await request(app.server)
      .post('/api/circulation/return')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ loan_id: 'loan-sample-01' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/circulation/borrow rejects Admin trying to borrow directly for themselves with 403 Forbidden', async () => {
    const res = await request(app.server)
      .post('/api/circulation/borrow')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ barcode: 'CA-000003' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Administrators are not permitted to borrow books');
  });

  it('POST /api/reservations rejects Admin trying to reserve books with 403 Forbidden', async () => {
    const res = await request(app.server)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ book_id: 'book-clean-arch' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Only students and lecturers are permitted to reserve books');
  });

  it('POST /api/circulation/borrow rejects Librarian trying to borrow for themselves without borrower_id with 403 Forbidden', async () => {
    const res = await request(app.server)
      .post('/api/circulation/borrow')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ barcode: 'CA-000003' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Librarians cannot borrow books for themselves');
  });

  it('POST /api/reservations rejects Librarian trying to reserve books with 403 Forbidden', async () => {
    const res = await request(app.server)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ book_id: 'book-clean-arch' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Only students and lecturers are permitted to reserve books');
  });

  it('POST /api/circulation/borrow allows Librarian to borrow on behalf of a student', async () => {
    const res = await request(app.server)
      .post('/api/circulation/borrow')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ barcode: 'CA-000002', borrower_id: 'usr-stu-02' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user_id).toBe('usr-stu-02');
  });
});
