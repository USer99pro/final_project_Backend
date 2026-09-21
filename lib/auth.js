'use strict';

const path = require('path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

// Ensure environment variables are loaded if lib/auth.js is imported directly
dotenv.config();
try {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
} catch (_) {}

// ── Fail fast on missing or weak BETTER_AUTH_SECRET in production ────────────
const IS_PROD = process.env.NODE_ENV === 'production';
let _BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const _WEAK_DEFAULTS = new Set(['change-me', 'secret', '', undefined]);

if (!_BETTER_AUTH_SECRET || _WEAK_DEFAULTS.has(_BETTER_AUTH_SECRET) || _BETTER_AUTH_SECRET.length < 32) {
  if (IS_PROD) {
    console.error(
      '[FATAL] BETTER_AUTH_SECRET is missing or too short (< 32 chars). ' +
      'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
    process.exit(1);
  } else {
    console.warn('[Better Auth] BETTER_AUTH_SECRET missing in development. Using local dev secret.');
    _BETTER_AUTH_SECRET = '25e028589461d474aea1832fde8e0fe84c70f604fa1f6c46b113f681017b9f38';
  }
}

const mongoClient = new MongoClient(
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/user'
);

// Connect the native client (fire-and-forget; Better Auth will queue operations)
mongoClient.connect().catch((err) => {
  console.error('[Better Auth] MongoDB native client connection error:', err.message);
});

const db = mongoClient.db(process.env.MONGO_DB || 'user');

// ── Derive trusted origins from existing FRONTEND_URL env var ────────────────
const _rawFrontendUrls = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((u) => u.trim().replace(/\/$/, ''))
  .filter(Boolean);

// ── Lazy-init Better Auth (ESM dynamic import) ───────────────────────────────
// better-auth ships ESM-only (.mjs); using dynamic import() which works in CJS.
let _authInstance = null;

async function getAuth() {
  if (_authInstance) return _authInstance;

  const { betterAuth } = await import('better-auth');
  const { mongodbAdapter } = await import('better-auth/adapters/mongodb');

  _authInstance = betterAuth({
    // Public URL of this API — used for cookie domain, CSRF, and OAuth callbacks
    baseURL: process.env.BETTER_AUTH_URL || process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:3000',

    // Base path for Better Auth routes to coexist cleanly with existing /api/auth routes
    basePath: process.env.BETTER_AUTH_BASE_PATH || '/api/auth/better',

    // Database adapter
    database: mongodbAdapter(db),

    // Secret for signing session tokens and CSRF tokens
    secret: _BETTER_AUTH_SECRET,

    // Email + password authentication
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      // Do not auto-sign-in after registration; force explicit login
      autoSignIn: false,
    },

    // Trusted cross-origin frontends (uses same list as existing CORS config)
    trustedOrigins: _rawFrontendUrls,

    // Session configuration — keep short-lived for security
    session: {
      expiresIn: 60 * 60 * 24 * 7,        // 7 days (seconds)
      updateAge: 60 * 60 * 24,             // refresh session if older than 1 day
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,                    // 5 min client-side cache
      },
    },

    // Social providers — only register Google if credentials are present
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          socialProviders: {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              redirectURI: process.env.GOOGLE_CALLBACK_URL ||
                `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/api/auth/better/callback/google`,
            },
          },
        }
      : {}),
  });

  return _authInstance;
}

module.exports = { getAuth, db: mongoClient };

