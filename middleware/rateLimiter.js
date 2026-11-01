'use strict';

/**
 * rateLimiter.js
 * Rate limiting middleware using express-rate-limit.
 *
 * - globalLimiter       : 1000 req / 15 min per IP  (applied app-wide)
 * - authLimiter         : 30   req / 15 min per IP  (login, register, forgot-password)
 * - analyticsLimiter    : 300  req / 15 min per IP  (analytics tracking)
 * - fileDownloadLimiter : 120  req / 15 min per IP  (file download/streaming)
 * - fileUploadLimiter   : 60   req / 15 min per IP  (file upload, update, deletion)
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

/**
 * Analytics tracking limiter — public POST /api/analytics
 * Default: 300 requests per 15 minutes per IP.
 * Generous enough for real users but limits abuse.
 */
const analyticsLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_ANALYTICS_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * File download limiter — protects file retrieval endpoints against DoS.
 * Default: 120 requests per 15 minutes per IP.
 */
const fileDownloadLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_DOWNLOAD_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_DOWNLOAD_MAX) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * File upload/modification limiter — protects upload, edit, delete operations.
 * Default: 60 requests per 15 minutes per IP.
 */
const fileUploadLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_UPLOAD_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

module.exports = {
  globalLimiter,
  authLimiter,
  analyticsLimiter,
  fileDownloadLimiter,
  fileUploadLimiter,
};
