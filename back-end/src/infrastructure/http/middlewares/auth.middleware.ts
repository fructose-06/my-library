import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '../../../domain/constants/rules.js';
import { DomainErrors } from '../../../domain/errors/domain-error.js';

export interface TokenPayload {
  id: string;
  email: string;
  role: UserRole;
  university_id: string;
}

export function getAuthUser(request: FastifyRequest): TokenPayload {
  if (!request.user) {
    throw DomainErrors.UNAUTHORIZED();
  }
  return request.user as TokenPayload;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    throw DomainErrors.UNAUTHORIZED('Authentication token is missing or invalid');
  }
}

export function authorize(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request);

    if (!allowedRoles.includes(user.role)) {
      throw DomainErrors.FORBIDDEN(`Role '${user.role}' is not authorized to access this resource`);
    }
  };
}
