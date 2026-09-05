import { describe, it, expect } from 'vitest';
import { createTestDatabase } from '../src/infrastructure/database/db.js';
import { UserRepository } from '../src/infrastructure/repositories/user.repository.js';
import { BookRepository } from '../src/infrastructure/repositories/book.repository.js';
import { CopyRepository } from '../src/infrastructure/repositories/copy.repository.js';
import { LoanRepository } from '../src/infrastructure/repositories/loan.repository.js';
import { ReservationRepository } from '../src/infrastructure/repositories/reservation.repository.js';
import { FineLedgerRepository } from '../src/infrastructure/repositories/fine-ledger.repository.js';
import { AuditLogRepository } from '../src/infrastructure/repositories/audit-log.repository.js';
import { BorrowBookUseCase } from '../src/application/use-cases/borrow-book.use-case.js';
import { UserRole, UserStatus } from '../src/domain/constants/rules.js';

describe('UniLib Core — Bonus Challenge: Concurrency Load Test', () => {
  it('handles 100 concurrent borrow requests on a single copy with exactly 1 success', async () => {
    const db = await createTestDatabase();
    const userRepo = new UserRepository(db);
    const bookRepo = new BookRepository(db);
    const copyRepo = new CopyRepository(db);
    const loanRepo = new LoanRepository(db);
    const reservationRepo = new ReservationRepository(db);
    const fineRepo = new FineLedgerRepository(db);
    const auditRepo = new AuditLogRepository(db);

    const borrowUseCase = new BorrowBookUseCase(
      db,
      userRepo,
      bookRepo,
      copyRepo,
      loanRepo,
      reservationRepo,
      fineRepo,
      auditRepo
    );

    // Create 1 target book and 1 physical copy
    const book = await bookRepo.create({
      id: 'book-concurrency',
      isbn: '9789999999999',
      title: 'High Concurrency In Production',
    });

    const copy = await copyRepo.create({
      id: 'copy-concurrency-target',
      barcode: 'CC-CONCUR-001',
      book_id: book.id,
      acquisition_price: 1500,
    });

    // Create 100 distinct student accounts
    const studentIds: string[] = [];
    for (let i = 1; i <= 100; i++) {
      const id = `student-cc-${i}`;
      await userRepo.create({
        id,
        university_id: `CC-STU-${i.toString().padStart(4, '0')}`,
        email: `student_cc_${i}@unilib.ac.th`,
        password_hash: 'hashedpassword',
        full_name: `Concurrent Student ${i}`,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      });
      studentIds.push(id);
    }

    // Launch 100 parallel borrow requests at the exact same moment
    const borrowPromises = studentIds.map((userId) =>
      borrowUseCase.execute({
        borrowerId: userId,
        barcode: copy.barcode,
      })
    );

    const results = await Promise.allSettled(borrowPromises);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly 1 must succeed, 99 must fail!
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(99);

    // Verify database state: Exactly 1 Active Loan exists for this copy
    const activeLoansRes = await db.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM loans WHERE copy_id = $1 AND status = 'ACTIVE'`,
      [copy.id]
    );
    expect(Number(activeLoansRes.rows[0].count)).toBe(1);

    // Verify copy status is ON_LOAN
    const updatedCopy = await copyRepo.findById(copy.id);
    expect(updatedCopy?.status).toBe('ON_LOAN');
  });
});
