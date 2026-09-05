import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { UserRepository } from '../../repositories/user.repository.js';
import { FineLedgerRepository } from '../../repositories/fine-ledger.repository.js';
import { LoanRepository } from '../../repositories/loan.repository.js';
import { authenticate, getAuthUser } from '../middlewares/auth.middleware.js';
import { DomainErrors } from '../../../domain/errors/domain-error.js';

export async function authRoutes(
  fastify: FastifyInstance,
  options: {
    userRepo: UserRepository;
    fineRepo: FineLedgerRepository;
    loanRepo: LoanRepository;
  }
) {
  const { userRepo, fineRepo, loanRepo } = options;

  // POST /api/auth/login
  fastify.post(
    '/login',
    {
      schema: {
        description: 'User login returning JWT Bearer Token',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['identifier', 'password'],
          properties: {
            identifier: { type: 'string', description: 'University ID or Email' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { identifier, password } = request.body as any;

      let user = await userRepo.findByEmail(identifier);
      if (!user) {
        user = await userRepo.findByUniversityId(identifier);
      }

      if (!user) {
        throw DomainErrors.UNAUTHORIZED('Invalid credentials');
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        throw DomainErrors.UNAUTHORIZED('Invalid credentials');
      }

      if (user.status === 'DISABLED') {
        throw DomainErrors.USER_DISABLED();
      }

      const token = fastify.jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          university_id: user.university_id,
        },
        { expiresIn: '1d' }
      );

      return {
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            university_id: user.university_id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            status: user.status,
          },
        },
      };
    }
  );

  // GET /api/auth/me
  fastify.get(
    '/me',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get current authenticated user profile and account standing',
        tags: ['Authentication'],
      },
    },
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const user = await userRepo.findById(authUser.id);
      if (!user) {
        throw DomainErrors.USER_NOT_FOUND(authUser.id);
      }

      const outstandingBalance = await fineRepo.getOutstandingBalance(user.id);
      const activeLoansCount = await loanRepo.countActiveLoansByUser(user.id);
      const hasOverdue = await loanRepo.hasOverdueLoans(user.id);

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            university_id: user.university_id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            status: user.status,
          },
          standing: {
            active_loans_count: activeLoansCount,
            outstanding_fine_balance: outstandingBalance,
            has_overdue_loans: hasOverdue,
            can_borrow: user.status === 'ACTIVE' && activeLoansCount < 5 && outstandingBalance < 500 && !hasOverdue,
          },
        },
      };
    }
  );
}
