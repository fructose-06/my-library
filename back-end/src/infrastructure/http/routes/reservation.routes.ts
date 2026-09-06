import { FastifyInstance } from 'fastify';
import { ReserveBookUseCase } from '../../../application/use-cases/reserve-book.use-case.js';
import { CancelReservationUseCase } from '../../../application/use-cases/cancel-reservation.use-case.js';
import { ReservationRepository } from '../../repositories/reservation.repository.js';
import { authenticate, getAuthUser } from '../middlewares/auth.middleware.js';
import { UserRole } from '../../../domain/constants/rules.js';
import { DomainErrors } from '../../../domain/errors/domain-error.js';

export async function reservationRoutes(
  fastify: FastifyInstance,
  options: {
    reserveUseCase: ReserveBookUseCase;
    cancelUseCase: CancelReservationUseCase;
    reservationRepo: ReservationRepository;
  }
) {
  const { reserveUseCase, cancelUseCase, reservationRepo } = options;

  // POST /api/reservations
  fastify.post(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Create a reservation for a book record',
        tags: ['Reservation'],
        body: {
          type: 'object',
          required: ['book_id'],
          properties: {
            book_id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { book_id } = request.body as any;
      const currentUser = getAuthUser(request);

      if (currentUser.role !== UserRole.STUDENT && currentUser.role !== UserRole.LECTURER) {
        throw DomainErrors.FORBIDDEN('Only students and lecturers are permitted to reserve books');
      }

      const reservation = await reserveUseCase.execute({
        userId: currentUser.id,
        bookId: book_id,
        actorId: currentUser.id,
        ipAddress: request.ip,
      });

      reply.status(201);
      return {
        success: true,
        data: reservation,
      };
    }
  );

  // POST /api/reservations/:id/cancel
  fastify.post(
    '/:id/cancel',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Cancel an active reservation',
        tags: ['Reservation'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as any;
      const currentUser = getAuthUser(request);

      const resItem = await reservationRepo.findById(id);
      if (!resItem) {
        reply.status(404);
        return {
          success: false,
          error: { code: 'RESERVATION_NOT_FOUND', message: `Reservation '${id}' was not found` },
        };
      }

      if (
        currentUser.role !== UserRole.LIBRARIAN &&
        currentUser.role !== UserRole.ADMIN &&
        resItem.user_id !== currentUser.id
      ) {
        throw DomainErrors.FORBIDDEN('Cannot cancel reservations of another user');
      }

      const cancelled = await cancelUseCase.execute({
        reservationId: id,
        actorId: currentUser.id,
        ipAddress: request.ip,
      });

      return {
        success: true,
        data: cancelled,
      };
    }
  );

  // GET /api/reservations/my-reservations
  fastify.get(
    '/my-reservations',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all reservations of current authenticated user',
        tags: ['Reservation'],
      },
    },
    async (request, reply) => {
      const currentUser = getAuthUser(request);
      const reservations = await reservationRepo.listByUser(currentUser.id);
      return {
        success: true,
        data: reservations,
      };
    }
  );
}
