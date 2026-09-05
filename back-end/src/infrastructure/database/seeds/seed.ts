import bcrypt from 'bcrypt';
import { getDatabase, IDatabaseClient } from '../db.js';
import { UserRole, UserStatus, CopyStatus } from '../../../domain/constants/rules.js';

export async function runSeed(customDb?: IDatabaseClient) {
  const db = customDb || (await getDatabase());
  console.log('Seeding initial data for UniLib Core...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Users
  const users = [
    {
      id: 'usr-admin-01',
      university_id: 'ADM-0001',
      email: 'admin@unilib.ac.th',
      password_hash: passwordHash,
      full_name: 'Dr. System Administrator',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    {
      id: 'usr-lib-01',
      university_id: 'LIB-0001',
      email: 'librarian@unilib.ac.th',
      password_hash: passwordHash,
      full_name: 'Somchai Library Custodian',
      role: UserRole.LIBRARIAN,
      status: UserStatus.ACTIVE,
    },
    {
      id: 'usr-stu-01',
      university_id: '65010001',
      email: 'student1@unilib.ac.th',
      password_hash: passwordHash,
      full_name: 'Somying Student One',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
    },
    {
      id: 'usr-stu-02',
      university_id: '65010002',
      email: 'student2@unilib.ac.th',
      password_hash: passwordHash,
      full_name: 'Arthit Student Two',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
    },
    {
      id: 'usr-lec-01',
      university_id: 'LEC-0001',
      email: 'lecturer1@unilib.ac.th',
      password_hash: passwordHash,
      full_name: 'Prof. Anan Lecturer One',
      role: UserRole.LECTURER,
      status: UserStatus.ACTIVE,
    },
  ];

  for (const u of users) {
    await db.query(
      `INSERT INTO users (id, university_id, email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [u.id, u.university_id, u.email, u.password_hash, u.full_name, u.role, u.status]
    );
  }

  // 2. Authors
  const authors = [
    { id: 'auth-01', name: 'Robert C. Martin' },
    { id: 'auth-02', name: 'Martin Kleppmann' },
    { id: 'auth-03', name: 'Alex Petrov' },
  ];

  for (const a of authors) {
    await db.query(`INSERT INTO authors (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [a.id, a.name]);
  }

  // 3. Categories
  const categories = [
    { id: 'cat-01', name: 'Software Engineering' },
    { id: 'cat-02', name: 'Databases & Distributed Systems' },
    { id: 'cat-03', name: 'Computer Science' },
  ];

  for (const c of categories) {
    await db.query(`INSERT INTO categories (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [c.id, c.name]);
  }

  // 4. Books
  const books = [
    {
      id: 'book-clean-arch',
      isbn: '9780134494166',
      title: 'Clean Architecture: A Craftsman\'s Guide to Software Structure and Design',
      description: 'Practical software architecture rules and guidance from Uncle Bob.',
      publisher: 'Prentice Hall',
      publication_year: 2017,
      author_id: 'auth-01',
      category_id: 'cat-01',
    },
    {
      id: 'book-ddia',
      isbn: '9781449373320',
      title: 'Designing Data-Intensive Applications',
      description: 'The big ideas behind reliable, scalable, and maintainable systems.',
      publisher: "O'Reilly Media",
      publication_year: 2017,
      author_id: 'auth-02',
      category_id: 'cat-02',
    },
    {
      id: 'book-db-internals',
      isbn: '9781492040347',
      title: 'Database Internals: A Deep Dive into How Distributed Data Systems Work',
      description: 'A comprehensive guide to internal database architecture and algorithms.',
      publisher: "O'Reilly Media",
      publication_year: 2019,
      author_id: 'auth-03',
      category_id: 'cat-02',
    },
  ];

  for (const b of books) {
    await db.query(
      `INSERT INTO books (id, isbn, title, description, publisher, publication_year)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [b.id, b.isbn, b.title, b.description, b.publisher, b.publication_year]
    );

    await db.query(
      `INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [b.id, b.author_id]
    );

    await db.query(
      `INSERT INTO book_categories (book_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [b.id, b.category_id]
    );
  }

  // 5. Physical Copies
  const copies = [
    // 5 copies for Clean Architecture
    { id: 'copy-ca-01', barcode: 'CA-000001', book_id: 'book-clean-arch', price: 950.0, status: CopyStatus.AVAILABLE },
    { id: 'copy-ca-02', barcode: 'CA-000002', book_id: 'book-clean-arch', price: 950.0, status: CopyStatus.AVAILABLE },
    { id: 'copy-ca-03', barcode: 'CA-000003', book_id: 'book-clean-arch', price: 950.0, status: CopyStatus.AVAILABLE },
    { id: 'copy-ca-04', barcode: 'CA-000004', book_id: 'book-clean-arch', price: 950.0, status: CopyStatus.AVAILABLE },
    { id: 'copy-ca-05', barcode: 'CA-000005', book_id: 'book-clean-arch', price: 950.0, status: CopyStatus.AVAILABLE },

    // 3 copies for DDIA
    { id: 'copy-ddia-01', barcode: 'DDIA-000001', book_id: 'book-ddia', price: 1200.0, status: CopyStatus.AVAILABLE },
    { id: 'copy-ddia-02', barcode: 'DDIA-000002', book_id: 'book-ddia', price: 1200.0, status: CopyStatus.AVAILABLE },
    { id: 'copy-ddia-03', barcode: 'DDIA-000003', book_id: 'book-ddia', price: 1200.0, status: CopyStatus.AVAILABLE },

    // 2 copies for Database Internals
    { id: 'copy-dbi-01', barcode: 'DBI-000001', book_id: 'book-db-internals', price: 1100.0, status: CopyStatus.AVAILABLE },
    { id: 'copy-dbi-02', barcode: 'DBI-000002', book_id: 'book-db-internals', price: 1100.0, status: CopyStatus.AVAILABLE },
  ];

  for (const cp of copies) {
    await db.query(
      `INSERT INTO physical_copies (id, barcode, book_id, acquisition_price, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [cp.id, cp.barcode, cp.book_id, cp.price, cp.status]
    );
  }

  console.log('Seed data successfully inserted!');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
