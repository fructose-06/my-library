# UniLib Core — คู่มือการทดสอบระบบผ่าน Swagger UI ด้วยตนเอง (Manual Testing Guide)

เอกสารนี้จัดทำขึ้นสำหรับการทดสอบ API ทุกเส้นของระบบห้องสมุด **UniLib Core** ผ่าน **Swagger UI** แบบ Step-by-Step พร้อม Request Body, Parameters และ Expected Response สำหรับใช้ในการพรีเซนต์หรือทดสอบส่งมอบงาน

---

## 📍 ข้อมูลเริ่มต้นก่อนทดสอบ

- **Swagger UI URL**: [http://localhost:3000/docs](http://localhost:3000/docs)
- **Base API URL**: `http://localhost:3000/api`

### 🔑 บัญชีผู้ใช้สำหรับทดสอบ (Seed Users)
รหัสผ่านของทุกบัญชีคือ: `password123`

| บทบาท (Role) | Email / Identifier | ชื่อ-นามสกุล | User ID | ขอบเขตหน้าที่ตาม Separation of Duties |
| :--- | :--- | :--- | :--- | :--- |
| **STUDENT** | `student1@unilib.ac.th` | Somying Student One | `usr-stu-01` | ยืมหนังสือ (ไม่เกิน 5 เล่ม/14 วัน), จองหนังสือ, ดูประวัติตนเอง |
| **STUDENT** | `student2@unilib.ac.th` | Arthit Student Two | `usr-stu-02` | บัญชีนักศึกษาสำรอง สำหรับทดสอบแย่งยืม/คิวจอง |
| **LECTURER** | `lecturer1@unilib.ac.th` | Prof. Anan Lecturer One | `usr-lec-01` | สิทธิ์เท่าเทียมกับนักศึกษา (Equal Privilege) |
| **LIBRARIAN** | `librarian@unilib.ac.th` | Somchai Library Custodian | `usr-lib-01` | บริการเคาน์เตอร์: ยืมแทนผู้ใช้ (`borrower_id`), ตรวจรับคืนหนังสือ, รับชำระเงินค่าปรับ (**ห้ามยืมให้ตนเอง, ห้ามยกเว้นค่าปรับ**) |
| **ADMIN** | `admin@unilib.ac.th` | Dr. System Administrator | `usr-admin-01` | กำกับดูแลระบบ: ยกเว้นค่าปรับพร้อมระบุเหตุผล, จัดการสถานะผู้ใช้, ตรวจสอบ Audit Log (**ห้ามยืม/จอง/ตรวจรับคืนหนังสือ**) |

---

## 🔐 วิธีการเข้าสู่ระบบและ Authorize บน Swagger UI

1. เปิดเบราว์เซอร์ไปที่ `http://localhost:3000/docs`
2. เลื่อนไปที่แท็ก **`Authentication`** $\rightarrow$ คลิกเลือก `POST /api/auth/login`
3. กดปุ่ม **`Try it out`** ทางขวามือ
4. กรอก Request Body ด้วยอีเมลของผู้ใช้ที่ต้องการทดสอบ เช่น:
   ```json
   {
     "identifier": "student1@unilib.ac.th",
     "password": "password123"
   }
   ```
5. กดปุ่ม **`Execute`**
6. ดูที่ช่อง Response Body จะได้ JSON ตอบกลับ ให้ **ก๊อปปี้ข้อความ Token** (เฉพาะตัวอักษรในเครื่องหมายคำพูดของ `"token": "..."`)
7. เลื่อนขึ้นไปบนสุดของหน้าเว็บ กดปุ่ม **`Authorize` 🔓** สีเขียว (มุมขวาบน)
8. วาง Token ที่ก๊อปปี้มาลงในช่อง **Value** แล้วกดปุ่ม **Authorize** แล้วกด **Close** (แม่กุญแจจะเปลี่ยนเป็น 🔒 แปลว่าเข้าสู่ระบบสำเร็จ)
   > *หมายเหตุ*: เมื่อต้องการเปลี่ยนทดสอบเป็น User อื่น (เช่น สลับจาก Student ไปเป็น Librarian หรือ Admin) ให้กดยิง Login ของ User นั้นใหม่ แล้วกด Authorize $\rightarrow$ Logout $\rightarrow$ วาง Token ใหม่

---

## 🧪 คู่มือทดสอบทีละ Endpoint (แบ่งตาม Use Case สำคัญ)

---

### Flow 1: ยืนยันตัวตน & ตรวจสอบสถานะบัญชี (Authentication)

#### 1.1 `GET /api/auth/me`
- **วัตถุประสงค์**: ดูโปรไฟล์และสิทธิ์การยืม (Standing Check)
- **Token ที่ใช้**: บัญชีใดก็ได้ (เช่น `student1@unilib.ac.th`)
- **วิธีทำ**: คลิกแท็ก `Authentication` $\rightarrow$ `GET /api/auth/me` $\rightarrow$ กด `Try it out` $\rightarrow$ กด `Execute`
- **Expected Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "usr-stu-01",
        "email": "student1@unilib.ac.th",
        "role": "STUDENT",
        "status": "ACTIVE"
      },
      "standing": {
        "active_loans_count": 0,
        "outstanding_fine_balance": 0,
        "has_overdue_loans": false,
        "can_borrow": true
      }
    }
  }
  ```

---

### Flow 2: ค้นหาและดูสต็อกหนังสือ (Catalog & Copies Inventory)

#### 2.1 `GET /api/books`
- **วัตถุประสงค์**: ค้นหารายการหนังสือพร้อมจำนวนเล่มทั้งหมดและเล่มที่ว่าง
- **Parameters**: (สามารถเว้นว่างได้ หรือใส่ `query=Clean`, `available_only=true`)
- **Expected Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "book-clean-arch",
        "isbn": "9780134494166",
        "title": "Clean Architecture: A Craftsman's Guide to Software Structure and Design",
        "available_copies_count": 5,
        "total_copies_count": 5
      }
    ]
  }
  ```

#### 2.2 `GET /api/books/{id}`
- **Parameters**: `id`: `book-clean-arch`
- **Expected Response (200 OK)**: จะแสดงรายละเอียดหนังสือ พร้อมรายการ Physical Copies ทุกเล่มและ Barcode (เช่น `CA-000001`, `CA-000002` ...)

---

### Flow 3: การยืมหนังสือ & การบังคับใช้กฎ Separation of Duties (Circulation)

#### 3.1 นักศึกษายืมหนังสือเล่มที่ว่าง (Happy Path)
- **Token ที่ใช้**: `student1@unilib.ac.th`
- **Endpoint**: `POST /api/circulation/borrow`
- **Request Body**:
  ```json
  {
    "barcode": "CA-000001"
  }
  ```
- **Expected Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "loan-xxx",
      "user_id": "usr-stu-01",
      "copy_id": "copy-ca-01",
      "due_date": "2026-09-20T...",
      "renewal_count": 0,
      "status": "ACTIVE"
    }
  }
  ```
  *(ก๊อปปี้ค่า `id` ของ Loan นี้เก็บไว้สำหรับทดสอบคืนใน Flow ถัดไป)*

#### 3.2 กฎห้ามยืมหนังสือชื่อเรื่องเดียวกันซ้ำ (Duplicate Title Rule)
- **Token ที่ใช้**: `student1@unilib.ac.th`
- **Endpoint**: `POST /api/circulation/borrow`
- **Request Body** (พยายามยืมเล่มที่ 2 ของ Clean Architecture):
  ```json
  {
    "barcode": "CA-000002"
  }
  ```
- **Expected Response (409 Conflict)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "DUPLICATE_BOOK_LOAN",
      "message": "User already has an active loan for this book title"
    }
  }
  ```

#### 3.3 Separation of Duties: Admin ห้ามยืมหนังสือ
- **Token ที่ใช้**: เปลี่ยนเป็น `admin@unilib.ac.th`
- **Endpoint**: `POST /api/circulation/borrow`
- **Request Body**:
  ```json
  {
    "barcode": "CA-000002"
  }
  ```
- **Expected Response (403 Forbidden)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "FORBIDDEN",
      "message": "Administrators are not permitted to borrow books"
    }
  }
  ```

#### 3.4 Separation of Duties: บรรณารักษ์ยืมแทนผู้ใช้ vs ยืมให้ตนเอง
- **Token ที่ใช้**: เปลี่ยนเป็น `librarian@unilib.ac.th`
- **Endpoint**: `POST /api/circulation/borrow`
- **ทดสอบกรณี 1 (ยืมให้ตนเอง ไม่ใส่ borrower_id)**:
  ```json
  { "barcode": "CA-000002" }
  ```
  $\rightarrow$ **Expected Response (403 Forbidden)**: `Librarians cannot borrow books for themselves. Please specify borrower_id to borrow on behalf of a student or lecturer`
- **ทดสอบกรณี 2 (ยืมแทนนักศึกษาคนที่ 2 อย่างถูกต้อง)**:
  ```json
  {
    "barcode": "CA-000002",
    "borrower_id": "usr-stu-02"
  }
  ```
  $\rightarrow$ **Expected Response (201 Created)**: ยืมสำเร็จในนามของ `usr-stu-02`

---

### Flow 4: การต่ออายุหนังสือ (Renewal)

#### 4.1 `POST /api/circulation/renew/{loanId}`
- **Token ที่ใช้**: `student1@unilib.ac.th`
- **Parameters**: `loanId`: ใส่ Loan ID ของ Student 1
- **Expected Response (200 OK)**:
  - `due_date` ขยายเวลาเพิ่ม 7 วันปฏิทิน
  - `renewal_count`: เปลี่ยนเป็น `1`
  - หากกดย้ำครั้งที่ 2 จะกลายเป็น `renewal_count`: `2`
  - หากกดย้ำครั้งที่ 3 จะได้ **400 Bad Request** (`Loan has reached maximum renewal limit (2 times)`)

---

### Flow 5: การจองหนังสือเมื่อไม่มีเล่มว่าง (Reservation FIFO Queue)

#### 5.1 `POST /api/reservations`
- **เงื่อนไข**: หนังสือเรื่องนั้นต้องไม่มี Physical Copy สถานะ `AVAILABLE` เหลืออยู่ (ถ้ายังมีเล่มว่าง ระบบจะปฏิเสธไม่ให้จองเพื่อป้องกันการกักตุน)
- **Token ที่ใช้**: `student1@unilib.ac.th` หรือ `student2@unilib.ac.th`
- **Request Body**:
  ```json
  {
    "book_id": "book-db-internals"
  }
  ```
- **Expected Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "res-xxx",
      "book_id": "book-db-internals",
      "queue_position": 1,
      "status": "PENDING"
    }
  }
  ```

#### 5.2 ดูคิวการจอง `GET /api/reservations/book/{bookId}/queue`
- **Parameters**: `bookId`: `book-db-internals`
- **Expected Response (200 OK)**: แสดงลำดับคิวของหนังสือเล่มนี้เรียงตาม FIFO

---

### Flow 6: การคืนหนังสือและการคิดค่าปรับ (Return & Fine Assessment)

#### 6.1 นักศึกษาพยายามกดคืนเอง
- **Token ที่ใช้**: `student1@unilib.ac.th`
- **Endpoint**: `POST /api/circulation/return`
- **Request Body**:
  ```json
  { "loan_id": "loan-xxx" }
  ```
- **Expected Response (403 Forbidden)**: คืนไม่ได้ เพราะการตรวจสภาพหนังสือและรับคืนต้องทำผ่านบรรณารักษ์ที่เคาน์เตอร์เท่านั้น

#### 6.2 บรรณารักษ์ตรวจรับคืนแบบปกติ
- **Token ที่ใช้**: `librarian@unilib.ac.th`
- **Endpoint**: `POST /api/circulation/return`
- **Request Body**:
  ```json
  {
    "loan_id": "loan-xxx",
    "condition": "NORMAL"
  }
  ```
- **Expected Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "loan": { "status": "RETURNED" },
      "lateFine": 0,
      "damageCharge": 0,
      "copyStatus": "AVAILABLE"
    }
  }
  ```

#### 6.3 บรรณารักษ์ตรวจรับคืนแบบเกินกำหนดส่ง (Overdue Simulation)
- **Request Body** (ใส่วันที่คืนในอนาคตเพื่อจำลองการส่งช้า):
  ```json
  {
    "loan_id": "loan-xxx",
    "condition": "NORMAL",
    "return_date": "2026-10-01T12:00:00Z"
  }
  ```
- **Expected Response (200 OK)**:
  - ระบบจะคำนวณวันส่งช้าอัตโนมัติ (วันละ 10 บาท ไม่เกิน 1,000 บาท)
  - ลงบันทึกค่าปรับเข้าสู่ `fine_ledger` ทันที

---

### Flow 7: การชำระเงินและการยกเว้นค่าปรับ (Fines & Financial Governance)

#### 7.1 ตรวจสอบยอดหนี้คงเหลือ `GET /api/fines/my-fines`
- **Token ที่ใช้**: `student1@unilib.ac.th`
- **Expected Response (200 OK)**: แสดงรายการหนี้สินทั้งหมดใน `charges`, ประวัติการจ่ายใน `payments`, และยอดรวม `outstanding_balance`

#### 7.2 บรรณารักษ์พยายามยกเว้นค่าปรับ (Separation of Duties)
- **Token ที่ใช้**: `librarian@unilib.ac.th`
- **Endpoint**: `POST /api/fines/waive`
- **Request Body**:
  ```json
  {
    "user_id": "usr-stu-01",
    "amount": 20,
    "reason": "Librarian waive attempt"
  }
  ```
- **Expected Response (403 Forbidden)**: บรรณารักษ์ไม่มีอำนาจทางบัญชีในการยกเว้นหนี้

#### 7.3 Admin อนุมัติการยกเว้นค่าปรับพร้อมระบุเหตุผล
- **Token ที่ใช้**: `admin@unilib.ac.th`
- **Endpoint**: `POST /api/fines/waive`
- **Request Body**:
  ```json
  {
    "user_id": "usr-stu-01",
    "amount": 20,
    "reason": "Medical certificate approved by Dean"
  }
  ```
- **Expected Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "waiver": {
        "amount_waived": 20,
        "reason": "Medical certificate approved by Dean",
        "approved_by": "usr-admin-01"
      },
      "newOutstanding": 30
    }
  }
  ```

#### 7.4 บรรณารักษ์รับชำระเงินค่าปรับ (Cash Payment)
- **Token ที่ใช้**: `librarian@unilib.ac.th`
- **Endpoint**: `POST /api/fines/pay`
- **Request Body**:
  ```json
  {
    "user_id": "usr-stu-01",
    "amount": 30,
    "notes": "Cash payment at Circulation Desk"
  }
  ```
- **Expected Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "payment": {
        "amount_paid": 30,
        "received_by": "usr-lib-01"
      },
      "newOutstanding": 0
    }
  }
  ```

---

### Flow 8: การตรวจสอบ Audit Log และรายงานระบบ (Governance & Reports)

#### 8.1 Admin ดู Audit Logs ย้อนหลังทั้งหมด
- **Token ที่ใช้**: `admin@unilib.ac.th`
- **Endpoint**: `GET /api/admin/audit-logs`
- **Parameters**: `limit=20`, `offset=0`
- **Expected Response (200 OK)**: จะเห็นประวัติทุกอย่างที่ทำไปข้างต้น (BORROW_BOOK, RETURN_BOOK, WAIVE_FINE, PAY_FINE) พร้อม Actor ID, IP Address, วันเวลา และ JSON Details อย่างครบถ้วน

#### 8.2 รายงานสรุปสต็อกคงคลัง
- **Token ที่ใช้**: `librarian@unilib.ac.th` หรือ `admin@unilib.ac.th`
- **Endpoint**: `GET /api/reports/inventory`
- **Expected Response (200 OK)**: สรุปจำนวนเล่มแยกตามสถานะ (AVAILABLE, ON_LOAN, ON_HOLD, MAINTENANCE ฯลฯ)

---

## 💡 สรุปสถานะ HTTP Response Code ที่ควรจำเวลาพรีเซนต์

| HTTP Code | ความหมาย | ตัวอย่างสถานการณ์ในระบบ UniLib |
| :--- | :--- | :--- |
| **`200 OK`** | สำเร็จ | ดึงข้อมูล, ตรวจรับคืนหนังสือ, จ่ายค่าปรับ, ยกเว้นค่าปรับ |
| **`201 Created`** | สร้างรายการสำเร็จ | ยืมหนังสือใหม่, สร้างการจองคิว |
| **`400 Bad Request`** | ข้อมูลหรือเงื่อนไขผิด | ต่ออายุเกิน 2 ครั้ง, จำนวนเงินติดลบ, ยกเว้นค่าปรับโดยไม่ใส่เหตุผล |
| **`401 Unauthorized`** | ยังไม่ได้ใส่ Token หรือ Token หมดอายุ | ลืมกด Authorize บน Swagger |
| **`403 Forbidden`** | สิทธิ์ไม่เพียงพอ (SoD) | Admin พยายามยืมหนังสือ, Librarian พยายามยกเว้นค่าปรับ |
| **`404 Not Found`** | ไม่พบข้อมูล | ระบุ Barcode, Book ID หรือ Loan ID ที่ไม่มีในระบบ |
| **`409 Conflict`** | ขัดแย้งกับกฎธุรกิจหรือการชนกัน | ยืมหนังสือเรื่องซ้ำ, แย่งยืมเล่มเดียวกันในเสี้ยววินาที (OCC) |
