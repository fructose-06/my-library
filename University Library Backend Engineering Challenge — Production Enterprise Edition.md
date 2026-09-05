# University Library Backend Engineering Challenge

## 1. ชื่อโจทย์

**UniLib Core — University Library Management Backend System**

### Challenge Type
Backend Engineering / Database Design / API Design / System Architecture

### Difficulty
**Advanced — Competition / Production-Grade Backend**

---

# 2. สถานการณ์

มหาวิทยาลัยแห่งหนึ่งมีนักศึกษาและบุคลากรมากกว่า 20,000 คน และมีหนังสือภายในหอสมุดมากกว่า 100,000 เล่ม

ในปัจจุบัน ระบบห้องสมุดเดิมยังมีการทำงานบางส่วนผ่าน Spreadsheet และระบบฐานข้อมูลเก่าที่ไม่สามารถตรวจสอบข้อมูลย้อนหลังได้อย่างถูกต้อง

ปัญหาที่เกิดขึ้น เช่น

- หนังสือเล่มเดียวถูกบันทึกว่ายืมโดยผู้ใช้มากกว่า 1 คน
- ไม่สามารถตรวจสอบได้ว่าใครเป็นผู้เปลี่ยนสถานะหนังสือ
- การคำนวณค่าปรับไม่ตรงกันระหว่างบรรณารักษ์
- หนังสือบางรายการมีหลายเล่ม แต่ระบบมองเป็นหนังสือเพียงรายการเดียว
- ไม่สามารถจัดลำดับคิวการจองได้อย่างถูกต้อง
- ผู้ใช้งานบางรายสามารถยืมหนังสือเกินจำนวนที่กำหนด
- มีการแก้ไขประวัติการยืมย้อนหลังโดยไม่มีหลักฐาน
- ไม่มี API กลางสำหรับเชื่อมต่อกับ Mobile Application และ Web Application
- ไม่มีระบบ Role-Based Access Control ที่ชัดเจน
- ระบบเดิมเกิด Race Condition เมื่อมีการยืมหนังสือพร้อมกัน
- ข้อมูลการชำระค่าปรับไม่สามารถ Audit ย้อนหลังได้

มหาวิทยาลัยจึงมีโครงการพัฒนา Backend ใหม่ในชื่อ

# **UniLib Core**

เพื่อเป็นระบบ Backend กลางสำหรับระบบห้องสมุดของมหาวิทยาลัย

ผู้เข้าแข่งขันได้รับหน้าที่ออกแบบและพัฒนา Backend System ตั้งแต่ต้น โดยจะได้รับเพียง **Business Requirements** เท่านั้น

ผู้เข้าแข่งขันต้องเป็นผู้ออกแบบเองทั้งหมด ได้แก่

- Database
- Tables
- Columns
- Relationships
- Constraints
- Indexes
- ER Diagram
- API Endpoint
- Request / Response Structure
- Authentication
- Authorization
- Transaction Strategy
- Error Handling
- Application Architecture
- Source Code Structure
- Validation
- Audit Logging
- Testing Strategy

โจทย์นี้ **ไม่มี Database Schema และ Endpoint สำเร็จรูปให้**

---

# 3. เป้าหมายหลักของระบบ

ระบบต้องสามารถบริหารจัดการวงจรชีวิตหนังสือได้ตั้งแต่

**ลงทะเบียนหนังสือ → เพิ่มเล่มจริง → ค้นหา → จอง → ยืม → ต่ออายุ → คืน → ค่าปรับ → ชำระเงิน → Audit**

พร้อมรองรับการใช้งานพร้อมกันจากผู้ใช้จำนวนมาก โดยข้อมูลต้องไม่ผิดพลาดแม้มี Concurrent Requests เกิดขึ้นในเวลาเดียวกัน

---

# 4. Role ของระบบ

ระบบมีทั้งหมด **4 Roles**

1. นักศึกษา — `STUDENT`
2. อาจารย์ — `LECTURER`
3. บรรณารักษ์ — `LIBRARIAN`
4. ผู้ดูแลระบบ — `ADMIN`

---

# 5. กฎสำคัญเกี่ยวกับ Student และ Lecturer

## STUDENT และ LECTURER มีสิทธิ์ด้านห้องสมุดเท่ากันทุกประการ

แม้ระบบต้องเก็บ Role แยกกัน แต่

> Student และ Lecturer ต้องไม่มีความแตกต่างด้านสิทธิ์ในการยืมหนังสือ

ดังนั้นทั้งสอง Role ต้องใช้กฎเดียวกันทั้งหมด เช่น

- จำนวนหนังสือสูงสุด
- ระยะเวลาการยืม
- จำนวนครั้งในการต่ออายุ
- จำนวนการจองสูงสุด
- ค่าปรับ
- การถูกระงับสิทธิ์
- กฎหนังสือสูญหาย
- กฎหนังสือเสียหาย

ห้ามสร้างสิทธิพิเศษ เช่น

> Lecturer ยืมได้นานกว่า Student

หรือ

> Lecturer ยืมได้มากกว่า Student

ถือว่าผิด Requirement

ในเชิง Domain สามารถมองทั้งสอง Role เป็นกลุ่ม

**Borrower**

แต่ Database จะต้องสามารถระบุได้อย่างชัดเจนว่าบุคคลนั้นเป็น `STUDENT` หรือ `LECTURER`

---

# 6. ความแตกต่างระหว่าง Book และ Physical Copy

ระบบต้องแยกแนวคิดระหว่าง

### Book / Bibliographic Record

หมายถึงข้อมูลหนังสือ เช่น

- ISBN
- ชื่อหนังสือ
- ผู้แต่ง
- สำนักพิมพ์
- ปีที่พิมพ์
- หมวดหมู่

กับ

### Physical Book Copy

หมายถึงหนังสือจริงแต่ละเล่มที่ห้องสมุดครอบครอง

ตัวอย่าง

> Clean Architecture  
> ISBN: 9780134494166

ห้องสมุดมีหนังสือนี้จำนวน 5 เล่ม

ระบบจึงต้องมี

- Book Record = 1 รายการ
- Physical Copy = 5 รายการ

แต่ละ Physical Copy ต้องมี **Barcode / Unique Identifier ของตนเอง**

ตัวอย่าง

- CA-000001
- CA-000002
- CA-000003
- CA-000004
- CA-000005

และแต่ละ Copy สามารถมีสถานะต่างกันได้

เช่น

| Copy | Status |
|---|---|
| CA-000001 | AVAILABLE |
| CA-000002 | ON_LOAN |
| CA-000003 | ON_HOLD |
| CA-000004 | MAINTENANCE |
| CA-000005 | LOST |

ผู้เข้าแข่งขันต้องออกแบบ Database Relationship สำหรับปัญหานี้ด้วยตนเอง

---

# 7. ข้อมูลหนังสือขั้นต่ำ

Book Record อย่างน้อยต้องสามารถรองรับ

- ISBN-13
- Title
- Description
- Publisher
- Publication Year
- Authors
- Categories
- Language
- Created At
- Updated At
- สถานะการใช้งานของรายการหนังสือ

หนังสือ 1 เล่มสามารถมีผู้แต่งได้มากกว่า 1 คน

หนังสือ 1 เล่มสามารถอยู่ในหมวดหมู่ได้มากกว่า 1 หมวดหมู่

ผู้เข้าแข่งขันต้องออกแบบ Cardinality และ Relation เอง

---

# 8. ข้อมูล Physical Copy

Physical Copy แต่ละรายการอย่างน้อยต้องมี

- Unique Barcode
- Book ที่ Copy นี้สังกัด
- Acquisition Price
- Acquisition Date
- Current Status
- Created At
- Updated At

`Acquisition Price` ต้องเป็นค่ามากกว่า 0

จำนวนเงินทุกประเภทในระบบใช้หน่วย

**Thai Baht — THB**

และรองรับทศนิยม 2 ตำแหน่ง

---

# 9. สถานะ Physical Copy

ระบบอย่างน้อยต้องรองรับ

- `AVAILABLE`
- `ON_LOAN`
- `ON_HOLD`
- `MAINTENANCE`
- `LOST`
- `RETIRED`

ผู้เข้าแข่งขันสามารถออกแบบ State Machine เพิ่มเติมได้ แต่ต้องไม่ขัด Business Rules ที่กำหนด

---

# 10. กฎการยืมหนังสือ

Student และ Lecturer สามารถมีหนังสือที่กำลังยืมอยู่ได้สูงสุด

# **5 Copies ต่อคน**

ตัวอย่าง

ผู้ใช้มี Active Loan อยู่แล้ว 5 เล่ม

พยายามยืมเล่มที่ 6

ระบบต้อง **Reject**

แม้ว่าหนังสือเล่มที่ 6 จะมีสถานะ `AVAILABLE`

---

# 11. ระยะเวลาการยืม

หนังสือทุกประเภทมีระยะเวลายืมมาตรฐาน

# **14 Calendar Days**

นับจากวันที่ทำรายการยืม

ตัวอย่าง

Borrow Date

> 1 September 2026

Due Date

> 15 September 2026

สามารถคืนได้จนถึงวันที่ 15 September โดยยังไม่ถือว่าเกินกำหนด

---

# 12. Timezone มาตรฐาน

Business Date ทั้งหมดของระบบให้ใช้

# `Asia/Bangkok`

การคำนวณวันยืม วันคืน และค่าปรับต้องอ้างอิง Timezone นี้

ห้ามใช้ Timezone ของ Client เป็นตัวตัดสิน Business Rule

---

# 13. Calendar Day

การคำนวณวันยืมและวันเกินกำหนดใช้

**Calendar Day**

ดังนั้น

- วันเสาร์
- วันอาทิตย์
- วันหยุดราชการ
- วันหยุดมหาวิทยาลัย

ยังคงถูกนับตามปกติ

ไม่ต้องพัฒนาระบบปฏิทินวันหยุด

---

# 14. การต่ออายุ — Renewal

หนังสือแต่ละ Loan สามารถต่ออายุได้สูงสุด

# **2 ครั้ง**

แต่ละครั้งเพิ่ม Due Date

# **7 Calendar Days**

โดยเพิ่มจาก Due Date ปัจจุบัน

ตัวอย่าง

Due Date เดิม

> 15 September

Renew ครั้งที่ 1

> 22 September

Renew ครั้งที่ 2

> 29 September

Renew ครั้งที่ 3

> Reject

---

# 15. เงื่อนไขที่ห้ามต่ออายุ

ไม่สามารถต่ออายุได้ หากเกิดอย่างน้อยหนึ่งกรณีต่อไปนี้

1. Loan เกินกำหนดแล้ว
2. ต่ออายุครบ 2 ครั้งแล้ว
3. หนังสือ Book เดียวกันมี Reservation Queue จากผู้ใช้อื่นอยู่
4. Account ถูก Disabled
5. ผู้ใช้มีค่าปรับค้างชำระตั้งแต่ 500 บาทขึ้นไป
6. ผู้ใช้มีหนังสืออื่นที่กำลัง Overdue อยู่

การตรวจสอบต้องเกิดขึ้นฝั่ง Server เท่านั้น

---

# 16. ห้ามยืมหนังสือชื่อเดียวกันซ้ำ

Borrower 1 คนไม่สามารถถือ Physical Copy มากกว่า 1 Copy ของ Book Record เดียวกันพร้อมกันได้

ตัวอย่าง

Clean Architecture มี 5 Copies

Park กำลังยืม Copy #1 อยู่

แม้ Copy #2 จะ `AVAILABLE`

Park ก็ไม่สามารถยืม Clean Architecture เพิ่มอีกเล่มได้

---

# 17. กฎค่าปรับกรณีคืนเกินกำหนด

คืนเกินกำหนดคิดค่าปรับ

# **10 บาท / Copy / Calendar Day**

ไม่มี Grace Period

สูตรพื้นฐาน

```text
Late Days = max(0, Return Date - Due Date)

Late Fine = Late Days × 10
```

โดยค่าปรับ Late Fine สูงสุดของ Loan หนึ่งรายการคือ

# **1,000 บาท**

---

# 18. ตัวอย่างค่าปรับ

Due Date

> 10 September

คืนวันที่

> 10 September

ค่าปรับ

> 0 บาท

---

Due Date

> 10 September

คืนวันที่

> 11 September

Late Days

> 1

ค่าปรับ

> 10 บาท

---

Due Date

> 10 September

คืนวันที่

> 17 September

Late Days

> 7

ค่าปรับ

> 70 บาท

---

หากคำนวณตามจำนวนวันแล้วได้ 1,300 บาท

ให้เรียกเก็บเพียง

> 1,000 บาท

เนื่องจากถึงเพดานค่าปรับของ Loan แล้ว

---

# 19. หนังสือที่ยังไม่คืน

ถ้าหนังสือยังไม่ถูกคืน

ระบบต้องสามารถแสดง **Accrued Late Fine** ณ วันที่เรียกดูข้อมูลได้

ตัวอย่าง

Due Date

> 1 September

วันที่ปัจจุบัน

> 11 September

จะมีค่าปรับสะสม

> 100 บาท

แม้ Transaction การคืนยังไม่เกิดขึ้น

เมื่อหนังสือถูกคืน จึงทำการ Finalize ค่าปรับของ Loan นั้น

---

# 20. เงื่อนไขการระงับสิทธิ์จาก Overdue

หาก Borrower มีหนังสือที่กำลังเกินกำหนดอย่างน้อย 1 เล่ม

Borrower คนนั้น

**ห้าม**

- ยืมหนังสือใหม่
- ต่ออายุหนังสือ

จนกว่าหนังสือ Overdue ทั้งหมดจะถูกคืนหรือจัดการตามกระบวนการ Lost

---

# 21. เงื่อนไขจากค่าปรับค้างชำระ

หาก Outstanding Balance รวมของผู้ใช้มีค่า

# **ตั้งแต่ 500 บาทขึ้นไป**

ผู้ใช้จะไม่สามารถ

- Borrow
- Renew
- Create Reservation

ได้

จนกว่า Outstanding Balance จะเหลือต่ำกว่า 500 บาท

---

# 22. การจองหนังสือ — Reservation

Reservation ทำในระดับ

# **Book**

ไม่ใช่ Physical Copy

ตัวอย่าง

Clean Architecture มี 4 Copies

แต่ทุก Copy ถูกยืมหมด

ผู้ใช้สามารถจอง

> Clean Architecture

โดยไม่จำเป็นต้องรู้ว่าจะได้ Barcode ใด

---

# 23. เงื่อนไขการจอง

Borrower สามารถมี Active Reservation ได้สูงสุด

# **3 รายการ**

ผู้ใช้ไม่สามารถจอง Book ที่ตนเองกำลังยืมอยู่ได้

และไม่สามารถสร้าง Reservation ซ้ำสำหรับ Book เดียวกันได้

---

# 24. หนังสือที่ยังมี Copy พร้อมให้ยืม

ถ้า Book นั้นมี Physical Copy ที่สามารถ Borrow ได้ทันที

ระบบต้อง Reject การสร้าง Reservation ใหม่

เนื่องจากผู้ใช้สามารถไปยืมหนังสือได้ทันที

---

# 25. Reservation Queue

กรณีมีผู้ใช้หลายคนจองหนังสือเดียวกัน

ระบบต้องจัดลำดับแบบ

# **FIFO — First In, First Out**

ใช้เวลาที่สร้าง Reservation เป็นลำดับหลัก

หากเวลาเท่ากัน ต้องมี Deterministic Tie-Breaker ที่สามารถระบุลำดับได้แน่นอน

---

# 26. การคืนหนังสือที่มี Queue

เมื่อ Physical Copy ถูกคืน

หากไม่มี Reservation

```text
ON_LOAN
   ↓
AVAILABLE
```

หากมี Reservation Queue

```text
ON_LOAN
   ↓
ON_HOLD
```

และ Copy นั้นจะถูก Allocate ให้ผู้ที่อยู่ลำดับแรกของ Queue

---

# 27. Reservation Hold Period

เมื่อระบบ Allocate Copy ให้ผู้จอง

ผู้ใช้มีเวลา

# **48 ชั่วโมง**

สำหรับการรับหนังสือ

ระบบต้องบันทึก

- Allocation Time
- Hold Expiration Time

อย่างชัดเจน

---

# 28. Reservation Expiration

หากผู้ใช้ไม่รับหนังสือภายใน 48 ชั่วโมง

Reservation ต้องเป็น Expired

จากนั้น

ถ้ามีคนถัดไปใน Queue

Copy ต้องถูก Allocate ให้คนถัดไป

ถ้าไม่มี Queue เหลือ

Copy ต้องกลับเป็น

`AVAILABLE`

ระบบต้องสามารถจัดการ Expiration ได้โดยไม่ต้องให้ Administrator มาแก้ Database ด้วยตนเอง

---

# 29. การยกเลิก Reservation

Borrower สามารถยกเลิก Reservation ของตนเองได้ ตราบใดที่ Reservation ยังไม่ Complete

หาก Reservation ที่ถูกยกเลิกกำลังถือ Copy แบบ `ON_HOLD`

ระบบต้องนำ Copy ดังกล่าว

- ไป Allocate ให้คนถัดไป หรือ
- เปลี่ยนเป็น `AVAILABLE`

ตามสถานการณ์

---

# 30. หนังสือสูญหาย

Borrower ไม่สามารถเปลี่ยนหนังสือเป็น `LOST` ได้เองโดยตรง

Borrower สามารถแจ้งปัญหาได้ แต่

# Librarian เป็นผู้ Confirm Lost

เมื่อ Confirm Lost แล้ว

Loan ต้องถูกปิดด้วยเหตุผล

`LOST`

และ Physical Copy เปลี่ยนเป็น

`LOST`

---

# 31. ค่าใช้จ่ายหนังสือสูญหาย

กรณีหนังสือสูญหาย เรียกเก็บ

```text
Replacement Charge
=
Acquisition Price
+
Processing Fee 200 บาท
+
Late Fine ที่เกิดขึ้นก่อนวันที่ Confirm Lost
```

ตัวอย่าง

ราคาหนังสือ

> 850 บาท

Processing Fee

> 200 บาท

Late Fine

> 120 บาท

ยอดเรียกเก็บ

> 1,170 บาท

Late Fine ยังคงอยู่ภายใต้เพดาน 1,000 บาท

เมื่อ Confirm Lost แล้ว Late Fine ต้องหยุดเพิ่ม

---

# 32. หนังสือเสียหาย

เมื่อ Return หนังสือ Librarian ต้องสามารถระบุสภาพได้

### NORMAL

ค่าปรับความเสียหาย

> 0 บาท

Copy สามารถกลับ `AVAILABLE`

---

### MINOR_DAMAGE

ค่าปรับ

> 100 บาท

Copy เปลี่ยนเป็น

`MAINTENANCE`

---

### MAJOR_DAMAGE

ค่าปรับ

> 50% ของ Acquisition Price

Copy เปลี่ยนเป็น

`MAINTENANCE`

---

### UNUSABLE

ค่าปรับ

```text
100% Acquisition Price
+
Processing Fee 200 บาท
```

Copy เปลี่ยนเป็น

`RETIRED`

การคำนวณเปอร์เซ็นต์ต้องปัดเป็นทศนิยม 2 ตำแหน่งตามหลักคณิตศาสตร์ทั่วไป

---

# 33. ค่าปรับหลายประเภทสามารถเกิดพร้อมกันได้

ตัวอย่าง

หนังสือราคา

> 1,000 บาท

คืนช้า

> 5 วัน

และมี Major Damage

Late Fine

> 50 บาท

Damage Charge

> 500 บาท

รวมเป็น

> 550 บาท

หลังจาก Transaction นี้ ผู้ใช้จะมี Outstanding Balance ตั้งแต่ 500 บาทขึ้นไป และถูกจำกัดสิทธิ์ตาม Rule ของระบบ

---

# 34. Fine Ledger

ระบบต้องสามารถตรวจสอบที่มาของยอดเงินทุกบาทได้

ระบบต้องสามารถแยกอย่างน้อย

- Late Fine
- Lost Replacement
- Processing Fee
- Damage Charge
- Payment
- Waiver / Adjustment

ไม่ควรเก็บเพียง Field

```text
users.total_fine
```

แล้วแก้ตัวเลขทับไปเรื่อย ๆ โดยไม่มี Transaction History

---

# 35. Outstanding Balance

แนวคิดของยอดค้างชำระคือ

```text
Outstanding Balance
=
Total Charges
-
Total Payments
-
Total Approved Waivers
```

ยอด Outstanding ห้ามติดลบ

---

# 36. การชำระค่าปรับ

Librarian สามารถบันทึกการรับชำระค่าปรับได้

ระบบต้องรองรับ

- ชำระเต็มจำนวน
- ชำระบางส่วน

จำนวนเงินที่ชำระต้อง

```text
> 0
```

และห้ามมากกว่า Outstanding Balance

Payment Transaction ที่บันทึกสำเร็จแล้วห้ามถูก Hard Delete

---

# 37. Fine Waiver

บรรณารักษ์ไม่มีสิทธิ์ยกเว้นค่าปรับเอง

การ Waive ค่าปรับทำได้เฉพาะ

# `ADMIN`

Admin สามารถ Waive ได้ทั้ง

- บางส่วน
- ทั้งหมด

แต่ต้องระบุ

- จำนวนเงิน
- เหตุผล
- Admin ผู้อนุมัติ
- Timestamp

และต้องสามารถ Audit ย้อนหลังได้

---

# 38. การค้นหาหนังสือ

ผู้ใช้ต้องสามารถค้นหาหนังสืออย่างน้อยด้วย

- ISBN
- Title
- Author
- Category

และ Filter ตาม Availability ได้

Result List ต้องรองรับ

- Pagination
- Sorting

ห้ามออกแบบ API ที่ดึงหนังสือ 100,000 รายการใน Request เดียวโดยไม่มี Pagination

---

# 39. User Account

ผู้ใช้งานอย่างน้อยต้องมีข้อมูล

- University Identifier
- Full Name
- Email
- Role
- Account Status
- Created At
- Updated At

University Identifier ต้อง Unique

Email ต้อง Unique

---

# 40. Account Status

อย่างน้อยต้องรองรับ

- `ACTIVE`
- `DISABLED`

`DISABLED` User

ห้าม

- Borrow
- Renew
- Reserve

แต่ประวัติเดิมทั้งหมดต้องยังอยู่ครบ

---

# 41. ห้ามลบ User History

User ที่เคย

- Borrow
- Return
- Reserve
- Pay Fine
- มี Fine
- มี Audit Record

ห้ามถูก Hard Delete จนทำให้ Transaction History สูญเสีย Referential Integrity

---

# 42. Librarian Permissions

`LIBRARIAN` อย่างน้อยสามารถ

- Manage Book Catalog
- Manage Authors
- Manage Categories
- Manage Physical Copies
- Search Borrower
- Borrow Book ให้ Borrower
- Return Book
- Process Renewal
- Confirm Lost
- Process Damaged Book
- Receive Fine Payment
- ดู Loan Records
- ดู Reservation Queue
- ดู Overdue List
- ดู Inventory Status

แต่ Librarian

**ไม่มีสิทธิ์**

- เปลี่ยน Role ผู้ใช้
- สร้าง Admin
- Disable Admin
- Waive Fine
- แก้ Audit Log

---

# 43. Admin Permissions

`ADMIN` รับผิดชอบด้าน Administration และ Governance เช่น

- Manage Users
- Assign Roles
- Enable / Disable Accounts
- Manage Librarian Accounts
- Manage Admin Accounts ตาม Security Policy ที่ออกแบบ
- Approve Fine Waiver
- ดู Audit Logs
- ดู System Reports

---

# 44. Separation of Duties

ในการแข่งขันนี้

# ADMIN ไม่ได้หมายถึง “ทำได้ทุกอย่างโดยอัตโนมัติ”

ผู้เข้าแข่งขันต้องใช้หลัก

**Least Privilege**

ดังนั้น Admin ไม่ควรได้รับ Librarian Permission โดยอัตโนมัติเว้นแต่ระบบ Role Model ที่ออกแบบรองรับ Multiple Roles อย่างชัดเจน

นี่เป็น Requirement ที่ตั้งใจใช้ตรวจสอบการออกแบบ RBAC

---

# 45. Student / Lecturer Permissions

Student และ Lecturer สามารถ

- Login
- ดูข้อมูลตนเอง
- Search Books
- ดู Availability
- ดู Current Loans ของตนเอง
- ดู Loan History ของตนเอง
- Renew Loan ของตนเอง
- Create Reservation
- Cancel Reservation ของตนเอง
- ดู Reservation Queue Position ของตนเอง
- ดู Fine ของตนเอง
- ดู Payment History ของตนเอง

ห้ามเข้าถึงข้อมูลส่วนตัวหรือประวัติของ Borrower คนอื่น

---

# 46. Authentication

ระบบต้องมี Authentication ที่เหมาะสมสำหรับ Production API

ผู้แข่งขันเป็นผู้ออกแบบวิธีเอง

แต่ต้องไม่มี

- Plaintext Password
- Password ใน Source Code
- Shared Hardcoded Token
- Authentication ที่เชื่อ Client ว่าเป็น Role ใดโดยไม่มี Server Verification

Password ต้องถูก Hash ด้วย Password Hashing Algorithm ที่เหมาะสม เช่น

- Argon2id
- bcrypt

หรือเทียบเท่า

---

# 47. Authorization

ทุก Protected Operation ต้องตรวจ Authorization ฝั่ง Backend

การซ่อนปุ่มบน Frontend

**ไม่ถือว่าเป็น Authorization**

ตัวอย่าง

Student ส่ง Request โดยตรงไปยัง API ของ Librarian

Backend ต้อง Reject

---

# 48. API Design

ผู้แข่งขันต้องออกแบบ API Endpoint เองทั้งหมด

โจทย์จะไม่กำหนดว่า Endpoint ต้องชื่ออะไร

ตัวอย่าง Domain ที่ API ต้องครอบคลุม ได้แก่

### Authentication

- Login
- Token Lifecycle
- Current User

### Catalog

- Books
- Authors
- Categories
- Copies
- Search

### Circulation

- Borrow
- Return
- Renewal
- Current Loans
- Loan History

### Reservation

- Create
- Cancel
- Queue
- Hold
- Expiration

### Fine

- Charges
- Outstanding Balance
- Payment
- Waiver

### Administration

- Users
- Roles
- Account Status

### Reporting

- Overdue
- Inventory
- Borrowing Statistics
- Fine Statistics

ผู้แข่งขันมีอิสระในการออกแบบ

- URL
- HTTP Method
- Request Body
- Response Body
- Resource Structure

แต่ต้องสามารถอธิบายเหตุผลของ API Design ได้

---

# 49. API Contract

ต้องจัดทำ API Documentation ในรูปแบบ

# OpenAPI

หรือมาตรฐานเทียบเท่า

Documentation ต้องสามารถระบุ

- Endpoint
- Method
- Authentication
- Authorization
- Path Parameters
- Query Parameters
- Request
- Response
- Status Code
- Validation Error

ได้อย่างชัดเจน

---

# 50. Error Response

API ต้องมี Error Format ที่สม่ำเสมอ

ตัวอย่าง Error Domain

- BOOK_NOT_FOUND
- COPY_NOT_AVAILABLE
- LOAN_LIMIT_EXCEEDED
- DUPLICATE_ACTIVE_LOAN
- USER_HAS_OVERDUE_LOAN
- FINE_LIMIT_EXCEEDED
- RESERVATION_LIMIT_EXCEEDED
- RESERVATION_ALREADY_EXISTS
- BOOK_CURRENTLY_AVAILABLE
- RENEW_LIMIT_EXCEEDED
- RENEW_BLOCKED_BY_RESERVATION
- INVALID_STATE_TRANSITION
- FORBIDDEN
- UNAUTHORIZED

ไม่บังคับให้ใช้ชื่อดังกล่าวตรงตัว แต่ API ต้องสามารถสื่อสาเหตุของ Error แบบ Machine-Readable ได้

---

# 51. HTTP Status Code

หากออกแบบ REST API ต้องใช้ HTTP Status Code อย่างสมเหตุสมผล

ตัวอย่าง

- `200 OK`
- `201 Created`
- `204 No Content`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict`
- `422 Unprocessable Entity`

ห้ามตอบ

`200 OK`

ทุกกรณีแล้วฝัง Error ไว้ใน Message เพียงอย่างเดียว

---

# 52. Database Design

ผู้แข่งขันต้องสร้าง Database Schema เองทั้งหมด

ไม่มี Table Name บังคับ

ไม่มี Column Name บังคับ

ไม่มีจำนวน Table บังคับ

แต่ Database ต้องสามารถรองรับ Requirements ทั้งหมดได้อย่างถูกต้อง

---

# 53. ER Diagram

ต้องส่ง ER Diagram ที่แสดงอย่างน้อย

- Entities
- Primary Keys
- Foreign Keys
- Relationships
- Cardinality

Database จริงกับ ER Diagram ต้องสอดคล้องกัน

ห้ามส่ง ER Diagram ที่ไม่ตรงกับ Implementation

---

# 54. Referential Integrity

ความสัมพันธ์สำคัญควรถูกป้องกันด้วย Database Constraint ตามความเหมาะสม

ผู้แข่งขันต้องพิจารณา

- Primary Key
- Foreign Key
- Unique Constraint
- Check Constraint
- NOT NULL
- Index

ด้วยตนเอง

---

# 55. Database Migration

Database Schema ต้องสามารถสร้างใหม่จาก Source Code หรือ Migration ได้

กรรมการต้องสามารถ

```text
Clone Project
→ Create Database
→ Run Migration
→ Run Seed
→ Start Backend
```

โดยไม่ต้องสร้าง Table ด้วยมือ

---

# 56. Database Indexing

ระบบถูกสมมติให้มี

- Users ≥ 20,000
- Book Records ≥ 100,000
- Physical Copies ≥ 300,000
- Loan History ≥ 5,000,000 Records

ผู้แข่งขันต้องออกแบบ Index ให้เหมาะสมกับ Query สำคัญ

คะแนนจะไม่พิจารณาเพียงว่า Query ทำงานได้ แต่จะพิจารณาว่า Database Design สามารถ Scale ได้หรือไม่

---

# 57. Transaction Integrity

Operation ที่เกี่ยวข้องกับหลาย Entity ต้องใช้ Database Transaction ตามความเหมาะสม

ตัวอย่างเช่น Borrow

อาจต้องเกิดหลายเหตุการณ์ร่วมกัน เช่น

1. ตรวจสอบ User
2. ตรวจสอบ Loan Limit
3. ตรวจสอบ Fine
4. ตรวจสอบ Copy
5. สร้าง Loan
6. เปลี่ยน Copy Status
7. Complete Reservation
8. เขียน Audit

หากขั้นตอนใดล้มเหลว

ระบบต้องไม่อยู่ใน Partial State

---

# 58. Concurrent Borrowing

นี่เป็น Requirement สำคัญของการแข่งขัน

สมมติ

Copy

`BOOK-00001`

มีสถานะ

`AVAILABLE`

Student A และ Student B ส่ง Borrow Request เข้ามาเกือบพร้อมกัน

ผลลัพธ์ที่ถูกต้องคือ

# มีเพียงคนเดียวเท่านั้นที่ยืมสำเร็จ

อีก Request ต้องถูก Reject อย่างถูกต้อง

ห้ามเกิด

```text
Student A → Borrow Success

Student B → Borrow Success

Copy เดียวกัน
```

แม้ Application จะทำงานอยู่หลาย Instance

ดังนั้นการใช้เพียง

```text
if copy.status == AVAILABLE
```

ใน Application Memory ไม่เพียงพอ

ผู้แข่งขันต้องออกแบบ Concurrency Control ที่เหมาะสม

---

# 59. Duplicate Request

ระบบควรสามารถป้องกันผลเสียจาก Request ซ้ำสำหรับ Critical Transaction

เช่น Client ส่ง Borrow Request แล้ว Network Timeout

Client ส่ง Request เดิมซ้ำ

ระบบต้องไม่สร้าง Loan ซ้ำโดยไม่มีการควบคุม

ผู้แข่งขันสามารถออกแบบ Idempotency Strategy ที่เหมาะสมและอธิบายในเอกสาร Architecture

---

# 60. Audit Logging

Critical Actions ต้องสามารถ Audit ได้

อย่างน้อย เช่น

- Borrow
- Return
- Renewal
- Confirm Lost
- Damage Assessment
- Payment
- Fine Waiver
- User Role Change
- Account Disable
- Catalog Administrative Change

Audit ต้องสามารถตอบคำถามได้ว่า

- ใครเป็นผู้กระทำ
- ทำอะไร
- กับ Resource ใด
- เมื่อใด
- ผลลัพธ์คืออะไร

Audit Record ห้ามถูกแก้ไขหรือลบผ่าน API ปกติ

---

# 61. Sensitive Data

ห้ามบันทึกข้อมูล Sensitive เช่น

- Plaintext Password
- Access Token แบบเต็ม
- Refresh Token แบบเต็ม
- Authorization Header

ลง Application Log

---

# 62. Validation

Backend ต้อง Validate Input ทุก Request

ตัวอย่าง

- ISBN Format
- Email
- Required Field
- Price > 0
- Enum
- Invalid ID
- Negative Payment
- Future / Invalid Dates
- Duplicate Barcode

ห้ามพึ่ง Validation จาก Frontend

---

# 63. Application Architecture

ต้องใช้แนวทางที่สามารถดูแลรักษาได้ในระบบ Production

Architecture สามารถเลือกเอง เช่น

- Clean Architecture
- Hexagonal Architecture
- Onion Architecture
- Layered Architecture ที่แบ่ง Responsibility ชัดเจน

ไม่มี Framework บังคับ

แต่ต้องแยก Responsibility อย่างเหมาะสมระหว่าง

- Domain
- Business Logic
- Application / Use Cases
- Infrastructure
- Persistence
- Transport / API

---

# 64. Business Logic Location

Business Rule สำคัญไม่ควรกระจายอยู่ใน Controller แบบไร้โครงสร้าง

ตัวอย่าง

Controller ไม่ควรเป็นไฟล์ขนาดใหญ่ที่ทำทุกอย่างตั้งแต่

- Parse HTTP
- Query SQL
- คำนวณ Fine
- เปลี่ยน State
- Authorization
- Response

รวมอยู่ใน Function เดียว

กรรมการจะพิจารณา Maintainability ของ Architecture ด้วย

---

# 65. Security Principles

ระบบควรแสดงให้เห็นการใช้หลัก

- Least Privilege
- Fail Secure
- Secure by Design
- Defensive Programming
- Input Validation
- Output Sanitization ตามบริบท
- Authentication
- Authorization
- Secret Management
- Secure Password Storage

---

# 66. Report Requirements

อย่างน้อยต้องสามารถสร้างข้อมูลสำหรับ Report ต่อไปนี้

### Overdue Report

แสดง

- Borrower
- Book
- Copy
- Due Date
- Late Days
- Current Accrued Fine

### Inventory Report

จำนวน Copy แยกตาม Status

### Borrowing Report

จำนวนการยืมตามช่วงเวลา

### Popular Books

หนังสือที่ถูกยืมมากที่สุด

### Outstanding Fine Report

ผู้ใช้ที่มีค่าปรับค้างชำระ

---

# 67. Pagination

API ที่เป็น Collection ต้องพิจารณา Pagination

เช่น

- Books
- Users
- Loans
- Audit Logs
- Fine Transactions

ต้องกำหนด Maximum Page Size เพื่อป้องกัน Request ที่ดึงข้อมูลจำนวนมหาศาล

---

# 68. Sorting และ Filtering

API สำหรับข้อมูลจำนวนมากควรรองรับ Filter และ Sort ที่เหมาะสม

แต่ต้องป้องกันการนำชื่อ Column จาก Client ไปประกอบ SQL โดยตรงจนเกิด SQL Injection

---

# 69. No Hard Delete สำหรับ Transaction

ข้อมูลต่อไปนี้ห้าม Hard Delete ผ่าน API ปกติ

- Loan History
- Fine Charge
- Payment
- Waiver
- Audit Log

การยกเลิกหรือ Correction ต้องทำผ่าน State หรือ Compensating Record ที่ตรวจสอบย้อนหลังได้

---

# 70. Production Configuration

Secret และ Environment-Specific Configuration ห้าม Hardcode ใน Repository

ควรสามารถกำหนดผ่าน Environment Variable หรือ Secret Management

ต้องมีตัวอย่าง Configuration เช่น

`.env.example`

แต่ห้าม Commit Secret จริง

---

# 71. Logging

ระบบต้องมี Structured Application Logging ที่เหมาะสม

ควรสามารถ Trace Request ได้ด้วย Identifier เช่น

`Request ID / Correlation ID`

เพื่อช่วย Debug ปัญหาใน Production

---

# 72. Testing

ต้องมี Automated Test

อย่างน้อยต้องมี

- Unit Test สำหรับ Business Rule สำคัญ
- Integration Test สำหรับ Database / Repository
- API Test สำหรับ Critical Flow

Critical Flow ที่ควรถูก Test ได้แก่

- Login
- Borrow
- Return
- Renew
- Reservation
- Overdue Fine
- Fine Payment
- Permission
- Concurrent Borrow

---

# 73. Mandatory Acceptance Scenario 1

Student มี Active Loan = 4

Borrow อีก 1

Expected:

`SUCCESS`

Active Loan = 5

---

# 74. Mandatory Acceptance Scenario 2

Student มี Active Loan = 5

Borrow Copy ที่ 6

Expected:

`REJECT`

เหตุผล:

Loan Limit Exceeded

---

# 75. Mandatory Acceptance Scenario 3

Lecturer มี Active Loan = 5

Borrow Copy ที่ 6

Expected:

`REJECT`

Lecturer ต้องไม่ได้สิทธิ์มากกว่า Student

---

# 76. Mandatory Acceptance Scenario 4

Student และ Lecturer ไม่มี Loan

ทั้งคู่ต้องสามารถยืมได้สูงสุด 5 Copies และมี Loan Duration เท่ากัน

Expected:

สิทธิ์ด้าน Circulation เท่ากัน

---

# 77. Mandatory Acceptance Scenario 5

Due Date

10 September

Return Date

10 September

Expected Fine

`0 THB`

---

# 78. Mandatory Acceptance Scenario 6

Due Date

10 September

Return Date

11 September

Expected Fine

`10 THB`

---

# 79. Mandatory Acceptance Scenario 7

Fine Calculation ตามวันได้

1,250 THB

Expected Late Fine

`1,000 THB`

---

# 80. Mandatory Acceptance Scenario 8

User มี Active Overdue Loan

พยายาม Borrow

Expected:

`REJECT`

---

# 81. Mandatory Acceptance Scenario 9

Outstanding Balance

`490 THB`

ไม่มี Overdue Loan

Borrow ตามเงื่อนไขอื่นได้

Expected:

`SUCCESS`

---

# 82. Mandatory Acceptance Scenario 10

Outstanding Balance

`500 THB`

พยายาม Borrow

Expected:

`REJECT`

---

# 83. Mandatory Acceptance Scenario 11

Outstanding Balance

`500 THB`

ชำระ

`20 THB`

Outstanding ใหม่

`480 THB`

ถ้าไม่มีเงื่อนไข Block อื่น

Expected:

สามารถ Borrow ได้

---

# 84. Mandatory Acceptance Scenario 12

Loan ต่ออายุครั้งที่ 1

Expected:

Due Date +7 Days

---

Loan ต่ออายุครั้งที่ 2

Expected:

Due Date +7 Days

---

Loan ต่ออายุครั้งที่ 3

Expected:

`REJECT`

---

# 85. Mandatory Acceptance Scenario 13

Book มีผู้ใช้คนอื่นอยู่ใน Reservation Queue

Borrower ปัจจุบันพยายาม Renew

Expected:

`REJECT`

---

# 86. Mandatory Acceptance Scenario 14

Book มี 1 Copy

Student A และ Student B Borrow พร้อมกัน

Expected:

- Success = 1 Request
- Failure = 1 Request
- Active Loan ของ Copy = 1

ห้ามมี Active Loan 2 รายการสำหรับ Copy เดียว

---

# 87. Mandatory Acceptance Scenario 15

Book ไม่มี Available Copy

A จองก่อน B

ลำดับต้องเป็น

```text
1. A
2. B
```

เมื่อ Copy คืนมา

Copy ต้อง Hold ให้ A ก่อน

---

# 88. Mandatory Acceptance Scenario 16

A ไม่รับ Copy ภายใน 48 ชั่วโมง

B อยู่ลำดับถัดไป

Expected:

- Reservation A → EXPIRED
- Copy → Allocate ให้ B
- B → ON_HOLD

---

# 89. Mandatory Acceptance Scenario 17

Student มีหนังสือ Book X อยู่แล้ว

Book X มี Copy ว่างอีก 3 Copies

Student พยายามยืม Copy ที่สองของ Book X

Expected:

`REJECT`

---

# 90. Mandatory Acceptance Scenario 18

User มีค่าปรับ 600 บาท

Librarian พยายาม Waive 200 บาท

Expected:

`FORBIDDEN`

Admin Waive 200 บาทพร้อม Reason

Expected:

`SUCCESS`

Outstanding

`400 THB`

---

# 91. Mandatory Acceptance Scenario 19

Book Acquisition Price

`800 THB`

ถูก Confirm Lost

Late Fine

`70 THB`

Expected Charge

```text
800
+ 200 Processing Fee
+ 70 Late Fine

= 1,070 THB
```

Copy Status

`LOST`

Loan ต้องไม่เป็น Active Loan อีกต่อไป

---

# 92. Mandatory Acceptance Scenario 20

Book Acquisition Price

`1,200 THB`

Return เป็น

`MAJOR_DAMAGE`

Expected Damage Charge

`600 THB`

Copy Status

`MAINTENANCE`

---

# 93. Non-Functional Requirement

ระบบต้องถูกออกแบบเสมือนเป็น Production System จริง

กรรมการจะพิจารณา

- Correctness
- Data Integrity
- Concurrency Safety
- Security
- Performance
- Scalability
- Maintainability
- Observability
- Testability
- Code Quality
- Database Quality

ไม่พิจารณาเพียงว่า API “ยิงแล้วได้ Response”

---

# 94. Technology

ผู้เข้าแข่งขันสามารถเลือก Technology Stack ได้เอง

เช่น

- Go
- Java / Spring Boot
- C# / ASP.NET Core
- TypeScript / Node.js
- Kotlin
- Rust
- Python

และ Database เช่น

- PostgreSQL
- MySQL

หรือเทคโนโลยีอื่นที่สามารถอธิบายเหตุผลทางวิศวกรรมได้

---

# 95. Frontend

# ไม่ต้องพัฒนา Frontend

การแข่งขันนี้วัด

**Backend Engineering**

กรรมการจะทดสอบระบบผ่าน API โดยตรง

---

# 96. สิ่งที่ผู้เข้าแข่งขันต้องส่ง

## 1. Source Code

Backend Application ทั้งหมด

## 2. Database Migration

สำหรับสร้าง Database จากศูนย์

## 3. Database Seed

ข้อมูลขั้นต่ำสำหรับทดสอบระบบ

## 4. ER Diagram

แสดง Database Design

## 5. API Documentation

OpenAPI / Swagger หรือเทียบเท่า

## 6. README

อย่างน้อยต้องอธิบาย

- Architecture
- Project Structure
- Setup
- Database
- Migration
- Seed
- Environment
- Authentication
- Running Tests
- Design Decisions

## 7. Automated Tests

Unit / Integration / API Tests

## 8. Deployment Configuration

ควรสามารถ Run ระบบได้ง่าย เช่น Docker / Docker Compose หรือแนวทางเทียบเท่า

## 9. `.env.example`

โดยไม่มี Secret จริง

---

# 97. Architecture Documentation

ผู้เข้าแข่งขันต้องอธิบายอย่างน้อย

### Database Strategy

ทำไมออกแบบ Entity และ Relation แบบนั้น

### Transaction Strategy

Borrow / Return ป้องกัน Partial Update อย่างไร

### Concurrency Strategy

ป้องกัน Double Borrow อย่างไร

### Authentication Strategy

Login / Token ทำงานอย่างไร

### Authorization Strategy

RBAC ถูกบังคับที่ Layer ใด

### Fine Strategy

ค่าปรับและ Payment สามารถ Audit ได้อย่างไร

### Reservation Strategy

FIFO และ Expiration ทำงานอย่างไร

---

# 98. สิ่งที่ถือว่าไม่ผ่าน Requirement

ตัวอย่าง ได้แก่

- Student กับ Lecturer ได้สิทธิ์ยืมไม่เท่ากัน
- Physical Copy เดียวมี Active Loan มากกว่า 1 รายการ
- Fine Calculation ไม่ตรง Requirement
- Client สามารถกำหนดค่าปรับเองได้
- Client สามารถส่ง Role แล้ว Backend เชื่อตามนั้น
- Librarian สามารถ Waive Fine
- Student ดู Loan History ของ Student คนอื่นได้
- Password เก็บ Plaintext
- ไม่มี Transaction ใน Critical Flow
- ลบ Loan History ได้
- ลบ Payment History ได้
- Audit Log แก้ไขผ่าน API ได้
- Reservation Queue ไม่รักษาลำดับ
- Book กับ Physical Copy ถูกออกแบบเป็นสิ่งเดียวกันจนรองรับหลาย Copy ไม่ได้
- Database Schema ต้องสร้างด้วยมือ
- API ไม่มี Authentication
- ไม่มี Authorization
- ไม่มี ER Diagram
- ไม่มี API Documentation

---

# 99. หลักการที่คาดหวัง

Solution ที่ดีควรสะท้อนหลักการ เช่น

- Clean Architecture
- SOLID
- DRY
- KISS
- Separation of Concerns
- Domain Invariants
- Explicit State Machine
- Defensive Programming
- Design by Contract
- Secure by Design
- Least Privilege
- Fail Secure
- Transactional Integrity
- Idempotent Operations
- Immutable Audit
- Deterministic Processing

ไม่ได้ให้คะแนนจากการเขียนชื่อ Principle เหล่านี้ไว้ใน README

แต่ให้คะแนนจากว่า

# Implementation ทำตาม Principle เหล่านี้จริงหรือไม่

---

# 100. Scoring — 100 คะแนน

## Business Requirement Correctness — 25 คะแนน

- Borrow / Return
- Renewal
- Reservation
- Fine
- Lost / Damage
- Permissions

---

## Database & Data Integrity — 20 คะแนน

- ER Design
- Relationships
- Constraints
- Indexes
- Migration
- Transaction Integrity

---

## Concurrency & Reliability — 15 คะแนน

- Double Borrow Prevention
- Race Condition Handling
- Transaction Isolation
- Idempotency
- Invalid State Prevention

---

## Architecture & Code Quality — 15 คะแนน

- Clean Separation
- Domain Logic
- Maintainability
- Testability
- Dependency Management

---

## API Design — 10 คะแนน

- Resource Design
- HTTP Semantics
- Validation
- Error Contract
- Pagination
- Documentation

---

## Security — 10 คะแนน

- Authentication
- Authorization
- Password Security
- Least Privilege
- Secret Management
- Input Protection

---

## Testing & Documentation — 5 คะแนน

- Automated Tests
- README
- ER Diagram
- OpenAPI
- Reproducible Setup

---

# 101. Bonus Challenge

กรรมการสามารถเพิ่ม Load Test โดยยิง Request พร้อมกันจำนวนมาก เช่น

```text
100 Concurrent Borrow Requests
```

ไปยัง Physical Copy เดียวกัน

ผลลัพธ์ต้องยังคงมี

```text
Successful Borrow = 1
Active Loan = 1
```

เสมอ

ไม่ว่าจะมี Application Instance เดียวหรือหลาย Instance

---

# 102. Final Objective

ผู้เข้าแข่งขันไม่ได้ถูกทดสอบว่า

> “สามารถสร้าง CRUD API ได้หรือไม่”

แต่กำลังถูกทดสอบว่า

> **สามารถออกแบบ Backend System ที่รักษา Business Invariant, Data Integrity, Security และ Transaction Correctness ภายใต้สถานการณ์จริงได้หรือไม่**

Solution ที่ดีที่สุดจึงไม่ใช่ Solution ที่มี Code มากที่สุด

แต่เป็น Solution ที่

- Business Rules ถูกต้อง
- Database ถูกต้อง
- API ชัดเจน
- Concurrent Request ไม่ทำให้ข้อมูลเสีย
- Security ไม่สามารถ Bypass ได้ง่าย
- Transaction สามารถ Audit ได้
- Architecture สามารถขยายต่อได้
- Test สามารถพิสูจน์พฤติกรรมของระบบได้
- และระบบสามารถนำไปพัฒนาต่อใน Production Environment ได้อย่างมั่นใจ

# **END OF CHALLENGE — UniLib Core**