import { FastifyInstance } from 'fastify';
import { BorrowBookUseCase } from '../../../application/use-cases/borrow-book.use-case.js';
import { ReturnBookUseCase } from '../../../application/use-cases/return-book.use-case.js';
import { RenewBookUseCase } from '../../../application/use-cases/renew-book.use-case.js';
import { ConfirmLostUseCase } from '../../../application/use-cases/confirm-lost.use-case.js';
import { LoanRepository } from '../../repositories/loan.repository.js';
import { authenticate, authorize, getAuthUser } from '../middlewares/auth.middleware.js';
import { UserRole, DamageCondition } from '../../../domain/constants/rules.js';
import { DomainErrors } from '../../../domain/errors/domain-error.js';

export async function circulationRoutes(
  fastify: FastifyInstance,
  options: {
    borrowUseCase: BorrowBookUseCase;
    returnUseCase: ReturnBookUseCase;
    renewUseCase: RenewBookUseCase;
    confirmLostUseCase: ConfirmLostUseCase;
    loanRepo: LoanRepository;
  }
) {
  const { borrowUseCase, returnUseCase, renewUseCase, confirmLostUseCase, loanRepo } = options;

  // POST /api/circulation/borrow
  fastify.post(
    '/borrow',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Borrow a physical book copy by barcode',
        tags: ['Circulation'],
        body: {
          type: 'object',
          required: ['barcode'],
          properties: {
            barcode: { type: 'string' },
            borrower_id: { type: 'string', description: 'Required if librarian borrowing on behalf of user' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as any;
      const currentUser = getAuthUser(request);

      // Separation of Duties: Admin cannot borrow books
      if (currentUser.role === UserRole.ADMIN) {
        throw DomainErrors.FORBIDDEN('Administrators are not permitted to borrow books');
      }

      let targetBorrowerId = currentUser.id;
      if (currentUser.role === UserRole.LIBRARIAN) {
        if (!body.borrower_id) {
          throw DomainErrors.FORBIDDEN('Librarians cannot borrow books for themselves. Please specify borrower_id to borrow on behalf of a student or lecturer');
        }
        targetBorrowerId = body.borrower_id;
      } else {
        // Students and Lecturers cannot borrow on behalf of others
        if (body.borrower_id && body.borrower_id !== currentUser.id) {
          throw DomainErrors.FORBIDDEN('Cannot borrow on behalf of another user');
        }
      }

      const loan = await borrowUseCase.execute({
        borrowerId: targetBorrowerId,
        barcode: body.barcode,
        actorId: currentUser.id,
        ipAddress: request.ip,
      });

      reply.status(201);
      return {
        success: true,
        data: loan,
      };
    }
  );

  // POST /api/circulation/return (Librarian only)
  fastify.post(
    '/return',
    {
      preHandler: [authenticate, authorize([UserRole.LIBRARIAN])],
      schema: {
        description: 'Process physical copy return and inspect condition (Librarian only)',
        tags: ['Circulation'],
        body: {
          type: 'object',
          required: ['loan_id'],
          properties: {
            loan_id: { type: 'string' },
            condition: {
              type: 'string',
              enum: ['NORMAL', 'MINOR_DAMAGE', 'MAJOR_DAMAGE', 'UNUSABLE'],
              default: 'NORMAL',
            },
            return_date: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as any;
      const currentUser = getAuthUser(request);

      const result = await returnUseCase.execute({
        loanId: body.loan_id,
        condition: (body.condition as DamageCondition) || DamageCondition.NORMAL,
        returnDate: body.return_date ? new Date(body.return_date) : new Date(),
        actorId: currentUser.id,
        ipAddress: request.ip,
      });

      return {
        success: true,
        data: result,
      };
    }
  );

  // POST /api/circulation/renew/:loanId
  fastify.post(
    '/renew/:loanId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Renew an active loan (+7 calendar days)',
        tags: ['Circulation'],
        params: {
          type: 'object',
          required: ['loanId'],
          properties: { loanId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { loanId } = request.params as any;
      const currentUser = getAuthUser(request);

      const loan = await loanRepo.findById(loanId);
      if (!loan) {
        throw DomainErrors.BOOK_NOT_FOUND(loanId);
      }

      // Check ownership unless librarian/admin
      if (
        currentUser.role !== UserRole.LIBRARIAN &&
        currentUser.role !== UserRole.ADMIN &&
        loan.user_id !== currentUser.id
      ) {
        throw DomainErrors.FORBIDDEN('Cannot renew loans belonging to another user');
      }

      const renewed = await renewUseCase.execute({
        loanId,
        actorId: currentUser.id,
        ipAddress: request.ip,
      });

      return {
        success: true,
        data: renewed,
      };
    }
  );

  // POST /api/circulation/confirm-lost (Librarian only)
  fastify.post(
    '/confirm-lost',
    {
      preHandler: [authenticate, authorize([UserRole.LIBRARIAN, UserRole.ADMIN])],
      schema: {
        description: 'Confirm a book is lost and apply replacement fee (Librarian only)',
        tags: ['Circulation'],
        body: {
          type: 'object',
          required: ['loan_id'],
          properties: {
            loan_id: { type: 'string' },
            confirm_date: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as any;
      const currentUser = getAuthUser(request);

      const result = await confirmLostUseCase.execute({
        loanId: body.loan_id,
        librarianId: currentUser.id,
        confirmDate: body.confirm_date ? new Date(body.confirm_date) : new Date(),
        ipAddress: request.ip,
      });

      return {
        success: true,
        data: result,
      };
    }
  );

  // GET /api/circulation/my-loans
  fastify.get(
    '/my-loans',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get active loans of current authenticated user',
        tags: ['Circulation'],
      },
    },
    async (request, reply) => {
      const currentUser = getAuthUser(request);
      const res = await loanRepo.listByUser(currentUser.id, { activeOnly: true });
      return {
        success: true,
        data: res.loans,
        total: res.total,
      };
    }
  );

  // GET /api/circulation/my-history
  fastify.get(
    '/my-history',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get complete borrowing history of current authenticated user',
        tags: ['Circulation'],
      },
    },
    async (request, reply) => {
      const currentUser = getAuthUser(request);
      const res = await loanRepo.listByUser(currentUser.id, { activeOnly: false });
      return {
        success: true,
        data: res.loans,
        total: res.total,
      };
    }
  );
}
