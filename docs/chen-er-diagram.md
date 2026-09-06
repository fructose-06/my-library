# UniLib Core — Peter Chen ER Diagram (Conceptual Model)

เอกสารอธิบายแผนภาพ **Chen's ER Diagram (Entity-Relationship Model ตามมาตรฐานของ Peter Chen)** สำหรับระบบ **UniLib Core (University Library Management System)**

ไฟล์ Diagram ในรูปแบบ **Draw.io (`.drawio`)** พร้อมเปิดและแก้ไขได้ทันทีอยู่ที่:
📁 **[`docs/chen-er-diagram.drawio`](file:///c:/Users/fruct/Desktop/library/docs/chen-er-diagram.drawio)**

---

## 1. วิธีเปิดไฟล์ใน Draw.io (app.diagrams.net)

1. เข้าเว็บเบราว์เซอร์ไปที่ **[app.diagrams.net](https://app.diagrams.net)** (หรือ **[draw.io](https://draw.io)**)
2. เลือก **"Open Existing Diagram"** (หรือไปที่เมนู `File` -> `Open From` -> `Device...`)
3. เลือกไฟล์ **`c:\Users\fruct\Desktop\library\docs\chen-er-diagram.drawio`**
4. แผนภาพจะแสดงผลอย่างสวยงาม พร้อมสัญลักษณ์ Chen Notation ครบถ้วน สามารถซูม ลากย้าย ปรับแต่ง หรือ Export เป็นรูปภาพ PNG/SVG/PDF ได้ทันที

---

## 2. สัญลักษณ์ Chen Notation ที่ใช้ในระบบ (Legend)

| สัญลักษณ์ (Symbol) | รูปร่าง (Shape) | ความหมายในระบบ UniLib Core | ตัวอย่างในระบบ |
| :--- | :--- | :--- | :--- |
| **Regular Entity** | สี่เหลี่ยมผืนผ้า (Rectangle) | เอนทิตีที่มีอยู่ได้ด้วยตัวเอง | `USER`, `BOOK`, `AUTHOR`, `CATEGORY`, `LOAN`, `RESERVATION` |
| **Weak Entity** | สี่เหลี่ยมผืนผ้าซ้อน 2 ชั้น (Double Rectangle) | เอนทิตีที่การมีอยู่ขึ้นต่อเอนทิตีอื่น (Existence Dependency) | `PHYSICAL_COPY` (ขึ้นอยู่กับ `BOOK`) |
| **Relationship** | สี่เหลี่ยมข้าวหลามตัด (Diamond) | ความสัมพันธ์ระหว่างเอนทิตี | `WRITTEN_BY`, `BORROWS`, `INCURS`, `PLACES_RES` |
| **Identifying Relationship** | สี่เหลี่ยมข้าวหลามตัดซ้อน 2 ชั้น (Double Diamond) | ความสัมพันธ์ที่ระบุตัวตนของ Weak Entity | `HAS_COPIES` (เชื่อมระหว่าง `BOOK` และ `PHYSICAL_COPY`) |
| **Key Attribute** | วงรีขีดเส้นใต้ (Underlined Oval) | คุณลักษณะที่เป็น Primary Key | `id`, `isbn`, `barcode`, `university_id` |
| **Regular Attribute** | วงรีเดี่ยว (Oval) | คุณลักษณะทั่วไปของเอนทิตี | `title`, `full_name`, `borrow_date`, `status` |
| **Derived Attribute** | วงรีเส้นประ (Dashed Oval) | ค่าที่ได้จากการคำนวณ ไม่ได้เก็บเป็นฟิลด์ตรงๆ ใน DB | `calculated_fine`, `outstanding_balance`, `active_loans_count` |
| **Cardinality Ratio** | ตัวเลขกำกับบนเส้น (`1`, `N`, `M`) | สัดส่วนความสัมพันธ์ระหว่างเอนทิตี | `1:N` (User กับ Loan), `M:N` (Book กับ Author) |
| **Total Participation** | เส้นคู่ / เส้นหนา (Double Line) | การเข้าร่วมแบบสมบูรณ์ (ต้องมีเสมอ) | `PHYSICAL_COPY` ต้องผูกกับ `BOOK` เสมอ |

---

## 3. รายละเอียดเอนทิตีและความสัมพันธ์ (11 Entities Mapping)

### 3.1 Catalog Subsystem
1. **BOOK (Entity)**
   - **Key Attributes:** `id` (PK), `isbn` (Alternate Candidate Key)
   - **Attributes:** `title`, `description`, `publisher`, `publication_year`, `language`, `status`
   - **Relationships:**
     - `WRITTEN_BY` (M:N) กับ `AUTHOR`
     - `CLASSIFIED_AS` (M:N) กับ `CATEGORY`
     - `HAS_COPIES` (1:N, Identifying) กับ `PHYSICAL_COPY`
     - `TARGET_BOOK` (1:N) กับ `RESERVATION`

2. **AUTHOR (Entity)**
   - **Key Attribute:** `id` (PK)
   - **Attribute:** `name`

3. **CATEGORY (Entity)**
   - **Key Attribute:** `id` (PK)
   - **Attribute:** `name`

4. **PHYSICAL_COPY (Weak Entity)**
   - **Key Attributes:** `barcode` (Unique Key), `id` (PK)
   - **Attributes:** `acquisition_price`, `acquisition_date`, `status`, `version`
   - **Relationships:**
     - `OF_COPY` (1:N) กับ `LOAN`
     - `ALLOCATED_TO` (0..1:1) กับ `RESERVATION` (เมื่อเปลี่ยนสถานะเป็น `ON_HOLD`)

---

### 3.2 User & Security Subsystem
5. **USER (Entity)**
   - **Key Attributes:** `id` (PK), `university_id` (Unique ID)
   - **Attributes:** `email`, `password_hash`, `full_name`, `role`, `status`
   - **Derived Attributes:**
     - `outstanding_balance` = $\sum \text{Charges} - \sum \text{Payments} - \sum \text{Waivers}$
     - `active_loans_count` = จำนวน Loan ที่ `status = 'ACTIVE'`
   - **Relationships:**
     - `BORROWS` (1:N) กับ `LOAN`
     - `PLACES_RES` (1:N) กับ `RESERVATION`
     - `INCURS` (1:N) กับ `FINE_LEDGER`
     - `MAKES_PAYMENT` (1:N) กับ `PAYMENT`
     - `RECEIVES_WAIVER` (1:N) กับ `WAIVER`
     - `LOGS_ACTION` (1:N) กับ `AUDIT_LOG`

---

### 3.3 Circulation & Reservation Subsystem
6. **LOAN (Entity)**
   - **Key Attribute:** `id` (PK)
   - **Attributes:** `borrow_date`, `due_date`, `return_date`, `renewal_count`, `status`
   - **Derived Attribute:** `calculated_fine` (คิด 10 บาท/วัน เพดาน 1,000 บาท)
   - **Relationships:**
     - `BORROWS` (N:1) มาจาก `USER`
     - `OF_COPY` (N:1) มาจาก `PHYSICAL_COPY`
     - `ASSESSED_FROM` (1:N) ไปยัง `FINE_LEDGER`

7. **RESERVATION (Entity)**
   - **Key Attribute:** `id` (PK)
   - **Attributes:** `queue_position` (FIFO), `status`, `hold_expires_at`, `created_at`
   - **Relationships:**
     - `PLACES_RES` (N:1) มาจาก `USER`
     - `TARGET_BOOK` (N:1) มาจาก `BOOK`
     - `ALLOCATED_TO` (0..1:1) เชื่อมโยงกับ `PHYSICAL_COPY` ที่ถูกล็อก 48 ชั่วโมง

---

### 3.4 Finance & Audit Subsystem
8. **FINE_LEDGER (Entity / Ledger)**
   - **Key Attribute:** `id` (PK)
   - **Attributes:** `charge_type` (`LATE_FINE`, `LOST_REPLACEMENT`, `PROCESSING_FEE`, `DAMAGE_CHARGE`), `amount`, `status`
   - **Relationships:**
     - `INCURS` (N:1) ผูกกับ `USER`
     - `ASSESSED_FROM` (N:0..1) ผูกกับ `LOAN`

9. **PAYMENT (Entity)**
   - **Key Attribute:** `id` (PK)
   - **Attributes:** `amount_paid`, `created_at`, `notes`
   - **Relationships:**
     - `MAKES_PAYMENT` (N:1) จ่ายโดย `USER` (Student/Lecturer)
     - รับเงินโดย `USER` (Librarian)

10. **WAIVER (Entity)**
    - **Key Attribute:** `id` (PK)
    - **Attributes:** `amount_waived`, `reason`, `created_at`
    - **Relationships:**
      - `RECEIVES_WAIVER` (N:1) ยกเว้นให้แก่ `USER` (Debtor)
      - อนุมัติโดย `USER` (Admin เฉพาะสิทธิ์ Admin เท่านั้น)

11. **AUDIT_LOG (Entity)**
    - **Key Attribute:** `id` (PK)
    - **Attributes:** `action`, `resource_type`, `resource_id`, `created_at`, `ip_address`
    - **Relationships:**
      - `LOGS_ACTION` (N:0..1) กระทำโดย `USER` (Actor)
