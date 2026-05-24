const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { connectDB } = require('./config/db');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const contentsRouter = require('./routes/contents');
const tagsRouter = require('./routes/tags');
const categoriesRouter = require('./routes/categories');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/contents', contentsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/categories', categoriesRouter);

app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError || /PDF|multipart/i.test(err.message || '')) {
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
      console.log(`API http://localhost:${PORT}`);
      console.log('  POST /api/auth/login');
      console.log('  GET  /api/auth/me          (Bearer token)');
      console.log('  GET  /api/contents         (login)');
      console.log('  POST /api/contents         (multipart: title, description?, category?, tags?, pdf?)');
      console.log('  GET  /api/tags | /api/categories');
      console.log('  Admin: POST/PATCH/DELETE users, tags, categories');
      console.log('  Setup DB + admin: npm run init:db');
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ พอร์ต ${PORT} ถูกใช้งานอยู่แล้ว (มี server รันอยู่แล้ว)`);
        console.error(`   หยุด process เดิม: netstat -ano | findstr :${PORT}  แล้ว  taskkill /PID <pid> /F`);
        console.error(`   หรือเปลี่ยนพอร์ตใน .env: PORT=3001\n`);
        process.exit(1);
      }
      throw err;
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
