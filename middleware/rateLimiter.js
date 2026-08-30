'use strict';

/**
 * rateLimiter.js
 * Rate limiting middleware using express-rate-limit.
 *
 * - globalLimiter  : 100 req / 15 min per IP  (applied app-wide)
 * - authLimiter    : 20  req / 15 min per IP  (login, register, forgot-password)
 */

const rateLimit = require('express-rate-limit');

/** Generic JSON error handler for rate limit responses */
function rateLimitHandler(req, res) {
  res.status(429).json({
    error: 'Too many requests — please try again later.',
    retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
  });
}

/**
 * Global limiter — applied to all routes.
 * Default: 1,000 requests per 15 minutes per IP (customizable via RATE_LIMIT_GLOBAL_MAX).
 */
const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => req.path === '/health' || req.method === 'OPTIONS',
});

/**
 * Auth limiter — stricter, applied to /api/auth routes.
 * Default: 30 requests per 15 minutes per IP (customizable via RATE_LIMIT_AUTH_MAX).
 * Protects login/register/forgot-password from brute-force.
 */
const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

module.exports = { globalLimiter, authLimiter };