# 🎓 Research Portal API (Backend)

ระบบ RESTful API สำหรับระบบสืบค้นและจัดการผลงานวิจัยของนักศึกษาจบการศึกษา พัฒนาด้วย **Node.js (Express)** และ **MongoDB (Mongoose)** พร้อมระบบยืนยันตัวตน (JWT & Google OAuth 2.0) และระบบควบคุมสิทธิ์ผู้ใช้งานตามบทบาท (RBAC)

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB Atlas (Mongoose ODM)
- **Authentication**: JWT (JSON Web Token), Passport.js (Google OAuth 2.0)
- **File Storage**: Multer (รองรับไฟล์เอกสาร PDF)
- **Security & Utils**: Bcrypt.js, CORS, Dotenv

---

## 👥 สิทธิ์และกลุ่มผู้ใช้งาน (User Roles)

| บทบาท (Role) | สิทธิ์การใช้งาน (Permissions) |
| :--- | :--- |
| **สาธารณะ (Public / Guest)** | • สืบค้นผลงานวิจัย, กรองตามสาขา/หมวดหมู่/คำสำคัญ/ปีการศึกษา<br>• ดูรายละเอียดผลงาน และดาวน์โหลดไฟล์เอกสารวิจัย (PDF) โดย**ไม่ต้องเข้าสู่ระบบ** |
| **นักศึกษาจบการศึกษา (`graduate`)** | • สมัครสมาชิก / เข้าสู่ระบบ (Local Account & Google OAuth)<br>• จัดการผลงานวิจัยตนเอง (สร้าง, แก้ไข, ลบ, อัปโหลดเอกสาร)<br>• จัดการข้อมูลส่วนตัว และดูประวัติการใช้งาน (Activity Logs) |
| **ผู้ดูแลระบบ (`admin`)** | • ดูสถิติรวมบน Dashboard (ยอดผู้ใช้, ผลงาน, การเข้าชม)<br>• จัดการผู้ใช้งาน (อนุมัติ, ระงับบัญชี, เปลี่ยนบทบาท, รีเซ็ตรหัสผ่าน)<br>• จัดการผลงานวิจัยทั้งหมด (อนุมัติ, เผยแพร่, ซ่อน, ลบ)<br>• จัดการข้อมูลหมวดหมู่ (Categories), แท็ก (Tags) และแผนก/สาขาวิชา (Departments)<br>• ตรวจสอบ Audit Logs, Login Logs และส่งออกรายงานสรุปเป็น CSV |

---

## 🚀 การติดตั้งและเริ่มใช้งาน (Getting Started)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Environment Variables (`.env`)
คัดลอกและตั้งค่าในไฟล์ `.env` ที่โฟลเดอร์หลัก:

```env
PORT=3500
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/?appName=Cluster0
MONGO_DB=user

JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-session-secret

# Google OAuth 2.0 (ตัวเลือกเพิ่มเติม)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL=http://localhost:3500/api/auth/google/callback
GOOGLE_OAUTH_ALLOWED_DOMAIN=.ac.th

# Frontend URL สำหรับ Redirect หลัง OAuth Login
FRONTEND_URL=http://localhost:5173
```

### 3. เตรียมฐานข้อมูลและสร้างบัญชี Admin เริ่มต้น
```bash
npm run init:db
```
*ระบบจะสร้าง Collections, Indexes, Catalog เริ่มต้น และสร้างบัญชี Admin (`admin@example.com` / `admin123456`) ให้โดยอัตโนมัติ*

### 4. รันระบบ Backend Server
```bash
# โหมดพัฒนา (Development)
npm run dev

# โหมดทำงานจริง (Production)
npm start
```
ระบบจะทำงานที่: `http://localhost:3500`

---

## 📌 สรุปเส้นทาง API (API Endpoints Summary)

### 🌐 Public APIs (ไม่ต้องมี Token)
- `GET /health` — เช็คสถานะการทำงานของ Server
- `GET /api/public/projects` — ค้นหาและกรองรายการผลงานวิจัย (`?q=`, `title`, `researcher`, `categoryName`, `keyword`, `major`, `academicYear`, `page`, `limit`)
- `GET /api/public/projects/:id` — ดูรายละเอียดผลงานวิจัยตาม ID
- `GET /api/public/projects/:id/file` — ดาวน์โหลดไฟล์เอกสารวิจัย PDF (`?download=1`)
- `GET /api/public/categories` — ดึงรายการหมวดหมู่ผลงาน
- `GET /api/public/tags` — ดึงรายการแท็ก/คำสำคัญ
- `GET /api/departments` — ดึงรายการแผนก/สาขาวิชาพร้อมหมวดหมู่และแท็กที่เกี่ยวข้อง

---

### 🔐 Auth APIs (การยืนยันตัวตน)
- `POST /api/auth/register` — สมัครสมาชิกสำหรับนักศึกษาจบการศึกษา (`studentId`, `fullName`, `major`, `email`, `password`)
- `POST /api/auth/login` — เข้าสู่ระบบด้วย Email และ Password
- `GET /api/auth/me` — ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน (ใช้ JWT Bearer Token)
- `GET /api/auth/google` — เข้าสู่ระบบด้วย Google OAuth 2.0
- `GET /api/auth/google/callback` — Callback สำหรับ Google OAuth

---

### 🎓 Graduate APIs (สำหรับนักศึกษาจบการศึกษา)
*(ต้องแนบ `Authorization: Bearer <TOKEN>`)*

- `GET /api/me/works` — ดึงรายการผลงานวิจัยของตนเอง
- `GET /api/me/activity` — ดึงประวัติการเข้าใช้งานและกิจกรรมของตนเอง
- `GET /api/me/advisors` — ดึงรายการอาจารย์ที่ปรึกษาในผลงานของตนเอง
- `GET /api/users/advisors` — ดึงรายการและค้นหาอาจารย์ที่ปรึกษาสำหรับผู้ใช้งาน (`?q=`, `major`, `department`, `expertise`, `page`, `limit`)
- `GET /api/users/advisors/:id` — ดูรายละเอียดข้อมูลอาจารย์ที่ปรึกษาตาม ID
- `POST /api/users/advisors` หรือ `POST /api/advisors` — เพิ่มข้อมูลอาจารย์ที่ปรึกษาใหม่ (มีการตรวจสอบชื่อและตำแหน่งทางวิชาการซ้ำก่อนเพิ่ม)
- `GET /api/contents` — ดึงรายการผลงาน
- `POST /api/contents` — สร้างผลงานวิจัยใหม่
- `GET /api/contents/:id` — ดูรายละเอียดผลงานตาม ID
- `PATCH /api/contents/:id` — แก้ไขข้อมูลผลงานวิจัยของตนเอง
- `DELETE /api/contents/:id` — ลบผลงานวิจัยของตนเอง
- `POST /api/uploads/paper` — อัปโหลดไฟล์เอกสาร PDF
- `PATCH /api/users/:id` — อัปเดตข้อมูลโปรไฟล์ส่วนตัว

---

### 👑 Admin APIs (สำหรับผู้ดูแลระบบ)
*(ต้องแนบ `Authorization: Bearer <TOKEN>` ของผู้ใช้สิทธิ์ `admin`)*

- **Dashboard & สถิติ**
  - `GET /api/admin/dashboard` — สถิติภาพรวมระบบ (ยอดผู้ใช้, ผลงานวิจัย, การเข้าชม)
- **จัดการผู้ใช้งาน**
  - `GET /api/admin/users` — ดึงรายการผู้ใช้ทั้งหมด
  - `PATCH /api/admin/users/:id/suspend` — ระงับการใช้งานบัญชีผู้ใช้
  - `PATCH /api/admin/users/:id/activate` — ปลดระงับบัญชีผู้ใช้
  - `PATCH /api/admin/users/:id/role` — เปลี่ยนบทบาทผู้ใช้ (`graduate` / `admin`)
  - `POST /api/admin/users/:id/reset-password` — รีเซ็ตรหัสผ่านผู้ใช้งาน
- **จัดการผลงานวิจัย**
  - `GET /api/admin/works` — รายการผลงานวิจัยทั้งหมดในระบบ (พร้อมสถานะการอนุมัติ)
  - `PATCH /api/admin/works/:id` — อนุมัติ / แก้ไขสถานะ / จัดการผลงาน
  - `DELETE /api/admin/works/:id` — ลบผลงานวิจัยออกจากระบบ
- **จัดการหมวดหมู่, แท็ก และสาขาวิชา**
  - `GET / POST / PATCH / DELETE /api/categories` — จัดการหมวดหมู่ผลงาน
  - `GET / POST / PATCH / DELETE /api/tags` — จัดการแท็กคำสำคัญ
  - `GET / POST / PATCH / DELETE /api/departments` — จัดการสาขาวิชาและคณะ
- **Logs & รายงาน**
  - `GET /api/admin/audit-logs` — ตรวจสอบ Audit Logs การทำงานในระบบ
  - `GET /api/admin/login-logs` — ตรวจสอบประวัติการเข้าสู่ระบบ
  - `GET /api/admin/reports/summary` — รายงานสรุปภาพรวม
  - `GET /api/admin/reports/export.csv` — ส่งออกข้อมูลรายงานเป็นไฟล์ CSV

---

## 🧪 คำสั่งสคริปต์ที่มีให้ใช้งาน (NPM Scripts)

```bash
# เริ่มต้นทำงานในโหมด Development
npm run dev

# สร้างโครงสร้าง DB และสร้างบัญชี Admin เริ่มต้น
npm run init:db

# ทดสอบรันการทำงานของ API ต่างๆ
npm run test:api

# ย้ายบทบาทผู้ใช้งานในระบบ (Migration)
npm run migrate:roles
```

---

## 📂 โครงสร้างโฟลเดอร์ (Project Structure)

```text
final_project_Backend/
├── config/             # การตั้งค่าระบบ (เช่น การเชื่อมต่อ MongoDB db.js)
├── middleware/         # Custom Express Middlewares (Auth, Passport, Upload PDF)
├── models/             # Mongoose Schemas & Models (User, Content, Tag, Category, etc.)
├── routes/             # Express Route Handlers (Auth, Public, Contents, Admin, etc.)
├── scripts/            # Database Seeding, Tests & Migration Utility Scripts
├── uploads/            # โฟลเดอร์เก็บไฟล์ PDF เอกสารวิจัยที่อัปโหลด
├── utils/              # Helper utilities (Audit logs, Paths, Serializers)
├── .env                # Environment variables file
├── package.json        # Dependencies & NPM Scripts
└── server.js           # Entry point ของแอปพลิเคชัน Express
```

