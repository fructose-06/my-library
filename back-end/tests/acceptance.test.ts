import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../src/infrastructure/database/db.js';
import { runSeed } from '../src/infrastructure/database/seeds/seed.js';
import { UserRepository } from '../src/infrastructure/repositories/user.repository.js';
import { BookRepository } from '../src/infrastructure/repositories/book.repository.js';
import { CopyRepository } from '../src/infrastructure/repositories/copy.repository.js';
import { LoanRepository } from '../src/infrastructure/repositories/loan.repository.js';
import { ReservationRepository } from '../src/infrastructure/repositories/reservation.repository.js';
import { FineLedgerRepository } from '../src/infrastructure/repositories/fine-ledger.repository.js';
import { AuditLogRepository } from '../src/infrastructure/repositories/audit-log.repository.js';

import { BorrowBookUseCase } from '../src/application/use-cases/borrow-book.use-case.js';
import { ReturnBookUseCase } from '../src/application/use-cases/return-book.use-case.js';
import { RenewBookUseCase } from '../src/application/use-cases/renew-book.use-case.js';
import { ReserveBookUseCase } from '../src/application/use-cases/reserve-book.use-case.js';
import { ConfirmLostUseCase } from '../src/application/use-cases/confirm-lost.use-case.js';
import { PayFineUseCase } from '../src/application/use-cases/pay-fine.use-case.js';
import { WaiveFineUseCase } from '../src/application/use-cases/waive-fine.use-case.js';
import { ExpireReservationsUseCase } from '../src/application/use-cases/expire-reservations.use-case.js';

import { CopyStatus, DamageCondition, UserRole, UserStatus, ChargeType } from '../src/domain/constants/rules.js';

describe('UniLib Core — 20 Mandatory Acceptance Scenarios', () => {
  let db: any;
  let userRepo: UserRepository;
  let bookRepo: BookRepository;
  let copyRepo: CopyRepository;
  let loanRepo: LoanRepository;
  let reservationRepo: ReservationRepository;
  let fineRepo: FineLedgerRepository;
  let auditRepo: AuditLogRepository;

  let borrowUseCase: BorrowBookUseCase;
  let returnUseCase: ReturnBookUseCase;
  let renewUseCase: RenewBookUseCase;
  let reserveUseCase: ReserveBookUseCase;
  let confirmLostUseCase: ConfirmLostUseCase;
  let payFineUseCase: PayFineUseCase;
  let waiveFineUseCase: WaiveFineUseCase;
  let expireReservationsUseCase: ExpireReservationsUseCase;

  beforeEach(async () => {
    db = await createTestDatabase();
    await runSeed(db);

    userRepo = new UserRepository(db);
    bookRepo = new BookRepository(db);
    copyRepo = new CopyRepository(db);
    loanRepo = new LoanRepository(db);
    reservationRepo = new ReservationRepository(db);
    fineRepo = new FineLedgerRepository(db);
    auditRepo = new AuditLogRepository(db);

    borrowUseCase = new BorrowBookUseCase(
      db,
      userRepo,
      bookRepo,
      copyRepo,
      loanRepo,
      reservationRepo,
      fineRepo,
      auditRepo
    );
    returnUseCase = new ReturnBookUseCase(
      db,
      loanRepo,
      copyRepo,
      reservationRepo,
      fineRepo,
      auditRepo
    );
    renewUseCase = new RenewBookUseCase(
      db,
      loanRepo,
      userRepo,
      reservationRepo,
      fineRepo,
      auditRepo
    );
    reserveUseCase = new ReserveBookUseCase(
      db,
      userRepo,
      bookRepo,
      loanRepo,
      reservationRepo,
      fineRepo,
      auditRepo
    );
    confirmLostUseCase = new ConfirmLostUseCase(
      db,
      loanRepo,
      copyRepo,
      fineRepo,
      auditRepo
    );
    payFineUseCase = new PayFineUseCase(db, fineRepo, userRepo, auditRepo);
    waiveFineUseCase = new WaiveFineUseCase(db, fineRepo, userRepo, auditRepo);
    expireReservationsUseCase = new ExpireReservationsUseCase(
      db,
      reservationRepo,
      copyRepo,
      auditRepo
    );
  });

  // Helper to create extra book & copy
  async function createExtraBookAndCopy(code: string, price: number = 500) {
    const book = await bookRepo.create({
      id: `book-${code}`,
      isbn: `978000000${code.padStart(4, '0')}`,
      title: `Test Book ${code}`,
    });
    const copy = await copyRepo.create({
      id: `copy-${code}`,
      barcode: `BC-${code}`,
      book_id: book.id,
      acquisition_price: price,
    });
    return { book, copy };
  }

  // -------------------------------------------------------------
  // Scenario 1: Student has 4 active loans, borrows 1 -> SUCCESS (active = 5)
  // -------------------------------------------------------------
  it('Scenario 1: Student with active loans = 4 borrows 1 -> SUCCESS (active = 5)', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;

    // Create 4 initial loans for 4 different books
    for (let i = 1; i <= 4; i++) {
      const { copy } = await createExtraBookAndCopy(`S1-${i}`);
      await borrowUseCase.execute({ borrowerId: student.id, barcode: copy.barcode });
    }
    expect(await loanRepo.countActiveLoansByUser(student.id)).toBe(4);

    // Borrow 5th book
    const { copy: copy5 } = await createExtraBookAndCopy('S1-5');
    const loan5 = await borrowUseCase.execute({ borrowerId: student.id, barcode: copy5.barcode });

    expect(loan5).toBeDefined();
    expect(await loanRepo.countActiveLoansByUser(student.id)).toBe(5);
  });

  // -------------------------------------------------------------
  // Scenario 2: Student has 5 active loans, borrows 6th -> REJECT
  // -------------------------------------------------------------
  it('Scenario 2: Student with active loans = 5 borrows 6th -> REJECT (Loan limit exceeded)', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;

    // Borrow 5 books
    for (let i = 1; i <= 5; i++) {
      const { copy } = await createExtraBookAndCopy(`S2-${i}`);
      await borrowUseCase.execute({ borrowerId: student.id, barcode: copy.barcode });
    }
    expect(await loanRepo.countActiveLoansByUser(student.id)).toBe(5);

    // Attempt to borrow 6th book
    const { copy: copy6 } = await createExtraBookAndCopy('S2-6');
    await expect(
      borrowUseCase.execute({ borrowerId: student.id, barcode: copy6.barcode })
    ).rejects.toThrowError(/already has 5 active loans/);
  });

  // -------------------------------------------------------------
  // Scenario 3: Lecturer has 5 active loans, borrows 6th -> REJECT
  // -------------------------------------------------------------
  it('Scenario 3: Lecturer with active loans = 5 borrows 6th -> REJECT (Equal privilege rule)', async () => {
    const lecturer = (await userRepo.findByUniversityId('LEC-0001'))!;

    for (let i = 1; i <= 5; i++) {
      const { copy } = await createExtraBookAndCopy(`S3-${i}`);
      await borrowUseCase.execute({ borrowerId: lecturer.id, barcode: copy.barcode });
    }
    expect(await loanRepo.countActiveLoansByUser(lecturer.id)).toBe(5);

    const { copy: copy6 } = await createExtraBookAndCopy('S3-6');
    await expect(
      borrowUseCase.execute({ borrowerId: lecturer.id, barcode: copy6.barcode })
    ).rejects.toThrowError(/already has 5 active loans/);
  });

  // -------------------------------------------------------------
  // Scenario 4: Student and Lecturer have equal circulation limits (5 copies, 14 days)
  // -------------------------------------------------------------
  it('Scenario 4: Student and Lecturer both receive 14 days duration and max 5 copies', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;
    const lecturer = (await userRepo.findByUniversityId('LEC-0001'))!;

    const { copy: copyStu } = await createExtraBookAndCopy('S4-STU');
    const { copy: copyLec } = await createExtraBookAndCopy('S4-LEC');

    const loanStu = await borrowUseCase.execute({ borrowerId: student.id, barcode: copyStu.barcode });
    const loanLec = await borrowUseCase.execute({ borrowerId: lecturer.id, barcode: copyLec.barcode });

    const stuDiff = Math.round((loanStu.due_date.getTime() - loanStu.borrow_date.getTime()) / (1000 * 60 * 60 * 24));
    const lecDiff = Math.round((loanLec.due_date.getTime() - loanLec.borrow_date.getTime()) / (1000 * 60 * 60 * 24));

    expect(stuDiff).toBe(14);
    expect(lecDiff).toBe(14);
  });

  // -------------------------------------------------------------
  // Scenario 5: Return on Due Date -> Fine = 0 THB
  // -------------------------------------------------------------
  it('Scenario 5: Return on Due Date -> Expected Fine = 0 THB', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;
    const { copy } = await createExtraBookAndCopy('S5');

    const loan = await borrowUseCase.execute({ borrowerId: student.id, barcode: copy.barcode });
    const result = await returnUseCase.execute({
      loanId: loan.id,
      returnDate: loan.due_date,
    });

    expect(result.lateFine).toBe(0);
    expect(result.lateDays).toBe(0);
  });

  // -------------------------------------------------------------
  // Scenario 6: Return 1 day after Due Date -> Fine = 10 THB
  // -------------------------------------------------------------
  it('Scenario 6: Return 1 day after Due Date -> Expected Fine = 10 THB', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;
    const { copy } = await createExtraBookAndCopy('S6');

    const loan = await borrowUseCase.execute({ borrowerId: student.id, barcode: copy.barcode });
    const returnDate = new Date(loan.due_date.getTime() + 24 * 60 * 60 * 1000);

    const result = await returnUseCase.execute({
      loanId: loan.id,
      returnDate,
    });

    expect(result.lateDays).toBe(1);
    expect(result.lateFine).toBe(10);
  });

  // -------------------------------------------------------------
  // Scenario 7: Calculated fine = 1,250 THB -> Fine capped at 1,000 THB
  // -------------------------------------------------------------
  it('Scenario 7: Calculated late fine 1,250 THB is capped at 1,000 THB', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;
    const { copy } = await createExtraBookAndCopy('S7');

    const loan = await borrowUseCase.execute({ borrowerId: student.id, barcode: copy.barcode });
    // 125 days late
    const returnDate = new Date(loan.due_date.getTime() + 125 * 24 * 60 * 60 * 1000);

    const result = await returnUseCase.execute({
      loanId: loan.id,
      returnDate,
    });

    expect(result.lateDays).toBe(125);
    expect(result.lateFine).toBe(1000); // capped
  });

  // -------------------------------------------------------------
  // Scenario 8: User has active overdue loan -> Borrow rejected
  // -------------------------------------------------------------
  it('Scenario 8: User has active overdue loan -> Borrow rejected', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;
    const { copy: copy1 } = await createExtraBookAndCopy('S8-1');

    // Create an overdue loan (due yesterday)
    const pastDueDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await loanRepo.create({
      id: 'loan-overdue-s8',
      user_id: student.id,
      copy_id: copy1.id,
      book_id: copy1.book_id,
      borrow_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      due_date: pastDueDate,
    });
    await copyRepo.updateStatus(copy1.id, CopyStatus.ON_LOAN);

    // Attempt to borrow new book
    const { copy: copy2 } = await createExtraBookAndCopy('S8-2');
    await expect(
      borrowUseCase.execute({ borrowerId: student.id, barcode: copy2.barcode })
    ).rejects.toThrowError(/overdue loans and cannot borrow/);
  });

  // -------------------------------------------------------------
  // Scenario 9: Outstanding balance = 490 THB -> Borrow SUCCESS
  // -------------------------------------------------------------
  it('Scenario 9: Outstanding balance = 490 THB -> Borrow SUCCESS', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;
    await fineRepo.createCharge({
      id: 'charge-490',
      user_id: student.id,
      charge_type: ChargeType.LATE_FINE,
      amount: 490,
    });

    const { copy } = await createExtraBookAndCopy('S9');
    const loan = await borrowUseCase.execute({ borrowerId: student.id, barcode: copy.barcode });

    expect(loan).toBeDefined();
  });

  // -------------------------------------------------------------
  // Scenario 10: Outstanding balance = 500 THB -> Borrow REJECT
  // -------------------------------------------------------------
  it('Scenario 10: Outstanding balance = 500 THB -> Borrow REJECT', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;
    await fineRepo.createCharge({
      id: 'charge-500',
      user_id: student.id,
      charge_type: ChargeType.LATE_FINE,
      amount: 500,
    });

    const { copy } = await createExtraBookAndCopy('S10');
    await expect(
      borrowUseCase.execute({ borrowerId: student.id, barcode: copy.barcode })
    ).rejects.toThrowError(/Outstanding fine balance of 500 THB exceeds/);
  });

  // -------------------------------------------------------------
  // Scenario 11: Outstanding 500 THB, pay 20 THB (new balance 480 THB) -> Borrow SUCCESS
  // -------------------------------------------------------------
  it('Scenario 11: Outstanding 500 THB, pay 20 THB -> Borrow SUCCESS', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;
    const librarian = (await userRepo.findByUniversityId('LIB-0001'))!;

    await fineRepo.createCharge({
      id: 'charge-s11',
      user_id: student.id,
      charge_type: ChargeType.LATE_FINE,
      amount: 500,
    });

    // Pay 20 THB
    const payRes = await payFineUseCase.execute({
      userId: student.id,
      amount: 20,
      librarianId: librarian.id,
    });
    expect(payRes.newOutstanding).toBe(480);

    const { copy } = await createExtraBookAndCopy('S11');
    const loan = await borrowUseCase.execute({ borrowerId: student.id, barcode: copy.barcode });
    expect(loan).toBeDefined();
  });

  // -------------------------------------------------------------
  // Scenario 12: Renew: 1st (+7 days) -> 2nd (+7 days) -> 3rd REJECT
  // -------------------------------------------------------------
  it('Scenario 12: Loan renewal: 1st time (+7 days) -> 2nd time (+7 days) -> 3rd time REJECT', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;
    const { copy } = await createExtraBookAndCopy('S12');

    const loan = await borrowUseCase.execute({ borrowerId: student.id, barcode: copy.barcode });
    const initialDueDate = loan.due_date;

    // Renew 1
    const renew1 = await renewUseCase.execute({ loanId: loan.id });
    expect(renew1.renewal_count).toBe(1);
    expect(renew1.due_date.getTime()).toBe(initialDueDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Renew 2
    const renew2 = await renewUseCase.execute({ loanId: loan.id });
    expect(renew2.renewal_count).toBe(2);
    expect(renew2.due_date.getTime()).toBe(initialDueDate.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Renew 3 -> REJECT
    await expect(renewUseCase.execute({ loanId: loan.id })).rejects.toThrowError(/reached the maximum of 2 renewals/);
  });

  // -------------------------------------------------------------
  // Scenario 13: Book has pending reservation queue -> Renew REJECT
  // -------------------------------------------------------------
  it('Scenario 13: Book has pending reservation queue -> Renew REJECT', async () => {
    const student1 = (await userRepo.findByUniversityId('65010001'))!;
    const student2 = (await userRepo.findByUniversityId('65010002'))!;
    const { book, copy } = await createExtraBookAndCopy('S13');

    const loan = await borrowUseCase.execute({ borrowerId: student1.id, barcode: copy.barcode });

    // student2 reserves the book (copy is currently ON_LOAN, none available)
    await reserveUseCase.execute({ userId: student2.id, bookId: book.id });

    // student1 attempts to renew
    await expect(renewUseCase.execute({ loanId: loan.id })).rejects.toThrowError(
      /Cannot renew because there are active reservations queued/
    );
  });

  // -------------------------------------------------------------
  // Scenario 14: Book has 1 copy, 2 users borrow concurrently -> 1 SUCCESS, 1 REJECT
  // -------------------------------------------------------------
  it('Scenario 14: Concurrent borrow on 1 copy -> exactly 1 success, 1 failure', async () => {
    const student1 = (await userRepo.findByUniversityId('65010001'))!;
    const student2 = (await userRepo.findByUniversityId('65010002'))!;
    const { copy } = await createExtraBookAndCopy('S14');

    // Run parallel borrow attempts
    const results = await Promise.allSettled([
      borrowUseCase.execute({ borrowerId: student1.id, barcode: copy.barcode }),
      borrowUseCase.execute({ borrowerId: student2.id, barcode: copy.barcode }),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    const loansCount = await db.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM loans WHERE copy_id = $1 AND status = 'ACTIVE'`,
      [copy.id]
    );
    expect(Number(loansCount.rows[0].count)).toBe(1);
  });

  // -------------------------------------------------------------
  // Scenario 15: Book has no available copy, A reserves before B -> FIFO queue
  // When copy returned, it is ON_HOLD for A
  // -------------------------------------------------------------
  it('Scenario 15: FIFO reservation queue: A reserves before B -> copy held for A when returned', async () => {
    const studentA = (await userRepo.findByUniversityId('65010001'))!;
    const studentB = (await userRepo.findByUniversityId('65010002'))!;
    const lecturer = (await userRepo.findByUniversityId('LEC-0001'))!;
    const { book, copy } = await createExtraBookAndCopy('S15');

    // Lecturer borrows the only copy
    const loan = await borrowUseCase.execute({ borrowerId: lecturer.id, barcode: copy.barcode });

    // A reserves, then B reserves
    const resA = await reserveUseCase.execute({ userId: studentA.id, bookId: book.id });
    const resB = await reserveUseCase.execute({ userId: studentB.id, bookId: book.id });

    expect(resA.queue_position).toBe(1);
    expect(resB.queue_position).toBe(2);

    // Lecturer returns copy
    const returnResult = await returnUseCase.execute({ loanId: loan.id });

    expect(returnResult.copyStatus).toBe(CopyStatus.ON_HOLD);
    expect(returnResult.allocatedReservation.id).toBe(resA.id);
    expect(returnResult.allocatedReservation.user_id).toBe(studentA.id);
  });

  // -------------------------------------------------------------
  // Scenario 16: A does not pick up copy within 48h -> A expired, copy allocated to B
  // -------------------------------------------------------------
  it('Scenario 16: A fails to pick up copy in 48h -> Expired and allocated to B (ON_HOLD)', async () => {
    const studentA = (await userRepo.findByUniversityId('65010001'))!;
    const studentB = (await userRepo.findByUniversityId('65010002'))!;
    const lecturer = (await userRepo.findByUniversityId('LEC-0001'))!;
    const { book, copy } = await createExtraBookAndCopy('S16');

    const loan = await borrowUseCase.execute({ borrowerId: lecturer.id, barcode: copy.barcode });
    await reserveUseCase.execute({ userId: studentA.id, bookId: book.id });
    const resB = await reserveUseCase.execute({ userId: studentB.id, bookId: book.id });

    // Return book -> holds for A
    await returnUseCase.execute({ loanId: loan.id });

    // Simulate 49 hours passing
    const futureDate = new Date(Date.now() + 49 * 60 * 60 * 1000);
    const expiredResults = await expireReservationsUseCase.execute(futureDate);

    expect(expiredResults.length).toBe(1);
    expect(expiredResults[0].reallocatedTo).toBe(resB.id);

    // Verify copy is still ON_HOLD but now for B
    const updatedCopy = await copyRepo.findById(copy.id);
    expect(updatedCopy?.status).toBe(CopyStatus.ON_HOLD);

    const updatedResB = await reservationRepo.findById(resB.id);
    expect(updatedResB?.status).toBe('ON_HOLD');
  });

  // -------------------------------------------------------------
  // Scenario 17: Student borrowing Book X attempts to borrow 2nd copy of Book X -> REJECT
  // -------------------------------------------------------------
  it('Scenario 17: User cannot borrow second physical copy of the same Book record', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;
    const book = await bookRepo.create({ id: 'book-s17', isbn: '9780000001700', title: 'Double Borrow Book' });
    const copy1 = await copyRepo.create({ id: 'copy-s17-1', barcode: 'BC-S17-1', book_id: book.id, acquisition_price: 600 });
    const copy2 = await copyRepo.create({ id: 'copy-s17-2', barcode: 'BC-S17-2', book_id: book.id, acquisition_price: 600 });

    // Borrow copy1
    await borrowUseCase.execute({ borrowerId: student.id, barcode: copy1.barcode });

    // Attempt to borrow copy2 of same book
    await expect(
      borrowUseCase.execute({ borrowerId: student.id, barcode: copy2.barcode })
    ).rejects.toThrowError(/already holds an active copy of/);
  });

  // -------------------------------------------------------------
  // Scenario 18: Fine 600 THB -> Librarian waive (FORBIDDEN), Admin waive (SUCCESS)
  // -------------------------------------------------------------
  it('Scenario 18: Librarian cannot waive fine (FORBIDDEN); Admin can waive with reason', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;
    const librarian = (await userRepo.findByUniversityId('LIB-0001'))!;
    const admin = (await userRepo.findByUniversityId('ADM-0001'))!;

    await fineRepo.createCharge({
      id: 'charge-s18',
      user_id: student.id,
      charge_type: ChargeType.LATE_FINE,
      amount: 600,
    });

    // Librarian attempts waive -> FORBIDDEN
    await expect(
      waiveFineUseCase.execute({
        userId: student.id,
        amount: 200,
        reason: 'Librarian trying to waive',
        adminId: librarian.id,
      })
    ).rejects.toThrowError(/Only administrators are authorized to waive fines/);

    // Admin waives -> SUCCESS
    const waiveResult = await waiveFineUseCase.execute({
      userId: student.id,
      amount: 200,
      reason: 'Approved hardship exemption',
      adminId: admin.id,
    });

    expect(waiveResult.newOutstanding).toBe(400);
  });

  // -------------------------------------------------------------
  // Scenario 19: Book price 800 THB, confirm lost with 70 THB late fine
  // Expected charge: 800 + 200 fee + 70 fine = 1,070 THB, copy LOST, loan closed
  // -------------------------------------------------------------
  it('Scenario 19: Confirm lost charge = Acquisition Price + 200 Fee + Late fine', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;
    const librarian = (await userRepo.findByUniversityId('LIB-0001'))!;
    const { copy } = await createExtraBookAndCopy('S19', 800);

    const loan = await borrowUseCase.execute({ borrowerId: student.id, barcode: copy.barcode });

    // 7 days late before confirm lost (7 * 10 = 70 THB)
    const confirmDate = new Date(loan.due_date.getTime() + 7 * 24 * 60 * 60 * 1000);

    const result = await confirmLostUseCase.execute({
      loanId: loan.id,
      librarianId: librarian.id,
      confirmDate,
    });

    expect(result.charges.replacementPrice).toBe(800);
    expect(result.charges.processingFee).toBe(200);
    expect(result.charges.accruedLateFine).toBe(70);
    expect(result.charges.totalCharge).toBe(1070);

    expect(result.copyStatus).toBe(CopyStatus.LOST);
    expect(result.loan.status).toBe('LOST');

    // Loan is no longer active
    expect(await loanRepo.countActiveLoansByUser(student.id)).toBe(0);
  });

  // -------------------------------------------------------------
  // Scenario 20: Book price 1,200 THB, returned with MAJOR_DAMAGE
  // Expected charge: 50% = 600 THB, copy status MAINTENANCE
  // -------------------------------------------------------------
  it('Scenario 20: MAJOR_DAMAGE assessment charges 50% acquisition price and sets copy to MAINTENANCE', async () => {
    const student = (await userRepo.findByUniversityId('65010001'))!;
    const { copy } = await createExtraBookAndCopy('S20', 1200);

    const loan = await borrowUseCase.execute({ borrowerId: student.id, barcode: copy.barcode });

    const result = await returnUseCase.execute({
      loanId: loan.id,
      condition: DamageCondition.MAJOR_DAMAGE,
      returnDate: loan.due_date,
    });

    expect(result.damageCharge).toBe(600); // 50% of 1,200
    expect(result.copyStatus).toBe(CopyStatus.MAINTENANCE);

    const updatedCopy = await copyRepo.findById(copy.id);
    expect(updatedCopy?.status).toBe(CopyStatus.MAINTENANCE);
  });
});
