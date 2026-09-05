# UniLib Core — University Library Management Backend System
### Production Enterprise Edition

Backend API กลางสำหรับระบบห้องสมุดมหาวิทยาลัย พัฒนาด้วยสถาปัตยกรรม **Clean Architecture**, **TypeScript**, **Fastify** และ **PostgreSQL** ออกแบบเพื่อรองรับปริมาณผู้ใช้กว่า 20,000 คน, หนังสือกว่า 100,000 รายการ และประวัติการยืมกว่า 5,000,000 รายการ โดยให้ความสำคัญสูงสุดกับ **Data Integrity**, **Concurrency Safety**, **Immutable Audit Trail** และ **Role-Based Access Control (RBAC)** ตามหลัก Least Privilege

---

## สารบัญ
1. [สถาปัตยกรรมระบบ (System Architecture)](#1-สถาปัตยกรรมระบบ-system-architecture)
2. [โครงสร้างโปรเจกต์ (Project Structure)](#2-โครงสร้างโปรเจกต์-project-structure)
3. [กลยุทธ์การออกแบบเชิงวิศวกรรม 7 ประการ (7 Architecture Strategies)](#3-กลยุทธ์การออกแบบเชิงวิศวกรรม-7-ประการ)
4. [การติดตั้งและเริ่มต้นใช้งาน (Getting Started)](#4-การติดตั้งและเริ่มต้นใช้งาน)
5. [การทดสอบระบบ (Automated Testing & 20 Mandatory Scenarios)](#5-การทดสอบระบบ-automated-testing)
6. [API Documentation (OpenAPI & Swagger)](#6-api-documentation)
7. [ฐานข้อมูลและ ER Diagram](#7-ฐานข้อมูลและ-er-diagram)

---

## 1. สถาปัตยกรรมระบบ (System Architecture)

ระบบถูกออกแบบตามหลัก **Clean Architecture / Hexagonal Architecture** โดยแยกความรับผิดชอบออกเป็น 4 ชั้นอย่างเด็ดขาด:

```
┌───────────────────────────────────────────────────────────┐
│                 Transport / Presentation                  │
│       Fastify HTTP Routes, OpenAPI Swagger, Middleware    │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                 Application / Use Cases                   │
│   BorrowBook, ReturnBook, RenewBook, ReserveBook, Fines   │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                      Domain Layer                         │
│       Entities, Business Rules, FineCalculator, Errors    │
└─────────────────────────────┬─────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────┐
│               Infrastructure / Persistence                │
│    PostgreSQL, Repositories, Database Transactions, Jobs  │
└───────────────────────────────────────────────────────────┘
```

* **Domain Layer:** บรรจุ Domain Invariants, Business Constants (`MAX_ACTIVE_LOANS = 5`, `LOAN_DURATION_DAYS = 14`, ค่าปรับ 10 บาท/วัน เพดาน 1,000 บาท) และ Service คำนวณค่าปรับ/ความเสียหาย โดยไม่มี Dependency กับ Database หรือ Web Framework ใดๆ
* **Application Layer (Use Cases):** แต่ละ Use Case รับผิดชอบ 1 Business Action อย่างชัดเจน (Single Responsibility) ควบคุม Transaction Boundary และ Concurrency Control
* **Infrastructure Layer:** การเชื่อมต่อ PostgreSQL (รองรับทั้ง Server Connection และ In-Memory Engine สำหรับ Test Suite), Repositories และ Scheduled Jobs
* **Presentation Layer:** Controllers และ Routers ของ Fastify พร้อม Schema Validation, JWT Authentication และ Error Handler ที่แปลง Domain Errors เป็น HTTP Response อย่างเป็นมาตรฐาน

---

## 2. โครงสร้างโปรเจกต์ (Project Structure)

```text
library/
├── back-end/                     # Enterprise Backend (Fastify, TypeScript, PostgreSQL)
│   ├── src/
│   │   ├── domain/               # Enterprise Business Rules & Entities
│   │   │   ├── constants/rules.ts# กฎทางธุรกิจและ Enums (Roles, Statuses)
│   │   │   ├── errors/domain-error.ts# Domain Error Definitions
│   │   │   └── services/fine-calculator.ts # สูตรคำนวณค่าปรับ, ค่าเสียหาย, ค่าหนังสือหาย
│   │   ├── application/          # Use Cases (Application Business Rules)
│   │   │   └── use-cases/
│   │   │       ├── borrow-book.use-case.ts
│   │   │       ├── return-book.use-case.ts
│   │   │       ├── renew-book.use-case.ts
│   │   │       ├── reserve-book.use-case.ts
│   │   │       ├── cancel-reservation.use-case.ts
│   │   │       ├── confirm-lost.use-case.ts
│   │   │       ├── pay-fine.use-case.ts
│   │   │       ├── waive-fine.use-case.ts
│   │   │       └── expire-reservations.use-case.ts
│   │   ├── infrastructure/       # Database, External Tools & HTTP Server
│   │   │   ├── database/
│   │   │   │   ├── db.ts         # Connection Pool & In-memory Adapter
│   │   │   │   ├── migrations/   # SQL Schema Migration scripts
│   │   │   │   └── seeds/        # Initial Seed Data script
│   │   │   ├── repositories/     # Repositories for Database Access
│   │   │   │   ├── user.repository.ts
│   │   │   │   ├── book.repository.ts
│   │   │   │   ├── copy.repository.ts
│   │   │   │   ├── loan.repository.ts
│   │   │   │   ├── reservation.repository.ts
│   │   │   │   ├── fine-ledger.repository.ts
│   │   │   │   └── audit-log.repository.ts
│   │   │   └── http/             # Web Framework & Routes
│   │   │       ├── middlewares/  # Auth, RBAC, Error Handler
│   │   │       ├── routes/       # REST Endpoints
│   │   │       └── server.ts     # Fastify Server Bootstrap
│   │   └── index.ts              # Application Entrypoint
│   ├── tests/                    # Automated Test Suites (34/34 Passing)
│   │   ├── fine-calculator.test.ts # Unit Tests สำหรับการคำนวณค่าปรับ
│   │   ├── acceptance.test.ts    # 20 Mandatory Acceptance Scenarios
│   │   ├── concurrency.test.ts   # 100 Concurrent Requests Load Test
│   │   └── api.test.ts           # HTTP End-to-End Tests
│   ├── Dockerfile                # Multi-stage Production Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
│
├── front-end/                    # Glassmorphic Modern Web App (Vite, TypeScript, Vanilla CSS)
│   ├── src/
│   │   ├── api.ts                # Fully Typed REST API Client + Error Toast handling
│   │   ├── auth.ts               # Auth State, JWT Storage & Quick Role Switcher
│   │   ├── main.ts               # SPA Router, Dynamic Rendering & State Management
│   │   └── style.css             # Glassmorphism Design System & Dynamic Animations
│   ├── index.html
│   ├── vite.config.ts            # Proxy /api to http://localhost:3000
│   └── package.json
│
├── docs/
│   ├── er-diagram.md             # ER Diagram ในรูปแบบ Mermaid และ Invariants
│   └── openapi.json              # OpenAPI 3.0 Specification
├── docker-compose.yml            # Multi-container Deployment (PostgreSQL + API)
└── README.md
```

---

## 3. กลยุทธ์การออกแบบเชิงวิศวกรรม 7 ประการ

### 3.1 Database Strategy
* **แยก Book vs Physical Copy:** ออกแบบตาราง `books` (100,000+) เก็บข้อมูลบรรณานุกรม (ISBN, Title, Authors, Categories) แยกจาก `physical_copies` (300,000+) ซึ่งแต่ละเล่มมี `barcode` เฉพาะตัว, ราคาซื้อ และ State Machine ของตนเอง
* **Normalization & Indexing:** ออกแบบตาม 3NF มีตาราง Many-to-Many สำหรับ `book_authors` และ `book_categories` พร้อมวาง Composite B-Tree Index บน Foreign Keys และ Status (`loans(user_id, status)`, `loans(copy_id, status)`, `reservations(book_id, status, created_at)`) เพื่อรองรับ Query บนข้อมูล 5,000,000+ แถวได้อย่างรวดเร็ว

### 3.2 Transaction Strategy
* ทุก Operation สำคัญ (ยืม, คืน, ต่ออายุ, ยืนยันหนังสือหาย, ชำระเงิน, ยกเว้นค่าปรับ) ถูกห่อหุ้มด้วย **ACID Transaction (`BEGIN ... COMMIT / ROLLBACK`)**
* หากขั้นตอนใดล้มเหลว (เช่น ตรวจพบค่าปรับค้างชำระ หรือหนังสือถูกจอง) ระบบจะ Rollback ทันที ทำให้ไม่เกิดสถานะกึ่งกลาง (Partial State) อย่างเด็ดขาด

### 3.3 Concurrency Strategy (การแก้ปัญหา Race Condition & Double Borrow)
* **กลไก 2 ชั้น (Dual-Layer Defense):**
  1. **Pessimistic Row Locking (`SELECT ... FOR UPDATE`):** ล็อกแถวของ Physical Copy ในระดับฐานข้อมูลทันทีที่มี Request เข้ามาขอยืม
  2. **Atomic Compare-and-Swap State Transition:** 
     ```sql
     UPDATE physical_copies
     SET status = 'ON_LOAN', version = version + 1
     WHERE id = $1 AND status IN ('AVAILABLE', 'ON_HOLD')
     RETURNING *
     ```
     หากมีคำขอยืมพร้อมกัน 100 Requests เข้ามาที่ Copy เล่มเดียวกัน คำขอแรกจะเปลี่ยนสถานะสำเร็จ ส่วนอีก 99 คำขอจะกระทบ 0 แถว และถูก Reject ด้วย `409 Conflict (COPY_NOT_AVAILABLE)` ทันที โดยได้รับการพิสูจน์ผ่าน `tests/concurrency.test.ts`

### 3.4 Authentication Strategy
* ใช้ **JWT (JSON Web Token)** ที่มีการลงนามด้วยความปลอดภัยและระบุสิทธิ์
* จัดเก็บรหัสผ่านด้วยการ Hash แบบ **bcrypt (Cost Factor 10)** ห้ามเก็บ Plaintext เด็ดขาด
* Server ตรวจสอบ Signature และดึงข้อมูล Identity จาก Token โดยไม่เชื่อสิทธิ์ที่ Client ส่งมาใน Body

### 3.5 Authorization Strategy (RBAC & Least Privilege)
* **Student & Lecturer Parity:** ทั้งสอง Role ถูกตรวจสอบด้วย Rule เดียวกัน 100% ไม่มีข้อยกเว้น
* **Least Privilege:**
  * `ADMIN` **ไม่ได้รับสิทธิ์ Librarian โดยอัตโนมัติ**
  * `LIBRARIAN` สามารถทำหน้าที่ยืม-คืน-ประเมินความเสียหาย-รับเงินค่าปรับได้ แต่ **ห้ามยกเว้นค่าปรับ (Waive Fine)**
  * การยกเว้นค่าปรับ (`Fine Waiver`) สงวนสิทธิ์เฉพาะ **ADMIN** เท่านั้น และต้องระบุเหตุผลและจำนวนเงินทุกครั้ง

### 3.6 Fine & Ledger Strategy
* **ไม่ใช้ระบบเขียนทับยอดรวม (`total_fine`):** ระบบใช้ **Double-Entry Fine Ledger** แยกบันทึกประเภทรายการชัดเจน (`LATE_FINE`, `LOST_REPLACEMENT`, `PROCESSING_FEE`, `DAMAGE_CHARGE`, `PAYMENT`, `WAIVER`)
* **สูตรยอดค้างชำระ:**
  $$\text{Outstanding Balance} = \sum \text{Charges} - \sum \text{Payments} - \sum \text{Waivers}$$
* **เพดานค่าปรับส่งช้า:** คิด 10 บาท/วัน (ไม่มี Grace Period) และมี Cap สูงสุด 1,000 บาทต่อ 1 Loan
* **No Hard Delete:** ข้อมูลธุรกรรมการเงินและประวัติการยืมห้ามลบเด็ดขาดเพื่อความถูกต้องในการ Audit

### 3.7 Reservation Strategy (FIFO Queue & 48h Hold)
* จองในระดับ Book Record โดยจัดคิวแบบ **First-In, First-Out (FIFO)** ตาม `created_at ASC, id ASC`
* ปฏิเสธการจองทันทีหากยังมี Physical Copy ว่าง (`AVAILABLE`) อยู่ในห้องสมุด
* เมื่อหนังสือถูกคืน ระบบจะเปลี่ยนสถานะ Copy เป็น `ON_HOLD` สำหรับผู้จองคิวแรก มีเวลา 48 ชั่วโมง
* มี Background Job ตรวจจับการหมดอายุ (Expired) เพื่อส่งต่อ Copy ให้คิวถัดไปอัตโนมัติ

---

## 4. การติดตั้งและเริ่มต้นใช้งาน

### ข้อกำหนดเบื้องต้น
* **Node.js** v20+ หรือ v24
* **npm** v10+
* **Docker & Docker Compose** (ทางเลือกสำหรับ Production PostgreSQL)

### วิธีการรันระบบผ่าน Docker Compose (คำสั่งเดียว)
```bash
# รัน PostgreSQL และ API Backend
docker compose up --build
```
ระบบจะเปิดให้บริการที่:
* **API Service:** `http://localhost:3000`
* **Swagger OpenAPI Docs:** `http://localhost:3000/docs`

### วิธีการรันในเครื่อง (Local Development)

#### 1. รันระบบ Back-End API (Port 3000)
```bash
cd back-end

# 1.1 ติดตั้ง Dependencies (หากยังไม่ได้ติดตั้ง)
npm install

# 1.2 สร้าง Build
npm run build

# 1.3 ใส่ข้อมูลเริ่มต้น (Seed Data)
npm run seed

# 1.4 เริ่มรันเซิร์ฟเวอร์
npm start
# หรือโหมด Development (Hot-reload): npm run dev
```
เซิร์ฟเวอร์จะเปิดที่:
- **API Server:** `http://localhost:3000`
- **Swagger Docs:** `http://localhost:3000/docs`

#### 2. รันระบบ Front-End Web App (Port 5173)
```bash
cd front-end

# 2.1 ติดตั้ง Dependencies (หากยังไม่ได้ติดตั้ง)
npm install

# 2.2 เริ่มรัน Web App
npm run dev
```
เว็บแอปจะเปิดที่: `http://localhost:5173` (มี Vite proxy `/api` ไปยัง `http://localhost:3000` อัตโนมัติ)

---

## 5. การทดสอบระบบ (Automated Testing)

ระบบมีชุดทดสอบครอบคลุม Unit Tests, Integration Tests, API Tests, 20 Mandatory Scenarios และ Concurrency Load Test ในโฟลเดอร์ `back-end`:

```bash
cd back-end

# รันชุดทดสอบทั้งหมด (34/34 Passed)
npm test

# รันเฉพาะ 20 Mandatory Acceptance Scenarios
npm run test:acceptance

# รัน Bonus Challenge (100 Concurrent Requests Load Test)
npm run test:concurrency
```

### สรุปผลการทดสอบ Mandatory Acceptance Criteria ทั้ง 20 Scenarios:
| Scenario | รายละเอียดการทดสอบ | ผลลัพธ์ |
| :---: | :--- | :---: |
| 1 | Student มี 4 เล่ม ➔ ยืมเล่มที่ 5 ➔ **SUCCESS (รวม 5)** | ✅ PASS |
| 2 | Student มี 5 เล่ม ➔ ยืมเล่มที่ 6 ➔ **REJECT (Loan Limit Exceeded)** | ✅ PASS |
| 3 | Lecturer มี 5 เล่ม ➔ ยืมเล่มที่ 6 ➔ **REJECT (สิทธิ์เท่า Student)** | ✅ PASS |
| 4 | Student & Lecturer ได้โควตา 5 เล่ม และยืมได้ 14 วันเท่ากัน | ✅ PASS |
| 5 | คืนตรงวัน Due Date ➔ **ค่าปรับ = 0 บาท** | ✅ PASS |
| 6 | คืนช้า 1 วัน ➔ **ค่าปรับ = 10 บาท** | ✅ PASS |
| 7 | คำนวณตามวันได้ 1,250 บาท ➔ **Cap ที่ 1,000 บาท** | ✅ PASS |
| 8 | มีหนังสือ Overdue ค้างอยู่ ➔ ขอยืมเล่มใหม่ ➔ **REJECT** | ✅ PASS |
| 9 | ค่าปรับค้างชำระ 490 บาท ➔ ขอยืมเล่มใหม่ ➔ **SUCCESS** | ✅ PASS |
| 10 | ค่าปรับค้างชำระ 500 บาท ➔ ขอยืมเล่มใหม่ ➔ **REJECT** | ✅ PASS |
| 11 | ค่าปรับ 500 บาท จ่าย 20 บาท (เหลือ 480 บาท) ➔ ยืมใหม่ ➔ **SUCCESS** | ✅ PASS |
| 12 | ต่ออายุ: ครั้งที่ 1 (+7 วัน) ➔ ครั้งที่ 2 (+7 วัน) ➔ ครั้งที่ 3 ➔ **REJECT** | ✅ PASS |
| 13 | หนังสือมีคนอื่นต่อคิวจองอยู่ ➔ พยายามต่ออายุ (Renew) ➔ **REJECT** | ✅ PASS |
| 14 | หนังสือมี 1 Copy ถูกยืมพร้อมกัน ➔ **สำเร็จ 1 คน / ปฏิเสธ 1 คน** | ✅ PASS |
| 15 | A จองก่อน B (FIFO) ➔ เมื่อหนังสือถูกคืน Copy ถูก Hold ให้ A | ✅ PASS |
| 16 | A ไม่มารับใน 48 ชม. ➔ จอง A หมดอายุ ➔ Copy ถูก Hold ให้ B ต่อทันที | ✅ PASS |
| 17 | กำลังยืม Book X อยู่ ➔ ขอยืมอีกเล่มของ Book X ➔ **REJECT (ห้ามยืมเรื่องซ้ำ)** | ✅ PASS |
| 18 | ค่าปรับ 600 บาท ➔ Librarian ขอยกเว้น ➔ **403 FORBIDDEN** ➔ Admin ยกเว้น ➔ **SUCCESS** | ✅ PASS |
| 19 | หนังสือราคา 800 บาท สูญหาย ➔ เรียกเก็บ $800 + 200 + 70 = 1,070$ บาท ➔ ปิด Loan | ✅ PASS |
| 20 | หนังสือราคา 1,200 บาท ส่งคืนแบบ Major Damage ➔ คิด 50% = 600 บาท ➔ Copy เข้า MAINTENANCE | ✅ PASS |

---

## 6. API Documentation

สามารถเข้าชม Interactive Documentation ผ่าน Swagger UI ได้ที่:
`http://localhost:3000/docs`

และสามารถดูไฟล์ OpenAPI Specification ได้ที่:
[docs/openapi.json](file:///c:/Users/fruct/Desktop/library/docs/openapi.json)

---

## 7. ฐานข้อมูลและ ER Diagram

* SQL Schema Migration Script: [001_initial_schema.sql](file:///c:/Users/fruct/Desktop/library/src/infrastructure/database/migrations/001_initial_schema.sql)
