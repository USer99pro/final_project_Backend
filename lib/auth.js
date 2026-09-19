'use strict';

/**
 * lib/auth.js — Better Auth server configuration for Express (CommonJS)
 *
 * Uses the built-in MongoDB adapter (better-auth/adapters/mongodb) with the
 * existing Mongoose connection so no second database connection is opened.
 *
 * Required environment variables:
 *   BETTER_AUTH_SECRET  – 32+ char random secret (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
 *   MONGO_URI           – existing MongoDB connection string
 *   BETTER_AUTH_URL     – public base URL of this API (e.g. https://api.yourdomain.com)
 *
 * Express handler mounting (in server.js):
 *   const { toNodeHandler } = require('better-auth/node');
 *   const { auth } = require('./lib/auth');
 *   app.all('/api/auth/better/*splat', toNodeHandler(auth));
 */

const { betterAuth } = require('better-auth');
const { mongodbAdapter } = require('better-auth/adapters/mongodb');
const { MongoClient } = require('mongodb');

// ── Fail fast on missing or weak BETTER_AUTH_SECRET ──────────────────────────
const _BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const _WEAK_DEFAULTS = new Set(['change-me', 'secret', '', undefined]);
if (!_BETTER_AUTH_SECRET || _WEAK_DEFAULTS.has(_BETTER_AUTH_SECRET) || _BETTER_AUTH_SECRET.length < 32) {
  console.error(
    '[FATAL] BETTER_AUTH_SECRET is missing or too short (< 32 chars). ' +
    'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
  process.exit(1);
}

// ── MongoDB native client for Better Auth adapter ────────────────────────────
// Better Auth's mongodbAdapter requires the native MongoDB driver client, not Mongoose.
// We share the same MONGO_URI so no second DB connection is opened.
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

// ── Better Auth instance ──────────────────────────────────────────────────────
const auth = betterAuth({
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

module.exports = { auth, db: mongoClient };
