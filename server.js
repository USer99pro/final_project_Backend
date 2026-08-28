require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const session = require('express-session');
const passport = require('./middleware/passport');
const { securityHeaders, permissionsPolicy } = require('./middleware/securityHeaders');
const { globalLimiter, authLimiter } = require('./middleware/rateLimiter');
const { connectDB } = require('./config/db');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const contentsRouter = require('./routes/contents');
const tagsRouter = require('./routes/tags');
const categoriesRouter = require('./routes/categories');
const departmentsRouter = require('./routes/departments');
const uploadsRouter = require('./routes/uploads');
const publicRouter = require('./routes/public');
const meRouter = require('./routes/me');
const adminRouter = require('./routes/admin');
const advisorsRouter = require('./routes/advisors');

const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ── Security: Helmet headers + Permissions-Policy ────────────────────────────
app.use(securityHeaders());
app.use(permissionsPolicy);

// ── CORS — whitelist frontend origin only ────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = [
  FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (Postman, server-to-server) in development
      if (!origin || ALLOWED_ORIGINS.includes(origin) || !IS_PROD) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  })
);

// ── Global rate limit (100 req / 15 min per IP) ───────────────────────────────
app.use(globalLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Session (required by Passport for OAuth state parameter) ─────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 10 * 60 * 1000 }, // 10 min — only for OAuth handshake
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/public', publicRouter);
// Auth routes get a stricter rate limit (20 req / 15 min per IP)
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/users', usersRouter);
app.use('/api/contents', contentsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/advisors', advisorsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/me', meRouter);
app.use('/api/admin', adminRouter);

// Keep API failures machine-readable as JSON, including unknown routes.
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
});

app.use((err, _req, res, next) => {
  // CORS rejection
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'ไฟล์ PDF มีขนาดใหญ่เกินกำหนด (สูงสุด 15MB)'
        : err.message;
    return res.status(400).json({ error: message });
  }
  if (/PDF|pdf|multipart/i.test(err.message || '')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.use((err, _req, res, _next) => {
  // ── Sanitize error responses in production ──────────────────────────────
  // Never leak internal stack traces or raw error messages to clients.
  const message = IS_PROD ? 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' : (err.message || 'Server error');
  if (!IS_PROD) console.error('[Server Error]', err);
  res.status(500).json({ error: message });
});

connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`✅ API ready → http://localhost:${PORT}`);
      console.log(`   JWT expiry    : 30 days`);
      console.log(`   Google OAuth  : ${process.env.GOOGLE_CLIENT_ID ? 'configured ✓' : '⚠ GOOGLE_CLIENT_ID not set'}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ พอร์ต ${PORT} ถูกใช้งานอยู่แล้ว`);
        console.error(`   netstat -ano | findstr :${PORT}  แล้ว  taskkill /PID <pid> /F\n`);
        process.exit(1);
      }
      throw err;
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
