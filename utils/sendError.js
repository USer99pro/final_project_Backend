'use strict';

/**
 * sendError.js
 * Centralised error-response helper.
 *
 * In production  → logs the real error server-side; returns a generic message
 *                  to the client so internal details (DB schema, file paths,
 *                  Mongoose CastError text, etc.) are never exposed.
 * In development → returns err.message directly so debugging stays easy.
 *
 * Usage:
 *   const { sendError } = require('../utils/sendError');
 *   ...
 *   } catch (err) {
 *     return sendError(res, err);
 *   }
 */

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * @param {import('express').Response} res
 * @param {Error} err
 * @param {number} [status=500]
 */
function sendError(res, err, status = 500) {
  // Always log the real error server-side (never silently swallow)
  console.error('[Error]', err);

  const message = IS_PROD
    ? 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์'
    : err.message || 'Server error';

  return res.status(status).json({ error: message });
}

module.exports = { sendError };
