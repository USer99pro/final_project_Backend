require('dotenv').config();
try { require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') }); } catch (_) {}
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { securityHeaders, permissionsPolicy } = require('./middleware/securityHeaders');
const { globalLimiter, authLimiter, analyticsLimiter } = require('./middleware/rateLimiter');
const analyticsTrackRouter = require('./routes/analyticsTrack');
const { connectDB } = require('./config/db');
const authRouter = require('./routes/auth');
const { getAuth } = require('./lib/auth');
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

// ── Security: Helmet headers + Permissions-Policy ────────────────────────
app.use(securityHeaders());
app.use(permissionsPolicy);

// ── CORS — whitelist frontend origins ────────────────────────────────────
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
      // Allow non-browser requests (Postman, server-to-server) or matched origins.
      // F5: Removed wildcard .vercel.app / .onrender.com fallback — add specific
      // deployment subdomains to FRONTEND_URL in .env instead.
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      const isAllowedDomain =
        ALLOWED_ORIGINS.includes(cleanOrigin) || !IS_PROD;

      if (isAllowedDomain) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  })
);

// Prevent cross-origin cache pollution (e.g. browser caching www response and serving to non-www)
app.use('/api', (req, res, next) => {
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// ── Global rate limit (100 req / 15 min per IP) ──────────────────────────
app.use(globalLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/public', publicRouter);
// Analytics tracking — public endpoint (rate-limited, validated, no auth required)
app.use('/api/analytics', analyticsLimiter, analyticsTrackRouter);
// Auth routes get a stricter rate limit (20 req / 15 min per IP)
// Better Auth routes (coexists alongside legacy auth routes, rate-limited)
// better-auth ships ESM-only; toNodeHandler is loaded via dynamic import()
let _betterAuthHandler = null;
app.all('/api/auth/better/*', authLimiter, async (req, res, next) => {
  try {
    if (!_betterAuthHandler) {
      const [{ toNodeHandler }, authInstance] = await Promise.all([
        import('better-auth/node'),
        getAuth(),
      ]);
      _betterAuthHandler = toNodeHandler(authInstance);
    }
    return _betterAuthHandler(req, res);
  } catch (err) {
    next(err);
  }
});

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
        ? 'PDF file size exceeds the limit (maximum 15MB)'
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
  const message = IS_PROD ? 'Internal server error' : (err.message || 'Server error');
  if (!IS_PROD) console.error('[Server Error]', err);
  res.status(500).json({ error: message });
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  connectDB()
    .then(() => {
      const server = app.listen(PORT, () => {
        console.log(`✅ API ready → http://localhost:${PORT}`);
        console.log(`   JWT expiry    : 30 days`);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`\n❌ Port ${PORT} is already in use`);
          console.error(`   netstat -ano | findstr :${PORT}  then  taskkill /PID <pid> /F\n`);
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

