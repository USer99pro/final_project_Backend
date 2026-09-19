# 🎓 Research Portal API (Backend)

ระบบ RESTful API สำหรับระบบสืบค้น จัดเก็บ และจัดการผลงานวิจัย/วิทยานิพนธ์ของนักศึกษาจบการศึกษา พัฒนาด้วย **Node.js (Express)** และ **MongoDB (Mongoose)** พร้อมระบบยืนยันตัวตน (Dual Token JWT & Google OAuth 2.0) ระบบควบคุมสิทธิ์ผู้ใช้งานตามบทบาท (RBAC) และมาตรฐานความปลอดภัยขั้นสูง (Security Hardening)

---

## 🛠️ เทคโนโลยีและเครื่องมือ (Tech Stack)

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB Atlas (Mongoose ODM)
- **Authentication**: JWT (Short-lived Access Token + DB-backed Refresh Token with Token Rotation & Revocation), Passport.js (Google OAuth 2.0)
- **Security**: 
  - **Helmet**: ป้องกัน HTTP Header vulnerabilities
  - **Express Rate Limit**: ป้องกัน Brute-force และ DoS ทั้งแบบ Global และ Auth Endpoints
  - **Bcrypt**: เข้ารหัสผ่านอย่างปลอดภัย
  - **CORS**: ควบคุม Origin ที่อนุญาต
  - **Magic Bytes Validation**: ตรวจสอบ Header จริงของไฟล์ PDF ก่อนบันทึก ป้องกันการปลอมแปลงนามสกุลไฟล์
  - **Error Sanitization**: ป้องกันข้อมูลภายในและ Stack Trace รั่วไหลสู่ Client
- **File Upload**: Multer (จำกัดขนาดและประเภทไฟล์เฉพาะ `.pdf`)

---

## 👥 สิทธิ์และกลุ่มผู้ใช้งาน (User Roles & Permissions)

| บทบาท (Role) | สิทธิ์การใช้งาน (Permissions) |
| :--- | :--- |
| **สาธารณะ (Public / Guest)** | • สืบค้นผลงานวิจัย ค้นหาแบบ Full-text / กรองตาม สาขา, หมวดหมู่, คำสำคัญ, ปีการศึกษา<br>• ดูรายละเอียดผลงานวิจัย และดาวน์โหลดไฟล์เอกสารวิจัย PDF โดย**ไม่ต้องเข้าสู่ระบบ** |
| **นักศึกษาจบการศึกษา (`graduate`)** | • สมัครสมาชิกและเข้าสู่ระบบ (Local Account & Google OAuth)<br>• จัดการผลงานวิจัยของตนเอง (สร้าง, แก้ไข, ลบ, อัปโหลดเอกสาร PDF)<br>• จัดการข้อมูลส่วนตัว และดูประวัติการเข้าใช้งาน (Activity Logs)<br>• ค้นหาและเสนอเพิ่มข้อมูลอาจารย์ที่ปรึกษา (Advisor Catalog) |
| **ผู้ดูแลระบบ (`admin`)** | • ดูสถิติรวมบน Dashboard (ยอดผู้ใช้, ผลงาน, สถิติการดาวน์โหลดและการเข้าชม)<br>• จัดการผู้ใช้งาน (อนุมัติ, ระงับ/ปลดระงับบัญชี, เปลี่ยนบทบาท, รีเซ็ตรหัสผ่าน)<br>• จัดการผลงานวิจัยทั้งหมด (อนุมัติ, เผยแพร่, ปรับสถานะ, ลบผลงาน)<br>• จัดการ Catalog: หมวดหมู่ (Categories), แท็ก (Tags), และสาขาวิชา (Departments)<br>• ตรวจสอบ Audit Logs, Login Logs และส่งออกรายงานสรุปเป็น CSV |

---

## 🚀 การติดตั้งและเริ่มใช้งาน (Getting Started)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Environment Variables (`.env`)
คัดลอกไฟล์ตัวอย่าง `.env.example` เป็น `.env` แล้วระบุค่าคอนฟิก:
```bash
cp .env.example .env
```

```env
PORT=3000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/
MONGO_DB=user
MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1

# JWT Settings
JWT_SECRET=your_jwt_super_secret_key_here
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY_DAYS=30

# Google OAuth 2.0 (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
GOOGLE_OAUTH_ALLOWED_DOMAIN=

# Frontend & CORS
FRONTEND_URL=http://localhost:5173,https://udvc-research.online

# Session
SESSION_SECRET=your_session_secret_here

# Rate Limiting & Proxy
TRUST_PROXY=1
RATE_LIMIT_GLOBAL_MAX=1000
RATE_LIMIT_AUTH_MAX=30
```

### 3. เตรียมฐานข้อมูลและสร้างบัญชี Admin เริ่มต้น (Database Seeding)
```bash
npm run init:db
```
*ระบบจะสร้าง Collections, Indexes ที่จำเป็น และสร้างบัญชี Admin เริ่มต้น (`admin@example.com` / `admin123456`)*

### 4. รันระบบ Backend Server
```bash
# โหมดพัฒนา (Development with Nodemon)
npm run dev

# โหมด Production
npm start
```
เซิร์ฟเวอร์จะเริ่มทำงานที่: `http://localhost:3000` (หรือ Port ที่ระบุใน `.env`)

---

## 📌 สรุปเส้นทาง API (API Endpoints Summary)

### 🌐 1. Public APIs (ไม่ต้องเข้าสู่ระบบ)
- `GET /health` — ตรวจสอบสถานะการทำงานของ Server และ DB Connection
- `GET /api/public/projects` — ค้นหาและกรองรายการผลงานวิจัย (`?q=`, `title`, `categoryName`, `keyword`, `major`, `academicYear`, `page`, `limit`)
- `GET /api/public/projects/:id` — ดูรายละเอียดผลงานวิจัยตาม ID
- `GET /api/public/projects/:id/file` — สตรีมหรือดาวน์โหลดไฟล์เอกสารวิจัย PDF (`?download=1`)
- `GET /api/public/categories` — รายการหมวดหมู่ผลงานทั้งหมด
- `GET /api/public/tags` — รายการแท็ก/คำสำคัญทั้งหมด
- `GET /api/departments` — รายการแผนก/สาขาวิชาพร้อมหมวดหมู่และแท็กที่เกี่ยวข้อง

---

### 🔐 2. Auth APIs (การยืนยันตัวตน)
- `POST /api/auth/register` — สมัครสมาชิกสำหรับนักศึกษา (`studentId`, `fullName`, `major`, `email`, `password`)
- `POST /api/auth/login` — เข้าสู่ระบบด้วย Email/Password (รับ `accessToken` และ `refreshToken`)
- `POST /api/auth/refresh` — ขอ `accessToken` ใหม่ด้วย `refreshToken`
- `POST /api/auth/logout` — ยกเลิก `refreshToken` (Logout)
- `GET /api/auth/me` — ข้อมูลผู้ใช้ปัจจุบัน (ใช้ Access Token)
- `GET /api/auth/google` — ลิงก์เข้าสู่ระบบผ่าน Google OAuth 2.0
- `GET /api/auth/google/callback` — OAuth Callback Endpoint

---

### 🎓 3. Graduate / User APIs (สำหรับนักศึกษาและผู้ใช้ที่เข้าสู่ระบบ)
*(ต้องแนบ Header `Authorization: Bearer <ACCESS_TOKEN>`)*

- **ผลงานวิจัยส่วนตัว**
  - `GET /api/me/works` — ดึงรายการผลงานวิจัยของตนเอง
  - `GET /api/me/activity` — ดึงประวัติการเข้าใช้งานและกิจกรรมของตนเอง
  - `GET /api/me/advisors` — ดึงรายชื่ออาจารย์ที่ปรึกษาในผลงานของตนเอง
  - `POST /api/contents` — สร้างผลงานวิจัยใหม่
  - `GET /api/contents/:id` — ดูรายละเอียดผลงานวิจัย
  - `PATCH /api/contents/:id` — แก้ไขข้อมูลผลงานวิจัยตนเอง
  - `DELETE /api/contents/:id` — ลบผลงานวิจัยตนเอง
  - `POST /api/uploads/paper` — อัปโหลดไฟล์เอกสาร PDF (มี Header Magic Byte Validation)
- **อาจารย์ที่ปรึกษา**
  - `GET /api/users/advisors` — ค้นหาและดูรายชื่ออาจารย์ที่ปรึกษา
  - `GET /api/users/advisors/:id` — ดูรายละเอียดอาจารย์ที่ปรึกษาตาม ID
  - `POST /api/users/advisors` — เพิ่มข้อมูลอาจารย์ที่ปรึกษาใหม่เข้าสู่ระบบ (ตรวจสอบชื่อซ้ำ)
- **จัดการโปรไฟล์**
  - `PATCH /api/users/:id` — อัปเดตข้อมูลส่วนตัว / เปลี่ยนรหัสผ่าน (ยกเลิก token เก่าอัตโนมัติ)

---

### 👑 4. Admin APIs (สำหรับผู้ดูแลระบบ)
*(ต้องแนบ Header `Authorization: Bearer <ADMIN_ACCESS_TOKEN>`)*

- **Dashboard & สถิติ**
  - `GET /api/admin/dashboard` — สถิติภาพรวมระบบ (ยอดผู้ใช้, ผลงานวิจัย, ยอดเข้าชม)
- **จัดการผู้ใช้งาน**
  - `GET /api/admin/users` — รายการผู้ใช้ทั้งหมดในระบบ
  - `POST /api/users` — สร้างผู้ใช้งานใหม่โดย Admin
  - `PATCH /api/admin/users/:id/suspend` — ระงับการใช้งานบัญชี
  - `PATCH /api/admin/users/:id/activate` — ปลดการระงับบัญชี
  - `PATCH /api/admin/users/:id/role` — เปลี่ยนบทบาทผู้ใช้ (`graduate` / `admin`)
  - `POST /api/admin/users/:id/reset-password` — บังคับรีเซ็ตรหัสผ่านผู้ใช้
  - `DELETE /api/users/:id` — ลบผู้ใช้ออกจากระบบ
- **จัดการผลงานวิจัย**
  - `GET /api/admin/works` — รายการผลงานวิจัยทั้งหมดในระบบ
  - `PATCH /api/admin/works/:id` — อนุมัติ / ปรับสถานะ / แก้ไขผลงาน
  - `DELETE /api/admin/works/:id` — ลบผลงานวิจัย
- **จัดการ Catalog & สาขา**
  - `GET / POST / PATCH / DELETE /api/categories` — จัดการหมวดหมู่ผลงาน
  - `GET / POST / PATCH / DELETE /api/tags` — จัดการแท็กคำสำคัญ
  - `GET / POST / PATCH / DELETE /api/departments` — จัดการสาขาวิชาและคณะ
- **Audit & Reports**
  - `GET /api/admin/audit-logs` — ประวัติ Audit Logs การกระทำในระบบ
  - `GET /api/admin/login-logs` — ประวัติ Login Logs
  - `GET /api/admin/reports/summary` — สรุปข้อมูลรายงาน
  - `GET /api/admin/reports/export.csv` — ส่งออกรายงานในรูปแบบ CSV

---

## 🧪 คำสั่งสคริปต์ (NPM Scripts)

| คำสั่ง | รายละเอียด |
| :--- | :--- |
| `npm run dev` | เริ่มต้นเซิร์ฟเวอร์ในโหมด Development ด้วย `nodemon` |
| `npm start` | เริ่มต้นเซิร์ฟเวอร์ในโหมด Production |
| `npm run init:db` | รัน Seeding สร้างโครงสร้าง DB, Collections, Indexes และ Admin เริ่มต้น |
| `npm run test:api` | รันชุดทดสอบ API ตรวจสอบการทำงานของระบบ |
| `npm run migrate:roles` | ย้ายและปรับโครงสร้างบทบาท (Roles Migration) |

---

## 📂 โครงสร้างโปรเจกต์ (Project Structure)

```text
final_project_Backend/
├── config/             # การเชื่อมต่อฐานข้อมูล MongoDB (db.js)
├── middleware/         # Middlewares (auth.js, uploadPdf.js, rateLimiter, passport.js)
├── models/             # Mongoose Schemas & Models (User, Content, Tag, Category, Advisor, etc.)
├── routes/             # Express API Routes (auth, public, me, contents, users, admin, etc.)
├── scripts/            # Database Seeding, Migration, และ Automated Test Scripts
├── uploads/            # ที่จัดเก็บไฟล์เอกสารวิจัย PDF (uploads/pdfs/)
├── utils/              # ฟังก์ชันเสริม (auditLog, sendError, serialize, searchFilter, sanitize)
├── .env.example        # ไฟล์ตัวอย่าง Environment Variables
├── .gitignore          # ไฟล์ Git Ignore
├── package.json        # Dependencies และคำสั่งสคริปต์
├── render.yaml         # การตั้งค่าสำหรับ Deploy บน Render
└── server.js           # Main Entry Point ของ Express Application
```
