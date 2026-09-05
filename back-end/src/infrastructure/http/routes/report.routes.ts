import { FastifyInstance } from 'fastify';
import { LoanRepository } from '../../repositories/loan.repository.js';
import { IDatabaseClient } from '../../database/db.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { UserRole } from '../../../domain/constants/rules.js';

export async function reportRoutes(
  fastify: FastifyInstance,
  options: {
    db: IDatabaseClient;
    loanRepo: LoanRepository;
  }
) {
  const { db, loanRepo } = options;

  // GET /api/reports/overdue (Librarian/Admin)
  fastify.get(
    '/overdue',
    {
      preHandler: [authenticate, authorize([UserRole.LIBRARIAN, UserRole.ADMIN])],
      schema: {
        description: 'Generate real-time Overdue Loans Report',
        tags: ['Reports'],
      },
    },
    async (request, reply) => {
      const overdueLoans = await loanRepo.listAllOverdueLoans();
      return {
        success: true,
        data: overdueLoans,
        total_overdue: overdueLoans.length,
      };
    }
  );

  // GET /api/reports/inventory (Librarian/Admin)
  fastify.get(
    '/inventory',
    {
      preHandler: [authenticate, authorize([UserRole.LIBRARIAN, UserRole.ADMIN])],
      schema: {
        description: 'Inventory Report: count of copies grouped by status',
        tags: ['Reports'],
      },
    },
    async (request, reply) => {
      const res = await db.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::int as count FROM physical_copies GROUP BY status`
      );

      return {
        success: true,
        data: res.rows.map((r) => ({ status: r.status, count: Number(r.count) })),
      };
    }
  );

  // GET /api/reports/popular-books (Librarian/Admin)
  fastify.get(
    '/popular-books',
    {
      preHandler: [authenticate, authorize([UserRole.LIBRARIAN, UserRole.ADMIN])],
      schema: {
        description: 'Most borrowed books report',
        tags: ['Reports'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      const limit = (request.query as any).limit ? Number((request.query as any).limit) : 10;
      const res = await db.query<any>(
        `SELECT b.id, b.title, b.isbn, COUNT(l.id)::int as borrow_count
         FROM books b
         LEFT JOIN loans l ON b.id = l.book_id
         GROUP BY b.id, b.title, b.isbn
         ORDER BY borrow_count DESC
         LIMIT $1`,
        [limit]
      );

      return {
        success: true,
        data: res.rows.map((r) => ({
          book_id: r.id,
          title: r.title,
          isbn: r.isbn,
          borrow_count: Number(r.borrow_count),
        })),
      };
    }
  );

  // GET /api/reports/outstanding-fines (Librarian/Admin)
  fastify.get(
    '/outstanding-fines',
    {
      preHandler: [authenticate, authorize([UserRole.LIBRARIAN, UserRole.ADMIN])],
      schema: {
        description: 'List borrowers with outstanding fines',
        tags: ['Reports'],
      },
    },
    async (request, reply) => {
      const res = await db.query<any>(
        `SELECT u.id, u.full_name, u.email, u.university_id, u.role,
          (
            COALESCE((SELECT SUM(amount) FROM fine_ledger fl WHERE fl.user_id = u.id), 0) -
            COALESCE((SELECT SUM(amount_paid) FROM payments p WHERE p.user_id = u.id), 0) -
            COALESCE((SELECT SUM(amount_waived) FROM waivers w WHERE w.user_id = u.id), 0)
          ) as outstanding_balance
         FROM users u
         WHERE (
            COALESCE((SELECT SUM(amount) FROM fine_ledger fl WHERE fl.user_id = u.id), 0) -
            COALESCE((SELECT SUM(amount_paid) FROM payments p WHERE p.user_id = u.id), 0) -
            COALESCE((SELECT SUM(amount_waived) FROM waivers w WHERE w.user_id = u.id), 0)
         ) > 0
         ORDER BY outstanding_balance DESC`
      );

      return {
        success: true,
        data: res.rows.map((r) => ({
          user_id: r.id,
          full_name: r.full_name,
          email: r.email,
          university_id: r.university_id,
          role: r.role,
          outstanding_balance: Number(r.outstanding_balance),
        })),
      };
    }
  );
}
