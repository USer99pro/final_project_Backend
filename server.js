require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const session = require('express-session');
const passport = require('./middleware/passport');
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

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
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
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/contents', contentsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/advisors', advisorsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/me', meRouter);
app.use('/api/admin', adminRouter);

app.use((err, _req, res, next) => {
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
  res.status(500).json({ error: err.message || 'Server error' });
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
