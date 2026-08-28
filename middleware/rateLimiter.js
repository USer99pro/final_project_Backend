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
 * 100 requests per 15 minutes per IP.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => req.path === '/health',
});

/**
 * Auth limiter — stricter, applied to /api/auth routes.
 * 20 requests per 15 minutes per IP.
 * Protects login/register/forgot-password from brute-force.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

module.exports = { globalLimiter, authLimiter };