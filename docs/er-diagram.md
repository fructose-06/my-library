# UniLib Core — Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    users ||--o{ loans : "borrows"
    users ||--o{ reservations : "creates"
    users ||--o{ fine_ledger : "incurs"
    users ||--o{ payments : "pays"
    users ||--o{ waivers : "receives"
    users ||--o{ audit_logs : "triggers"

    books ||--o{ physical_copies : "contains"
    books ||--o{ book_authors : "has"
    authors ||--o{ book_authors : "writes"
    books ||--o{ book_categories : "belongs_to"
    categories ||--o{ book_categories : "categorizes"
    books ||--o{ reservations : "reserved_for"

    physical_copies ||--o{ loans : "borrowed_in"
    physical_copies ||--o{ reservations : "allocated_to"

    loans ||--o{ fine_ledger : "generates"

    users {
        string id PK
        string university_id UK
        string email UK
        string password_hash
        string full_name
        string role "STUDENT | LECTURER | LIBRARIAN | ADMIN"
        string status "ACTIVE | DISABLED"
        timestamp created_at
        timestamp updated_at
    }

    books {
        string id PK
        string isbn UK "ISBN-13"
        string title
        text description
        string publisher
        int publication_year
        string language
        string status
        timestamp created_at
        timestamp updated_at
    }

    authors {
        string id PK
        string name UK
    }

    book_authors {
        string book_id PK, FK
        string author_id PK, FK
    }

    categories {
        string id PK
        string name UK
    }

    book_categories {
        string book_id PK, FK
        string category_id PK, FK
    }

    physical_copies {
        string id PK
        string barcode UK
        string book_id FK
        numeric acquisition_price
        timestamp acquisition_date
        string status "AVAILABLE | ON_LOAN | ON_HOLD | MAINTENANCE | LOST | RETIRED"
        int version
        timestamp created_at
        timestamp updated_at
    }

    loans {
        string id PK
        string user_id FK
        string copy_id FK
        string book_id FK
        timestamp borrow_date
        timestamp due_date
        timestamp return_date
        int renewal_count "0 to 2"
        string status "ACTIVE | RETURNED | LOST"
        timestamp created_at
        timestamp updated_at
    }

    reservations {
        string id PK
        string user_id FK
        string book_id FK
        string allocated_copy_id FK "nullable"
        int queue_position
        string status "PENDING | ON_HOLD | FULFILLED | CANCELLED | EXPIRED"
        timestamp hold_expires_at "48h window"
        timestamp created_at
        timestamp updated_at
    }

    fine_ledger {
        string id PK
        string user_id FK
        string loan_id FK "nullable"
        string charge_type "LATE_FINE | LOST_REPLACEMENT | PROCESSING_FEE | DAMAGE_CHARGE"
        numeric amount
        string status "PENDING | PAID | WAIVED"
        timestamp created_at
        timestamp updated_at
    }

    payments {
        string id PK
        string user_id FK
        numeric amount_paid
        string received_by FK "Librarian ID"
        text notes
        timestamp created_at
    }

    waivers {
        string id PK
        string user_id FK
        numeric amount_waived
        text reason
        string approved_by FK "Admin ID"
        timestamp created_at
    }

    audit_logs {
        string id PK
        string actor_id FK "nullable"
        string action
        string resource_type
        string resource_id
        jsonb details
        string ip_address
        timestamp created_at
    }
```

## Relational Invariants & Constraints

1. **Borrower Domain Parity:** `users.role` stores `STUDENT` or `LECTURER`, yet application logic treats both as `Borrower` with 100% equal rights (max 5 active loans, 14 days duration, max 2 renewals).
2. **Physical Copy Uniqueness:** Each physical copy has an immutable `barcode` and points to a parent `books(id)`.
3. **Pessimistic & Atomic Loan Claim:** A physical copy can have at most one `ACTIVE` loan. When borrowed, `physical_copies.status` transitions atomically to `ON_LOAN`.
4. **FIFO Reservation Allocation:** Books are reserved at the bibliographic record level (`books.id`). When a copy is returned, it is set to `ON_HOLD` for the first borrower in the FIFO queue for 48 hours.
5. **Double-Entry Financial Ledger:** Fines are recorded as individual ledger charge records. Outstanding balance is dynamically computed as:
   $$\text{Outstanding Balance} = \sum \text{Charges} - \sum \text{Payments} - \sum \text{Waivers}$$
   Never allowing negative values.
6. **Immutable Audit Trail:** All critical operations (Borrow, Return, Renew, Confirm Lost, Pay, Waive, Role Update, Status Update) write append-only records to `audit_logs`.
