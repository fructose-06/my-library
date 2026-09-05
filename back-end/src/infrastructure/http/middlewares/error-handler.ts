import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../../../domain/errors/domain-error.js';

export function errorHandler(error: FastifyError | DomainError | Error, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error);

  if (error instanceof DomainError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details || null,
      },
    });
  }

  // Fastify Schema Validation Error
  if ('validation' in error && error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.validation,
      },
    });
  }

  // Fastify JWT error
  if (error.name === 'UnauthorizedError' || error.message.includes('authorization') || error.message.includes('token')) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: error.message || 'Invalid or missing authentication token',
      },
    });
  }

  // Default Internal Server Error (Hide internal stack traces from clients)
  const statusCode = ('statusCode' in error && typeof error.statusCode === 'number') ? error.statusCode : 500;
  return reply.status(statusCode).send({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: statusCode === 500 ? 'An internal server error occurred' : error.message,
    },
  });
}
