require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const session = require('express-session');
const passport = require('./middleware/passport');
const { securityHeaders, permissionsPolicy } = require('./middleware/securityHeaders');
const { globalLimiter, authLimiter, analyticsLimiter } = require('./middleware/rateLimiter');
const analyticsTrackRouter = require('./routes/analyticsTrack');
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

// Trust reverse proxy (e.g. Render, Heroku, Cloudflare) to correctly identify client IP in rate limiting
app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

// â”€â”€ Security: Helmet headers + Permissions-Policy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(securityHeaders());
app.use(permissionsPolicy);

// â”€â”€ CORS â€” whitelist frontend origins â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const rawFrontendUrls = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

const defaultOrigins = [
  'https://www.udvc-research.online',
  'https://udvc-research.online',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:3500',
];

const expandedOrigins = [];
rawFrontendUrls.forEach((url) => {
  expandedOrigins.push(url);
  try {
    const parsed = new URL(url);
    if (parsed.hostname.startsWith('www.')) {
      const nonWwwHost = parsed.hostname.replace(/^www\./, '');
      expandedOrigins.push(`${parsed.protocol}//${nonWwwHost}`);
    } else if (parsed.hostname !== 'localhost' && !parsed.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      expandedOrigins.push(`${parsed.protocol}//www.${parsed.hostname}`);
    }
  } catch (_e) {
    // Ignore invalid URL format in env
  }
});

const ALLOWED_ORIGINS = Array.from(new Set([...expandedOrigins, ...defaultOrigins]));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (Postman, server-to-server) or matched origins
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      const isAllowedDomain =
        ALLOWED_ORIGINS.includes(cleanOrigin) ||
        !IS_PROD ||
        cleanOrigin.endsWith('.vercel.app') ||
        cleanOrigin.endsWith('.onrender.com');

      if (isAllowedDomain) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  })
);

// â”€â”€ Global rate limit (100 req / 15 min per IP) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(globalLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// â”€â”€ Session (required by Passport for OAuth state parameter) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 10 * 60 * 1000 }, // 10 min â€” only for OAuth handshake
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/public', publicRouter);
// Analytics tracking — public endpoint (rate-limited, validated, no auth required)
app.use('/api/analytics', analyticsLimiter, analyticsTrackRouter);
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
        ? 'à¹„à¸Ÿà¸¥à¹Œ PDF à¸¡à¸µà¸‚à¸™à¸²à¸”à¹ƒà¸«à¸à¹ˆà¹€à¸à¸´à¸™à¸à¸³à¸«à¸™à¸” (à¸ªà¸¹à¸‡à¸ªà¸¸à¸” 15MB)'
        : err.message;
    return res.status(400).json({ error: message });
  }
  if (/PDF|pdf|multipart/i.test(err.message || '')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.use((err, _req, res, _next) => {
  // â”€â”€ Sanitize error responses in production â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Never leak internal stack traces or raw error messages to clients.
  const message = IS_PROD ? 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¸ à¸²à¸¢à¹ƒà¸™à¹€à¸‹à¸´à¸£à¹Œà¸Ÿà¹€à¸§à¸­à¸£à¹Œ' : (err.message || 'Server error');
  if (!IS_PROD) console.error('[Server Error]', err);
  res.status(500).json({ error: message });
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  connectDB()
    .then(() => {
      const server = app.listen(PORT, () => {
        console.log(`âœ… API ready â†’ http://localhost:${PORT}`);
        console.log(`   JWT expiry    : 30 days`);
        console.log(`   Google OAuth  : ${process.env.GOOGLE_CLIENT_ID ? 'configured âœ“' : 'âš  GOOGLE_CLIENT_ID not set'}`);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`\nâ Œ à¸žà¸­à¸£à¹Œà¸• ${PORT} à¸–à¸¹à¸ à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸­à¸¢à¸¹à¹ˆà¹ à¸¥à¹‰à¸§`);
          console.error(`   netstat -ano | findstr :${PORT}  à¹ à¸¥à¹‰à¸§  taskkill /PID <pid> /F\n`);
          process.exit(1);
        }
        throw err;
      });
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  connectDB().catch((err) => {
    console.error('MongoDB Connection Error:', err);
  });
}

module.exports = app;

