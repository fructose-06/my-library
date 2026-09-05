import { FastifyInstance } from 'fastify';
import { PayFineUseCase } from '../../../application/use-cases/pay-fine.use-case.js';
import { WaiveFineUseCase } from '../../../application/use-cases/waive-fine.use-case.js';
import { FineLedgerRepository } from '../../repositories/fine-ledger.repository.js';
import { authenticate, authorize, getAuthUser } from '../middlewares/auth.middleware.js';
import { UserRole } from '../../../domain/constants/rules.js';

export async function fineRoutes(
  fastify: FastifyInstance,
  options: {
    payFineUseCase: PayFineUseCase;
    waiveFineUseCase: WaiveFineUseCase;
    fineRepo: FineLedgerRepository;
  }
) {
  const { payFineUseCase, waiveFineUseCase, fineRepo } = options;

  // GET /api/fines/my-fines
  fastify.get(
    '/my-fines',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get fine ledger, payment history, and current outstanding balance',
        tags: ['Fines & Payments'],
      },
    },
    async (request, reply) => {
      const currentUser = getAuthUser(request);
      const userId = currentUser.id;
      const outstandingBalance = await fineRepo.getOutstandingBalance(userId);
      const charges = await fineRepo.listChargesByUser(userId);
      const payments = await fineRepo.listPaymentsByUser(userId);
      const waivers = await fineRepo.listWaiversByUser(userId);

      return {
        success: true,
        data: {
          outstanding_balance: outstandingBalance,
          charges,
          payments,
          waivers,
        },
      };
    }
  );

  // POST /api/fines/pay (Librarian only)
  fastify.post(
    '/pay',
    {
      preHandler: [authenticate, authorize([UserRole.LIBRARIAN, UserRole.ADMIN])],
      schema: {
        description: 'Receive and record fine payment (Librarian only)',
        tags: ['Fines & Payments'],
        body: {
          type: 'object',
          required: ['user_id', 'amount'],
          properties: {
            user_id: { type: 'string' },
            amount: { type: 'number', minimum: 0.01 },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as any;
      const currentUser = getAuthUser(request);

      const result = await payFineUseCase.execute({
        userId: body.user_id,
        amount: body.amount,
        librarianId: currentUser.id,
        notes: body.notes,
        ipAddress: request.ip,
      });

      return {
        success: true,
        data: result,
      };
    }
  );

  // POST /api/fines/waive (ADMIN ONLY!)
  fastify.post(
    '/waive',
    {
      preHandler: [authenticate, authorize([UserRole.ADMIN])],
      schema: {
        description: 'Waive user fine with required justification (Admin only)',
        tags: ['Fines & Payments'],
        body: {
          type: 'object',
          required: ['user_id', 'amount', 'reason'],
          properties: {
            user_id: { type: 'string' },
            amount: { type: 'number', minimum: 0.01 },
            reason: { type: 'string', minLength: 3 },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as any;
      const currentUser = getAuthUser(request);

      const result = await waiveFineUseCase.execute({
        userId: body.user_id,
        amount: body.amount,
        reason: body.reason,
        adminId: currentUser.id,
        ipAddress: request.ip,
      });

      return {
        success: true,
        data: result,
      };
    }
  );
}
