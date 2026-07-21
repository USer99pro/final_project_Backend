# Research Portal API (Back_End)

ระบบสืบค้นผลงานวิจัย — REST API (Express + MongoDB)

## กลุ่มผู้ใช้

| กลุ่ม | สิทธิ์ |
|--------|--------|
| นักศึกษาปัจจุบัน | สืบค้น/ดู/ดาวน์โหลดผลงานที่เผยแพร่ — **ไม่ต้อง login** |
| นักศึกษาจบการศึกษา (`graduate`) | สมัครสมาชิก, CRUD ผลงานตัวเอง, แก้โปรไฟล์, ดูประวัติ |
| ผู้ดูแลระบบ (`admin`) | จัดการผู้ใช้, ผลงาน, หมวดหมู่/แท็ก, dashboard, รายงาน |

## เริ่มต้น

```bash
cp .env.example .env   # หรือแก้ .env ที่มีอยู่
npm install
npm run init:db
npm start
```

พอร์ตเริ่มต้น: `3500` (ตั้ง `PORT` ใน `.env`)

## API หลัก

### สาธารณะ (ไม่ต้อง login)

- `GET /api/public/projects?q=` — ค้นหาชื่อผลงาน, ชื่อผู้วิจัย, ประเภท และ keyword
- ตัวกรองเฉพาะ: `title`, `researcher` (หรือ `studentName`), `categoryName`, `keyword`, `major`, `academicYear`
- `GET /api/public/projects/:id`
- `GET /api/public/projects/:id/file?download=1`
- `GET /api/public/categories?department=:departmentId` | `/api/public/tags?department=:departmentId&category=:categoryId`
- `GET /api/departments` — แผนกพร้อมประเภทและแท็กที่เชื่อมโยงกัน

### Auth

- `POST /api/auth/register` — นักศึกษาจบสมัครสมาชิก
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer token)

### นักศึกษาจบ

- `GET /api/me/works` | `GET /api/me/activity`
- `GET/POST/PATCH/DELETE /api/contents`
- `PATCH /api/users/:id` (โปรไฟล์ตัวเอง)
- ส่ง `keyword` หรือ `keywords` (ข้อความคั่นด้วย comma หรือ array) พร้อม `POST/PATCH /api/contents` เพื่อให้ระบบสร้าง keyword ของผู้ใช้ให้อัตโนมัติ

### Admin

- `GET /api/admin/dashboard`
- `PATCH /api/admin/users/:id/suspend|activate|role`
- `POST /api/admin/users/:id/reset-password`
- `GET /api/admin/works` | `/audit-logs` | `/login-logs`
- `GET /api/admin/reports/summary` | `/reports/export.csv`

## ทดสอบ

```bash
npm run test:api
```

## Front-End

ดู [`../Front_End/README.md`](../Front_End/README.md)
