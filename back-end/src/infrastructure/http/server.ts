import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { IDatabaseClient } from '../database/db.js';
import { errorHandler } from './middlewares/error-handler.js';

// Repositories
import { UserRepository } from '../repositories/user.repository.js';
import { BookRepository } from '../repositories/book.repository.js';
import { CopyRepository } from '../repositories/copy.repository.js';
import { LoanRepository } from '../repositories/loan.repository.js';
import { ReservationRepository } from '../repositories/reservation.repository.js';
import { FineLedgerRepository } from '../repositories/fine-ledger.repository.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';

// Use cases
import { BorrowBookUseCase } from '../../application/use-cases/borrow-book.use-case.js';
import { ReturnBookUseCase } from '../../application/use-cases/return-book.use-case.js';
import { RenewBookUseCase } from '../../application/use-cases/renew-book.use-case.js';
import { ReserveBookUseCase } from '../../application/use-cases/reserve-book.use-case.js';
import { CancelReservationUseCase } from '../../application/use-cases/cancel-reservation.use-case.js';
import { ConfirmLostUseCase } from '../../application/use-cases/confirm-lost.use-case.js';
import { PayFineUseCase } from '../../application/use-cases/pay-fine.use-case.js';
import { WaiveFineUseCase } from '../../application/use-cases/waive-fine.use-case.js';
import { ExpireReservationsUseCase } from '../../application/use-cases/expire-reservations.use-case.js';

// Routes
import { authRoutes } from './routes/auth.routes.js';
import { catalogRoutes } from './routes/catalog.routes.js';
import { circulationRoutes } from './routes/circulation.routes.js';
import { reservationRoutes } from './routes/reservation.routes.js';
import { fineRoutes } from './routes/fine.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { reportRoutes } from './routes/report.routes.js';

export interface AppDependencies {
  db: IDatabaseClient;
  jwtSecret?: string;
}

export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' },
  });

  // 1. Plugins
  await app.register(cors, { origin: true });
  await app.register(fastifyJwt, {
    secret: deps.jwtSecret || process.env.JWT_SECRET || 'unilib-enterprise-secret-key',
  });

  // 2. Swagger / OpenAPI Documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'UniLib Core API',
        description: 'University Library Management Backend System — Production Enterprise Edition',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // 3. Error Handler
  app.setErrorHandler(errorHandler);

  // 4. Initialize Repositories
  const userRepo = new UserRepository(deps.db);
  const bookRepo = new BookRepository(deps.db);
  const copyRepo = new CopyRepository(deps.db);
  const loanRepo = new LoanRepository(deps.db);
  const reservationRepo = new ReservationRepository(deps.db);
  const fineRepo = new FineLedgerRepository(deps.db);
  const auditRepo = new AuditLogRepository(deps.db);

  // 5. Initialize Use Cases
  const borrowUseCase = new BorrowBookUseCase(
    deps.db,
    userRepo,
    bookRepo,
    copyRepo,
    loanRepo,
    reservationRepo,
    fineRepo,
    auditRepo
  );
  const returnUseCase = new ReturnBookUseCase(
    deps.db,
    loanRepo,
    copyRepo,
    reservationRepo,
    fineRepo,
    auditRepo
  );
  const renewUseCase = new RenewBookUseCase(
    deps.db,
    loanRepo,
    userRepo,
    reservationRepo,
    fineRepo,
    auditRepo
  );
  const reserveUseCase = new ReserveBookUseCase(
    deps.db,
    userRepo,
    bookRepo,
    loanRepo,
    reservationRepo,
    fineRepo,
    auditRepo
  );
  const cancelReservationUseCase = new CancelReservationUseCase(
    deps.db,
    reservationRepo,
    copyRepo,
    auditRepo
  );
  const confirmLostUseCase = new ConfirmLostUseCase(
    deps.db,
    loanRepo,
    copyRepo,
    fineRepo,
    auditRepo
  );
  const payFineUseCase = new PayFineUseCase(deps.db, fineRepo, userRepo, auditRepo);
  const waiveFineUseCase = new WaiveFineUseCase(deps.db, fineRepo, userRepo, auditRepo);
  const expireReservationsUseCase = new ExpireReservationsUseCase(
    deps.db,
    reservationRepo,
    copyRepo,
    auditRepo
  );

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    in_memory_db: deps.db.isInMemory(),
  }));

  // Trigger background expiration manually or on demand
  app.post('/api/tasks/expire-reservations', async (request, reply) => {
    const results = await expireReservationsUseCase.execute();
    return { success: true, processed: results };
  });

  // 6. Register Routes
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth', userRepo, fineRepo, loanRepo });
      await api.register(catalogRoutes, { prefix: '', bookRepo, copyRepo });
      await api.register(circulationRoutes, {
        prefix: '/circulation',
        borrowUseCase,
        returnUseCase,
        renewUseCase,
        confirmLostUseCase,
        loanRepo,
      });
      await api.register(reservationRoutes, {
        prefix: '/reservations',
        reserveUseCase,
        cancelUseCase: cancelReservationUseCase,
        reservationRepo,
      });
      await api.register(fineRoutes, {
        prefix: '/fines',
        payFineUseCase,
        waiveFineUseCase,
        fineRepo,
      });
      await api.register(adminRoutes, {
        prefix: '/admin',
        userRepo,
        auditRepo,
      });
      await api.register(reportRoutes, {
        prefix: '/reports',
        db: deps.db,
        loanRepo,
      });
    },
    { prefix: '/api' }
  );

  return app;
}
