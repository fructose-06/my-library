import { IDatabaseClient, IClientTransaction } from '../database/db.js';

export interface BookRow {
  id: string;
  isbn: string;
  title: string;
  description: string | null;
  publisher: string | null;
  publication_year: number | null;
  language: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  authors?: string[];
  categories?: string[];
  available_copies_count?: number;
  total_copies_count?: number;
}

export class BookRepository {
  constructor(private db: IDatabaseClient) {}

  async findById(id: string, client?: IClientTransaction): Promise<BookRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      'SELECT * FROM books WHERE id = $1',
      [id]
    );

    if (!res.rows[0]) return null;
    return this.enrichBookRow(res.rows[0], runner);
  }

  async findByIsbn(isbn: string, client?: IClientTransaction): Promise<BookRow | null> {
    const runner = client || this.db;
    const res = await runner.query<any>(
      'SELECT * FROM books WHERE isbn = $1',
      [isbn]
    );

    if (!res.rows[0]) return null;
    return this.enrichBookRow(res.rows[0], runner);
  }

  private async enrichBookRow(row: any, runner: IDatabaseClient | IClientTransaction): Promise<BookRow> {
    // Authors
    const authorsRes = await runner.query<{ name: string }>(
      `SELECT a.name FROM book_authors ba JOIN authors a ON ba.author_id = a.id WHERE ba.book_id = $1`,
      [row.id]
    );
    const authors = authorsRes.rows.map((r) => r.name);

    // Categories
    const catRes = await runner.query<{ name: string }>(
      `SELECT c.name FROM book_categories bc JOIN categories c ON bc.category_id = c.id WHERE bc.book_id = $1`,
      [row.id]
    );
    const categories = catRes.rows.map((r) => r.name);

    // Copies count
    const availRes = await runner.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM physical_copies WHERE book_id = $1 AND status = 'AVAILABLE'`,
      [row.id]
    );
    const totalRes = await runner.query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM physical_copies WHERE book_id = $1`,
      [row.id]
    );

    return {
      id: row.id,
      isbn: row.isbn,
      title: row.title,
      description: row.description,
      publisher: row.publisher,
      publication_year: row.publication_year ? Number(row.publication_year) : null,
      language: row.language,
      status: row.status,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      authors,
      categories,
      available_copies_count: Number(availRes.rows[0]?.count || 0),
      total_copies_count: Number(totalRes.rows[0]?.count || 0),
    };
  }

  async create(
    book: {
      id: string;
      isbn: string;
      title: string;
      description?: string;
      publisher?: string;
      publication_year?: number;
      language?: string;
      authors?: string[];
      categories?: string[];
    },
    client?: IClientTransaction
  ): Promise<BookRow> {
    const runner = client || this.db;

    await runner.query(
      `INSERT INTO books (id, isbn, title, description, publisher, publication_year, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        book.id,
        book.isbn,
        book.title,
        book.description || null,
        book.publisher || null,
        book.publication_year || null,
        book.language || 'Thai',
      ]
    );

    // Link authors
    if (book.authors && book.authors.length > 0) {
      for (const authorName of book.authors) {
        let authorRes = await runner.query<{ id: string }>(
          'SELECT id FROM authors WHERE name = $1',
          [authorName]
        );
        let authorId = authorRes.rows[0]?.id;
        if (!authorId) {
          authorId = `auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          await runner.query('INSERT INTO authors (id, name) VALUES ($1, $2)', [authorId, authorName]);
        }
        await runner.query(
          'INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [book.id, authorId]
        );
      }
    }

    // Link categories
    if (book.categories && book.categories.length > 0) {
      for (const catName of book.categories) {
        let catRes = await runner.query<{ id: string }>(
          'SELECT id FROM categories WHERE name = $1',
          [catName]
        );
        let catId = catRes.rows[0]?.id;
        if (!catId) {
          catId = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          await runner.query('INSERT INTO categories (id, name) VALUES ($1, $2)', [catId, catName]);
        }
        await runner.query(
          'INSERT INTO book_categories (book_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [book.id, catId]
        );
      }
    }

    const created = await this.findById(book.id, client);
    return created!;
  }

  async search(options: {
    query?: string;
    isbn?: string;
    author?: string;
    category?: string;
    availableOnly?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: 'title' | 'created_at' | 'publication_year';
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ books: BookRow[]; total: number }> {
    const limit = Math.min(options.limit || 20, 100);
    const offset = options.offset || 0;
    const sortBy = ['title', 'created_at', 'publication_year'].includes(options.sortBy || '') ? options.sortBy! : 'created_at';
    const sortOrder = options.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.query) {
      params.push(`%${options.query}%`);
      conditions.push(`(b.title ILIKE $${params.length} OR b.description ILIKE $${params.length} OR b.isbn ILIKE $${params.length})`);
    }

    if (options.isbn) {
      params.push(options.isbn);
      conditions.push(`b.isbn = $${params.length}`);
    }

    if (options.author) {
      params.push(`%${options.author}%`);
      conditions.push(`EXISTS (
        SELECT 1 FROM book_authors ba
        JOIN authors a ON ba.author_id = a.id
        WHERE ba.book_id = b.id AND a.name ILIKE $${params.length}
      )`);
    }

    if (options.category) {
      params.push(`%${options.category}%`);
      conditions.push(`EXISTS (
        SELECT 1 FROM book_categories bc
        JOIN categories c ON bc.category_id = c.id
        WHERE bc.book_id = b.id AND c.name ILIKE $${params.length}
      )`);
    }

    if (options.availableOnly) {
      conditions.push(`EXISTS (
        SELECT 1 FROM physical_copies pc
        WHERE pc.book_id = b.id AND pc.status = 'AVAILABLE'
      )`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(DISTINCT b.id) as count FROM books b ${whereSql}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const queryParams = [...params, limit, offset];
    const dataRes = await this.db.query<any>(
      `SELECT b.*
       FROM books b
       ${whereSql}
       ORDER BY b.${sortBy} ${sortOrder}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      queryParams
    );

    const books = await Promise.all(dataRes.rows.map((row: any) => this.enrichBookRow(row, this.db)));
    return { books, total };
  }

  private mapBookRow(row: any): BookRow {
    return {
      id: row.id,
      isbn: row.isbn,
      title: row.title,
      description: row.description,
      publisher: row.publisher,
      publication_year: row.publication_year ? Number(row.publication_year) : null,
      language: row.language,
      status: row.status,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      authors: Array.isArray(row.authors) ? row.authors : (typeof row.authors === 'string' ? JSON.parse(row.authors) : []),
      categories: Array.isArray(row.categories) ? row.categories : (typeof row.categories === 'string' ? JSON.parse(row.categories) : []),
      available_copies_count: Number(row.available_copies_count || 0),
      total_copies_count: Number(row.total_copies_count || 0),
    };
  }
}
