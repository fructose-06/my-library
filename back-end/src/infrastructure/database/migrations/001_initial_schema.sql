-- UniLib Core Database Schema
-- Production Enterprise Edition

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    university_id VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('STUDENT', 'LECTURER', 'LIBRARIAN', 'ADMIN')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
    id VARCHAR(36) PRIMARY KEY,
    isbn VARCHAR(20) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    publisher VARCHAR(255),
    publication_year INT,
    language VARCHAR(50) DEFAULT 'Thai',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS authors (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS book_authors (
    book_id VARCHAR(36) NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    author_id VARCHAR(36) NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, author_id)
);

CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS book_categories (
    book_id VARCHAR(36) NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    category_id VARCHAR(36) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, category_id)
);

CREATE TABLE IF NOT EXISTS physical_copies (
    id VARCHAR(36) PRIMARY KEY,
    barcode VARCHAR(50) NOT NULL UNIQUE,
    book_id VARCHAR(36) NOT NULL REFERENCES books(id),
    acquisition_price NUMERIC(10, 2) NOT NULL CHECK (acquisition_price > 0),
    acquisition_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ON_LOAN', 'ON_HOLD', 'MAINTENANCE', 'LOST', 'RETIRED')),
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loans (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    copy_id VARCHAR(36) NOT NULL REFERENCES physical_copies(id),
    book_id VARCHAR(36) NOT NULL REFERENCES books(id),
    borrow_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMPTZ NOT NULL,
    return_date TIMESTAMPTZ,
    renewal_count INT NOT NULL DEFAULT 0 CHECK (renewal_count >= 0 AND renewal_count <= 2),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RETURNED', 'LOST')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservations (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    book_id VARCHAR(36) NOT NULL REFERENCES books(id),
    allocated_copy_id VARCHAR(36) REFERENCES physical_copies(id),
    queue_position INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ON_HOLD', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
    hold_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fine_ledger (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    loan_id VARCHAR(36) REFERENCES loans(id),
    charge_type VARCHAR(30) NOT NULL CHECK (charge_type IN ('LATE_FINE', 'LOST_REPLACEMENT', 'PROCESSING_FEE', 'DAMAGE_CHARGE')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'WAIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    amount_paid NUMERIC(10, 2) NOT NULL CHECK (amount_paid > 0),
    received_by VARCHAR(36) NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS waivers (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    amount_waived NUMERIC(10, 2) NOT NULL CHECK (amount_waived > 0),
    reason TEXT NOT NULL,
    approved_by VARCHAR(36) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    actor_id VARCHAR(36) REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Production Indexes
CREATE INDEX IF NOT EXISTS idx_physical_copies_book_status ON physical_copies(book_id, status);
CREATE INDEX IF NOT EXISTS idx_physical_copies_barcode ON physical_copies(barcode);
CREATE INDEX IF NOT EXISTS idx_loans_user_status ON loans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_copy_status ON loans(copy_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_book_user_status ON loans(book_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_book_status_created ON reservations(book_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_reservations_user_status ON reservations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fine_ledger_user_status ON fine_ledger(user_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
