# ภาพรวมระบบ Research Portal

เอกสารนี้สรุประบบจากโค้ดปัจจุบันของ frontend และ backend ใช้สำหรับทำความเข้าใจส่วนประกอบ การทำงาน และจุดเชื่อมต่อหลัก

## 1. วัตถุประสงค์

Research Portal เป็นระบบจัดเก็บและเผยแพร่ผลงานวิจัย/ปริญญานิพนธ์ ผู้ใช้ทั่วไปค้นหาและอ่านผลงานได้ บัณฑิตจัดการผลงานและข้อมูลส่วนตัว ส่วนผู้ดูแลระบบจัดการบัญชี เนื้อหา และข้อมูลประกอบ

## 2. ภาพรวมสถาปัตยกรรม

```text
ผู้ใช้ / Browser
      │
      ▼
Frontend: React + Vite (final_project_FontEnd)
      │ Axios, REST/JSON, Bearer access token
      ▼
Backend: Express API (final_project_Backend)
      ├── MongoDB ผ่าน Mongoose
      └── PDF ใน MongoDB (PdfFile) และไฟล์นำเข้าผู้ใช้ CSV/XLSX
```

- Frontend และ backend เป็นคนละโปรเจกต์และ deploy แยกกัน
- Frontend กำหนด URL ของ API ด้วย `VITE_API_URL`; หากไม่กำหนดจะเรียก URL ปัจจุบันแบบ relative
- Backend รองรับ Express server และ Vercel serverless entry point
- Backend ใช้ MongoDB เป็นที่เก็บข้อมูลหลัก รวมถึงข้อมูล PDF ในโมเดล `PdfFile`

## 3. Frontend

### เทคโนโลยี

React 19, Vite 7, React Router, Tailwind CSS 4, Axios, Framer Motion, Recharts, Lucide React และ Vercel Analytics.

### หน้าจอและเส้นทาง

| Path | ผู้ใช้ | หน้าที่ |
|---|---|---|
| `/` | ทุกคน | ค้นหาและเรียกดูผลงาน |
| `/projects/:id` | ทุกคน | รายละเอียดผลงานและไฟล์ PDF |
| `/login` | ทุกคน | เข้าสู่ระบบ |
| `/about`, `/contact`, `/privacy`, `/terms` | ทุกคน | ข้อมูลเกี่ยวกับระบบและนโยบาย |
| `/graduate` | graduate | แดชบอร์ดบัณฑิต |
| `/graduate/works` | graduate | รายการผลงานของฉัน |
| `/graduate/works/new` | graduate | สร้างผลงาน |
| `/graduate/works/:id/edit` | graduate | แก้ไขผลงาน |
| `/graduate/profile` | graduate | ข้อมูลโปรไฟล์ |
| `/graduate/activity` | graduate | ประวัติกิจกรรม |
| `/admin` | admin | แดชบอร์ดผู้ดูแล |
| `/admin/users` | admin | จัดการบัญชีผู้ใช้ |
| `/admin/works` | admin | ตรวจสอบและจัดการผลงาน |
| `/admin/categories` | admin | จัดการหมวดหมู่และแท็ก |
| `/admin/advisors` | admin | จัดการอาจารย์ที่ปรึกษา |
| `/admin/logs` | admin | ตรวจสอบ audit logs |

การจำกัดหน้าตามบทบาททำผ่าน `ProtectedRoute` และสถานะการเข้าสู่ระบบอยู่ใน `AuthContext` หน้า register ไม่ได้เปิดใน router ปัจจุบัน แม้ backend จะมี endpoint สมัครสมาชิกอยู่

### โครงสร้างสำคัญ

- `src/App.jsx`: กำหนด routes และ providers
- `src/api/client.js`: Axios client, แนบ access token และจัดการ refresh token เมื่อได้รับ 401
- `src/context/AuthContext.jsx`: สถานะผู้ใช้และการเข้าสู่ระบบ
- `src/pages/`: หน้าสาธารณะ บัณฑิต และผู้ดูแลระบบ
- `src/components/`: layout, route guard, คอมโพเนนต์ร่วม และ analytics
- `src/hooks/`: hooks สำหรับ query ข้อมูลผลงาน ผู้ใช้ metadata analytics และอาจารย์
- `src/utils/`: ความปลอดภัยและ analytics ฝั่ง client

### คำสั่ง

```bash
npm install
npm run dev
npm run build
npm test
```

## 4. Backend

### เทคโนโลยีและการทำงาน

Node.js, Express, MongoDB/Mongoose, JWT, bcrypt, Multer และ XLSX. `server.js` ตั้งค่า middleware, CORS, security headers, rate limits, routes และ error handling; `api/index.js` เป็น entry point สำหรับ serverless.

### กลุ่ม API

ทุก path ด้านล่างมี prefix `/api` เว้นแต่ `/health`.

| กลุ่ม | ตัวอย่าง endpoint | หน้าที่ |
|---|---|---|
| Health | `GET /health` | ตรวจสถานะ API |
| Public | `GET /public/projects`, `GET /public/projects/:id`, `GET /public/projects/:id/file`, `/public/categories`, `/public/tags`, `/public/advisors`, `/public/stats` | ค้นหาและอ่านข้อมูลสาธารณะ |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, เปลี่ยน/รีเซ็ตรหัสผ่าน | บัญชีและ session |
| Contents | `/contents` และ `/contents/:id` | สร้าง อ่าน แก้ไข ลบผลงาน |
| Me | `/me/works`, `/me/co-works`, `/me/activity`, `/me/advisors` | ข้อมูลและกิจกรรมของผู้ใช้ปัจจุบัน |
| Users | `/users` และ `/users/advisors` | จัดการผู้ใช้และข้อมูลอาจารย์ที่ปรึกษา |
| Admin | `/admin/dashboard`, `/admin/users`, `/admin/works`, `/admin/audit-logs`, `/admin/reports/*` | งานผู้ดูแล นำเข้าผู้ใช้ รายงาน และบันทึกตรวจสอบ |
| Catalog | `/categories`, `/tags`, `/departments`, `/advisors` | หมวดหมู่ แท็ก สาขา และอาจารย์ที่ปรึกษา |
| Uploads | `/uploads/papers` | เข้าถึงไฟล์เอกสาร |
| Analytics | `/analytics` | บันทึกและอ่านสถิติการใช้งาน |

เส้นทางย่อยและ HTTP methods ขึ้นกับ resource เช่น `GET`, `POST`, `PATCH`, `DELETE`; ดูรายละเอียดล่าสุดใน `routes/*.js`.

### บทบาทและข้อมูล

- `graduate`: จัดการผลงานที่เกี่ยวข้องกับตนเองและข้อมูลของตน
- `admin`: จัดการผู้ใช้ ผลงาน และ catalog รวมถึงดูรายงานและ audit logs
- `user`: มีอยู่ใน enum ของฐานข้อมูล; serialization ปัจจุบันแสดง role นี้เป็น `graduate`
- ผลงาน (`Content`) เชื่อมกับผู้เขียน ผู้ร่วมทำ อาจารย์ที่ปรึกษา หมวดหมู่ และแท็ก สถานะหลักคือ `draft` หรือ `published`
- โมเดลข้อมูลอื่นประกอบด้วย `Department`, `Advisor`, `Category`, `Tag`, `PdfFile`, `RefreshToken`, `AuditLog`, `ActivityLog`, `Analytics`, `SearchLog`, `ViewLog`, `DownloadLog`

### การยืนยันตัวตนและความปลอดภัย

- Access token เป็น JWT อายุสั้น; refresh token ถูกเก็บแบบ hash ในฐานข้อมูลและหมุนเวียนเมื่อ refresh
- รหัสผ่าน hash ด้วย bcrypt; middleware ตรวจ token และ role ก่อนเข้าถึง resource ที่จำกัดสิทธิ์
- ใช้ Helmet, CORS allowlist, rate limiting, error sanitization และตรวจ magic bytes ของ PDF; upload จำกัดชนิด PDF และขนาด (15 MB ตาม handler)
- มี Better Auth handler อยู่ใต้ `/api/auth/better/*` ควบคู่กับ auth routes เดิม

### คำสั่ง

```bash
npm install
npm run init:db
npm run dev
npm start
npm run test:api
```

ตั้งค่าตัวแปรสภาพแวดล้อมตามที่ backend ใช้ เช่น `MONGO_URI`, `JWT_SECRET`, `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY_DAYS`, `FRONTEND_URL` และ `PORT` ก่อนรัน ดูค่าอ้างอิงใน README และการอ่านค่าใน `config/` กับ `server.js`; อย่าใส่ secret จริงในเอกสารหรือ repository

## 5. การไหลของงานหลัก

1. ผู้เยี่ยมชมค้นหาผลงานจากหน้าแรก Frontend เรียก public API แล้ว Backend ค้นข้อมูล MongoDB และส่งผลลัพธ์กลับ
2. ผู้ใช้เข้าสู่ระบบ Backend ตรวจบัญชีและรหัสผ่าน แล้วส่ง access/refresh tokens; Frontend ใช้ access token กับ API และพยายาม refresh เมื่อ session หมดอายุ
3. บัณฑิตส่งผลงานพร้อม metadata และไฟล์ PDF; Backend ตรวจสิทธิ์/ไฟล์และบันทึกข้อมูล จากนั้นผลงานรอการจัดการหรือเผยแพร่ตามสถานะ
4. ผู้ดูแลตรวจผลงานและจัดการผู้ใช้หรือ catalog ผ่านหน้า Admin ซึ่งเรียก admin API
5. การดู ดาวน์โหลด และกิจกรรมบางชนิดถูกบันทึกเพื่อใช้ใน analytics และประวัติระบบ

## 6. ขอบเขตและข้อสังเกต

- เอกสารนี้อธิบายสิ่งที่พบใน source code; ค่าการตั้งค่า production, ข้อมูลจริงในฐานข้อมูล และการตั้งค่า hosting อาจแตกต่างกัน
- README ของ frontend กล่าวถึง `/register` แต่ route ปัจจุบันใน `src/App.jsx` ระบุว่าเอาออกแล้ว การสร้างบัญชีจึงควรตรวจขั้นตอนปัจจุบันของผู้ดูแลระบบ
- README บางส่วนอาจมีค่า port/ตัวอย่าง environment ที่ไม่ตรงกับ deployment ปัจจุบัน ให้ยึด environment ของแต่ละระบบและไฟล์ config เป็นหลัก

## 7. ที่ตั้งโค้ด

- Frontend: `../final_project_FontEnd/`
- Backend: repository ที่มีไฟล์สรุปนี้
- API routes: `routes/`
- Models: `models/`
- Frontend router: `../final_project_FontEnd/src/App.jsx`
