import { FastifyInstance } from 'fastify';
import { BookRepository } from '../../repositories/book.repository.js';
import { CopyRepository } from '../../repositories/copy.repository.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { UserRole, CopyStatus } from '../../../domain/constants/rules.js';
import { DomainErrors } from '../../../domain/errors/domain-error.js';

export async function catalogRoutes(
  fastify: FastifyInstance,
  options: {
    bookRepo: BookRepository;
    copyRepo: CopyRepository;
  }
) {
  const { bookRepo, copyRepo } = options;

  // GET /api/books (Search, Filter, Pagination)
  fastify.get(
    '/books',
    {
      schema: {
        description: 'Search books catalog with filtering, sorting and pagination',
        tags: ['Catalog'],
        querystring: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            isbn: { type: 'string' },
            author: { type: 'string' },
            category: { type: 'string' },
            available_only: { type: 'boolean' },
            limit: { type: 'integer', default: 20 },
            offset: { type: 'integer', default: 0 },
            sort_by: { type: 'string', enum: ['title', 'created_at', 'publication_year'] },
            sort_order: { type: 'string', enum: ['ASC', 'DESC'] },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query as any;
      const res = await bookRepo.search({
        query: q.query,
        isbn: q.isbn,
        author: q.author,
        category: q.category,
        availableOnly: q.available_only === true || q.available_only === 'true',
        limit: q.limit ? Number(q.limit) : 20,
        offset: q.offset ? Number(q.offset) : 0,
        sortBy: q.sort_by,
        sortOrder: q.sort_order,
      });

      return {
        success: true,
        data: res.books,
        pagination: {
          total: res.total,
          limit: q.limit ? Number(q.limit) : 20,
          offset: q.offset ? Number(q.offset) : 0,
        },
      };
    }
  );

  // GET /api/books/:id
  fastify.get(
    '/books/:id',
    {
      schema: {
        description: 'Get book details including copies inventory',
        tags: ['Catalog'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as any;
      const book = await bookRepo.findById(id);
      if (!book) {
        throw DomainErrors.BOOK_NOT_FOUND(id);
      }

      const copies = await copyRepo.listByBookId(id);

      return {
        success: true,
        data: {
          ...book,
          copies,
        },
      };
    }
  );

  // POST /api/books (Librarian/Admin only)
  fastify.post(
    '/books',
    {
      preHandler: [authenticate, authorize([UserRole.LIBRARIAN, UserRole.ADMIN])],
      schema: {
        description: 'Create a new bibliographic book record',
        tags: ['Catalog'],
        body: {
          type: 'object',
          required: ['isbn', 'title'],
          properties: {
            isbn: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            publisher: { type: 'string' },
            publication_year: { type: 'integer' },
            language: { type: 'string' },
            authors: { type: 'array', items: { type: 'string' } },
            categories: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as any;
      const existing = await bookRepo.findByIsbn(body.isbn);
      if (existing) {
        reply.status(409);
        return {
          success: false,
          error: {
            code: 'DUPLICATE_ISBN',
            message: `Book with ISBN '${body.isbn}' already exists`,
          },
        };
      }

      const id = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const created = await bookRepo.create({
        id,
        isbn: body.isbn,
        title: body.title,
        description: body.description,
        publisher: body.publisher,
        publication_year: body.publication_year,
        language: body.language,
        authors: body.authors,
        categories: body.categories,
      });

      reply.status(201);
      return {
        success: true,
        data: created,
      };
    }
  );

  // POST /api/books/:id/copies (Librarian/Admin only)
  fastify.post(
    '/books/:id/copies',
    {
      preHandler: [authenticate, authorize([UserRole.LIBRARIAN, UserRole.ADMIN])],
      schema: {
        description: 'Add physical copy to book inventory',
        tags: ['Catalog'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['barcode', 'acquisition_price'],
          properties: {
            barcode: { type: 'string' },
            acquisition_price: { type: 'number', minimum: 0.01 },
            status: {
              type: 'string',
              enum: ['AVAILABLE', 'ON_LOAN', 'ON_HOLD', 'MAINTENANCE', 'LOST', 'RETIRED'],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as any;
      const body = request.body as any;

      const book = await bookRepo.findById(id);
      if (!book) {
        throw DomainErrors.BOOK_NOT_FOUND(id);
      }

      const existingCopy = await copyRepo.findByBarcode(body.barcode);
      if (existingCopy) {
        reply.status(409);
        return {
          success: false,
          error: {
            code: 'DUPLICATE_BARCODE',
            message: `Physical copy with barcode '${body.barcode}' already exists`,
          },
        };
      }

      const copyId = `copy-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const createdCopy = await copyRepo.create({
        id: copyId,
        barcode: body.barcode,
        book_id: book.id,
        acquisition_price: body.acquisition_price,
        status: body.status || CopyStatus.AVAILABLE,
      });

      reply.status(201);
      return {
        success: true,
        data: createdCopy,
      };
    }
  );
}
