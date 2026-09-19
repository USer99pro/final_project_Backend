# Frontend & Fullstack Integration Reference: API, Security, Middleware & Roles
**Project:** UDVC Research Portal (`final_project_Backend`)  
**Target Audience:** Frontend Developers, Fullstack Engineers, System Architects  
**Updated:** August 2026

---

## 📋 1. System Overview & Authentication Architecture

### 1.1 Base Configuration
* **Base URL:** `http://localhost:3500` (or production domain `https://udvc-research.online`)
* **Content Types:** `application/json` (Standard API), `multipart/form-data` (File Uploads)

### 1.2 Dual-Token Authentication System (JWT + Refresh Token)
The system uses short-lived access tokens combined with database-backed, rotating refresh tokens for high security and instant session revocation.

```
Client                             Backend                             Database
  │                                   │                                   │
  ├─── POST /api/auth/login ─────────►│                                   │
  │    (email, password)              ├─── Validate credentials ─────────►│
  │                                   │◄── User record ───────────────────┤
  │◄── 200 OK ────────────────────────┤ (Generates Access Token 15m +     │
  │    { accessToken, refreshToken }  │  Hashed Refresh Token 30d)        │
  │                                   │                                   │
  ├─── GET /api/contents ────────────►│ (Authenticate Middleware)          │
  │    Header: Bearer <accessToken>   ├─── Verify JWT & tokenVersion ────►│
  │◄── 200 OK (Data) ─────────────────┤                                   │
  │                                   │                                   │
  ├─── GET /api/contents ────────────►│                                   │
  │◄── 401 TOKEN_EXPIRED ─────────────┤ (JWT Expired)                     │
  │                                   │                                   │
  ├─── POST /api/auth/refresh ────────►│                                   │
  │    Body: { refreshToken }         ├─── Verify & Rotate Token ────────►│
  │◄── 200 OK ────────────────────────┤    - Revoke old token            │
  │    { accessToken, refreshToken }  │    - Issue new pair               │
```

#### Token Lifetime & Storage Guidelines
* **Access Token (`JWT`):** Valid for `15 minutes`.
  * Send via Header: `Authorization: Bearer <accessToken>`
  * Payload contains: `{ userId, role, tokenVersion }`
* **Refresh Token:** Valid for `30 days`. Stored in MongoDB with SHA-256 hash.
  * Automatic rotation: Every refresh revokes the old token and issues a new pair.
  * Replay Detection: Using a revoked refresh token immediately invalidates the entire token family, forcing re-authentication.
* **Instant Revocation (`tokenVersion`):**
  * Admin actions (password reset, account suspension, role changes) increment `tokenVersion`, instantly invalidating all active JWT access tokens worldwide.

---

## 🛡️ 2. Security Middleware & Policies

### 2.1 HTTP Security Headers (`securityHeaders.js`)
Configured via `helmet` to meet OWASP and Google Top-10 SEO/Security standards:

| Header | Production Value | Description |
| :--- | :--- | :--- |
| **`Content-Security-Policy`** | `default-src 'self' ...` | Restricts script, style, font sources (allows Google Fonts). |
| **`Strict-Transport-Security`** | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS for 2 years (active in `NODE_ENV=production`). |
| **`X-Frame-Options`** | `SAMEORIGIN` | Protects against Clickjacking attacks. |
| **`X-Content-Type-Options`** | `nosniff` | Prevents MIME-type sniffing. |
| **`Referrer-Policy`** | `strict-origin-when-cross-origin` | Protects sensitive URL data on external links. |
| **`Permissions-Policy`** | `geolocation=(), microphone=(), camera=(), payment=()` | Disables risky browser APIs. |

### 2.2 Rate Limiting (`rateLimiter.js`)
Protection against DoS, brute-force attacks, and API abuse:
* **Global Rate Limiter:** `100 requests / 15 minutes` per IP (applies to all `/api/*` endpoints except `/health`).
* **Auth Rate Limiter:** `20 requests / 15 minutes` per IP (applied strictly to `/api/auth/*` routes: login, register, forgot-password).
* **HTTP 429 Response Format:**
  ```json
  {
    "error": "Too many requests — please try again later.",
    "retryAfter": 895
  }
  ```

### 2.3 CORS Policy
* Hardened whitelist enforcing `FRONTEND_URL` (`http://localhost:5173`, `http://localhost:3000`, `https://udvc-research.online`).
* `credentials: true` enabled for cross-origin requests.

### 2.4 Error Sanitization
* In `production` (`NODE_ENV=production`), generic 500 error responses mask internal error details and stack traces to prevent info leakage:
  ```json
  { "error": "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }
  ```
* In `development`, full error messages and logs are emitted.

---

## 👥 3. Role-Based Access Control (RBAC) Matrix

### Role Definitions
1. **`admin`**: System Administrator with unlimited system privileges.
2. **`graduate`** (also legacy `user`): Registered Student / Graduate Researcher.
3. **`Public`**: Unauthenticated guest user.

```
                    ┌─────────────────────────────────────────────────┐
                    │                   ROLE MATRIX                   │
                    ├──────────────────┬──────────┬──────────┬────────┤
                    │ Feature / Action │  Public  │ Graduate │ Admin  │
                    ├──────────────────┼──────────┼──────────┼────────┤
                    │ Search & Filter  │    ✓     │    ✓     │   ✓    │
                    │ Read Public PDF  │    ✓     │    ✓     │   ✓    │
                    │ Register/Login   │    ✓     │    ✓     │   ✓    │
                    │ Create Research  │    ✗     │    ✓     │   ✓    │
                    │ Edit Own Work    │    ✗     │    ✓     │   ✓    │
                    │ Edit Any Work    │    ✗     │    ✗     │   ✓    │
                    │ Delete Any Work  │    ✗     │    ✗     │   ✓    │
                    │ Manage Users     │    ✗     │    ✗     │   ✓    │
                    │ Suspend Account  │    ✗     │    ✗     │   ✓    │
                    │ Add Advisor      │    ✗     │    ✓     │   ✓    │
                    │ Access Audit Log │    ✗     │    ✗     │   ✓    │
                    └──────────────────┴──────────┴──────────┴────────┘
```

### Detailed Middleware Guard Policies

| Middleware Guard | Condition / Rule | Behavioral Outcome |
| :--- | :--- | :--- |
| `authenticate` | Checks Bearer JWT + `user.isActive` + matching `tokenVersion` | Returns `401 Unauthorized` or `403 Forbidden` if suspended/revoked |
| `requireAdmin` | `req.user.role === 'admin'` | Returns `403 Forbidden: ต้องเป็นผู้ดูแลระบบ (admin) เท่านั้น` |
| `requireGraduate` | `role === 'graduate' || role === 'user' || role === 'admin'` | Grants access to research creation and profile editing |
| `isOwnerOrAdmin` | `req.user.role === 'admin' || doc.author === req.user._id` | Restricts edit/delete actions on specific research items |

---

## 📦 4. Data Models & JSON Schemas

### 4.1 User Model (`User`)
```json
{
  "_id": "66d01a2b8e3f9a0012a34567",
  "studentId": "64309010001",
  "fullName": "นายสมชาย ใจดี",
  "email": "somchai@udvc.ac.th",
  "role": "graduate",
  "major": "เทคโนโลยีสารสนเทศ",
  "phone": "0812345678",
  "isActive": true,
  "createdAt": "2026-08-28T10:00:00.000Z"
}
```

### 4.2 Research Content Model (`Content`)
```json
{
  "_id": "66d02b3c8e3f9a0012a34588",
  "title": "การพัฒนาระบบสืบค้นผลงานวิจัยของนักศึกษาระดับปริญญาตรี",
  "description": "ระบบสืบค้นข้อมูลผลงานวิจัยแบบเปิด",
  "abstract": "บทคัดย่อเนื้อหางานวิจัย...",
  "studentName": "นายสมชาย ใจดี",
  "major": "เทคโนโลยีสารสนเทศ",
  "academicYear": "2569",
  "status": "published",
  "isPublicDownload": true,
  "author": {
    "_id": "66d01a2b8e3f9a0012a34567",
    "fullName": "นายสมชาย ใจดี",
    "email": "somchai@udvc.ac.th",
    "studentId": "64309010001",
    "major": "เทคโนโลยีสารสนเทศ"
  },
  "participants": [
    {
      "_id": "66d01a908e3f9a0012a34599",
      "fullName": "นางสาวสมหญิง รักดี",
      "email": "somying@udvc.ac.th",
      "studentId": "64309010002"
    }
  ],
  "advisors": [
    {
      "_id": "66d03c4d8e3f9a0012a34600",
      "prefix": "ดร.",
      "fullName": "วิชัย วิชาการ",
      "academicPosition": "อาจารย์ประจำสาขา",
      "email": "wichai@udvc.ac.th",
      "departmentName": "เทคโนโลยีสารสนเทศ"
    }
  ],
  "category": {
    "_id": "66d04e5f8e3f9a0012a34700",
    "name": "วิทยาการคอมพิวเตอร์และปัญญาประดิษฐ์"
  },
  "tags": [
    { "_id": "66d05f6a8e3f9a0012a34800", "name": "Web Application" }
  ],
  "pdfFilename": "1724889600000-research-paper.pdf",
  "pdfOriginalName": "final_research_paper.pdf",
  "pdfUrl": "/api/public/projects/66d02b3c8e3f9a0012a34588/file",
  "createdAt": "2026-08-28T12:00:00.000Z"
}
```

---

## 📡 5. Complete API Routes Reference

### 🌐 Public Endpoints (`/api/public/*`) — No Auth Required
* `GET /api/public/stats` — Overall statistics for home page (`totalProjects`, `totalStudents`, `totalMajors`, `latestYear`).
* `GET /api/public/projects` — Filter & search published projects (`q`, `studentName`, `major`, `academicYear`, `category`, `tag`).
* `GET /api/public/projects/:id` — Details of a published research project.
* `GET /api/public/projects/:id/file?download=1` — Stream PDF file (inline preview or attachment download).
* `GET /api/public/categories` — Category catalog.
* `GET /api/public/tags` — Tag list.
* `GET /api/public/advisors` — Directory of active advisors (`q`, `department`, `expertise`).

### 🔑 Authentication Endpoints (`/api/auth/*`) — Rate Limited (20 req/15min)
* `POST /api/auth/register` — Student registration.
* `POST /api/auth/login` — Login with email/password → Returns `{ accessToken, refreshToken, user }`.
* `POST /api/auth/refresh` — Rotate refresh token → Returns new `{ accessToken, refreshToken, user }`.
* `POST /api/auth/logout` — Revoke active refresh token session.
* `GET  /api/auth/me` — Current user info (Requires Bearer token).
* `POST /api/auth/forgot-password` — Request password reset token.
* `POST /api/auth/reset-password` — Reset password using token.
* `POST /api/auth/change-password` — Change password for logged-in user.
* `GET  /api/auth/google` — Trigger Google OAuth login.
* `GET  /api/auth/google/callback` — Google OAuth callback.

### 👤 Self-Service Endpoints (`/api/me/*`) — Requires Auth
* `GET /api/me/works` — Get logged-in user's research projects.
* `GET /api/me/activity` — Get user activity log.
* `GET /api/me/advisors` — List advisors associated with user's research works.

### 📚 Research Content Endpoints (`/api/contents/*`) — Requires Auth
* `GET /api/contents` — List user's works (or all works if Admin).
* `GET /api/contents/:id` — View specific work (Owner or Admin).
* `POST /api/contents` — Create new research project (`multipart/form-data` with `pdf`).
* `PATCH /api/contents/:id` — Update research project (Owner or Admin).
* `DELETE /api/contents/:id` — Delete research project (Owner or Admin).

### 🛠️ User Directory & Advisors (`/api/users/*`) — Requires Auth
* `GET /api/users` — Search/list active users in same department (for adding participants).
* `GET /api/users/advisors` — Search advisors directory.
* `POST /api/users/advisors` — Add new advisor (Graduate / Admin). Checks for duplicate `fullName` + `academicPosition`.

### ⚡ Admin Endpoints (`/api/admin/*`) — Admin Only
* `GET /api/admin/dashboard` — High-level platform metrics & login analytics.
* `GET /api/admin/users` — Paginated user management list (`role`, `isActive`, `major`, `search`).
* `PATCH /api/admin/users/:id/suspend` — Suspend user account + revoke all tokens.
* `PATCH /api/admin/users/:id/activate` — Reactivate suspended account.
* `PATCH /api/admin/users/:id/role` — Update role (`graduate` ↔ `admin`) + revoke tokens.
* `POST /api/admin/users/:id/reset-password` — Force reset user password by `_id` or `studentId`.
* `GET /api/admin/works` — Admin management view of all works.
* `PATCH /api/admin/works/:id` — Admin override edit any work.
* `DELETE /api/admin/works/:id` — Admin override delete any work.
* `GET /api/admin/audit-logs` — Audit log trail.
* `GET /api/admin/login-logs` — User login activity log.
* `GET /api/admin/reports/summary` — Periodical summary reports.
* `GET /api/admin/reports/export.csv` — CSV export of all research projects.

---

## 🛠️ 6. Frontend Integration Guidelines

1. **Handling 401 Errors & Refresh Token Flow:**
   Implement an Axios interceptor to catch `401` errors with code `TOKEN_EXPIRED`, invoke `/api/auth/refresh`, update stored tokens, and retry the failed request seamlessly.
2. **Handling 429 Too Many Requests:**
   Catch `429` status codes and inform users to wait according to the `retryAfter` seconds returned in the response.
3. **Form Upload Format:**
   When submitting research with PDF files, use `FormData` with `pdf` field name:
   ```javascript
   const formData = new FormData();
   formData.append('title', title);
   formData.append('pdf', fileInput.files[0]);
   ```
