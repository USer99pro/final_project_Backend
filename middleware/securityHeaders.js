'use strict';

/**
 * securityHeaders.js
 * Helmet.js configuration - all 6 HTTP Security Headers
 * per SEO_SEC_Optimization_Plan Section 2.
 * HSTS disabled in dev (no TLS on localhost).
 */

const helmet = require('helmet');

const IS_PROD = process.env.NODE_ENV === 'production';

function securityHeaders() {
  return helmet({
    // 1. HSTS
    hsts: IS_PROD
      ? { maxAge: 63072000, includeSubDomains: true, preload: true }
      : false,

    // 2. X-Frame-Options: SAMEORIGIN
    frameguard: { action: 'sameorigin' },

    // 3. X-Content-Type-Options: nosniff
    noSniff: true,

    // 4. Referrer-Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

    // 5. Permitted cross-domain policies
    permittedCrossDomainPolicies: false,

    // 6. Content-Security-Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      ["'self'", "'unsafe-inline'"],
        styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc:        ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc:         ["'self'", 'data:', 'https:'],
        connectSrc:     ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc:      ["'none'"],
        baseUri:        ["'self'"],
        formAction:     ["'self'"],
      },
    },

    // Relax COEP so frontend can load cross-origin assets
    crossOriginEmbedderPolicy: false,
    // Allow OAuth popup flows
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    // Allow frontend origin to fetch API resources
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}

/**
 * Permissions-Policy middleware (Helmet does NOT set this automatically).
 * Disables geolocation, microphone, camera, and payment browser APIs.
 */
function permissionsPolicy(req, res, next) {
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );
  next();
}

module.exports = { securityHeaders, permissionsPolicy };