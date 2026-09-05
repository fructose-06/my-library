import { FastifyInstance } from 'fastify';
import { UserRepository } from '../../repositories/user.repository.js';
import { AuditLogRepository } from '../../repositories/audit-log.repository.js';
import { authenticate, authorize, getAuthUser } from '../middlewares/auth.middleware.js';
import { UserRole, UserStatus } from '../../../domain/constants/rules.js';
import { DomainErrors } from '../../../domain/errors/domain-error.js';

export async function adminRoutes(
  fastify: FastifyInstance,
  options: {
    userRepo: UserRepository;
    auditRepo: AuditLogRepository;
  }
) {
  const { userRepo, auditRepo } = options;

  // GET /api/admin/users (Admin & Librarian)
  fastify.get(
    '/users',
    {
      preHandler: [authenticate, authorize([UserRole.LIBRARIAN, UserRole.ADMIN])],
      schema: {
        description: 'List and search users',
        tags: ['Administration'],
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            limit: { type: 'integer', default: 20 },
            offset: { type: 'integer', default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query as any;
      const res = await userRepo.list({
        search: q.search,
        limit: q.limit ? Number(q.limit) : 20,
        offset: q.offset ? Number(q.offset) : 0,
      });

      return {
        success: true,
        data: res.users.map((u) => ({
          id: u.id,
          university_id: u.university_id,
          email: u.email,
          full_name: u.full_name,
          role: u.role,
          status: u.status,
          created_at: u.created_at,
        })),
        pagination: {
          total: res.total,
          limit: q.limit ? Number(q.limit) : 20,
          offset: q.offset ? Number(q.offset) : 0,
        },
      };
    }
  );

  // PATCH /api/admin/users/:id/status (Admin only)
  fastify.patch(
    '/users/:id/status',
    {
      preHandler: [authenticate, authorize([UserRole.ADMIN])],
      schema: {
        description: 'Update user account status (ACTIVE/DISABLED) (Admin only)',
        tags: ['Administration'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['ACTIVE', 'DISABLED'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as any;
      const { status } = request.body as any;

      const user = await userRepo.findById(id);
      if (!user) {
        throw DomainErrors.USER_NOT_FOUND(id);
      }

      const updated = await userRepo.updateStatus(id, status as UserStatus);

      await auditRepo.log({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        actor_id: getAuthUser(request).id,
        action: 'UPDATE_USER_STATUS',
        resource_type: 'USER',
        resource_id: id,
        details: { previous_status: user.status, new_status: status },
        ip_address: request.ip,
      });

      return {
        success: true,
        data: {
          id: updated!.id,
          university_id: updated!.university_id,
          email: updated!.email,
          status: updated!.status,
        },
      };
    }
  );

  // PATCH /api/admin/users/:id/role (Admin only)
  fastify.patch(
    '/users/:id/role',
    {
      preHandler: [authenticate, authorize([UserRole.ADMIN])],
      schema: {
        description: 'Update user role (Admin only)',
        tags: ['Administration'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: ['STUDENT', 'LECTURER', 'LIBRARIAN', 'ADMIN'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as any;
      const { role } = request.body as any;

      const user = await userRepo.findById(id);
      if (!user) {
        throw DomainErrors.USER_NOT_FOUND(id);
      }

      const updated = await userRepo.updateRole(id, role as UserRole);

      await auditRepo.log({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        actor_id: getAuthUser(request).id,
        action: 'UPDATE_USER_ROLE',
        resource_type: 'USER',
        resource_id: id,
        details: { previous_role: user.role, new_role: role },
        ip_address: request.ip,
      });

      return {
        success: true,
        data: {
          id: updated!.id,
          university_id: updated!.university_id,
          email: updated!.email,
          role: updated!.role,
        },
      };
    }
  );

  // GET /api/admin/audit-logs (Admin only)
  fastify.get(
    '/audit-logs',
    {
      preHandler: [authenticate, authorize([UserRole.ADMIN])],
      schema: {
        description: 'View system audit logs (Admin only)',
        tags: ['Administration'],
        querystring: {
          type: 'object',
          properties: {
            resource_type: { type: 'string' },
            actor_id: { type: 'string' },
            limit: { type: 'integer', default: 50 },
            offset: { type: 'integer', default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query as any;
      const res = await auditRepo.list({
        resourceType: q.resource_type,
        actorId: q.actor_id,
        limit: q.limit ? Number(q.limit) : 50,
        offset: q.offset ? Number(q.offset) : 0,
      });

      return {
        success: true,
        data: res.logs,
        pagination: {
          total: res.total,
          limit: q.limit ? Number(q.limit) : 50,
          offset: q.offset ? Number(q.offset) : 0,
        },
      };
    }
  );
}
