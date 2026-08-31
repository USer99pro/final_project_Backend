'use strict';

/**
 * analyticsTrack.js
 * Public POST /api/analytics — track user events (PAGE_VIEW, LOGIN, REGISTER)
 * No authentication required, but validated and rate-limited.
 * VIEW_WORK, DOWNLOAD_WORK, SEARCH are tracked separately via existing Log models.
 */

const express = require('express');
const mongoose = require('mongoose');
const Analytics = require('../models/Analytics');

const router = express.Router();

const ALLOWED_EVENTS = ['PAGE_VIEW', 'LOGIN', 'REGISTER'];
const MAX_STR = 500;
const MAX_SHORT = 100;

function sanitizeStr(value, maxLen = MAX_STR) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().slice(0, maxLen);
  return s.length ? s : null;
}

function detectDevice(ua = '') {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'Tablet';
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) return 'Mobile';
  if (ua.length > 0) return 'Desktop';
  return 'Unknown';
}

/**
 * POST /api/analytics
 * Body: { visitorId, sessionId, event, page, device, browser, os, referrer }
 */
router.post('/', async (req, res) => {
  try {
    const {
      visitorId,
      sessionId,
      event,
      page,
      device,
      browser,
      os,
      referrer,
    } = req.body;

    // --- Validate event ---
    if (!event || !ALLOWED_EVENTS.includes(event)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    // --- Sanitize and build document ---
    const doc = {
      visitorId: sanitizeStr(visitorId, MAX_SHORT),
      sessionId: sanitizeStr(sessionId, MAX_SHORT),
      event,
      page: sanitizeStr(page),
      referrer: sanitizeStr(referrer),
      browser: sanitizeStr(browser, MAX_SHORT),
      os: sanitizeStr(os, MAX_SHORT),
    };

    // Device: use provided if valid enum, else detect from UA
    const validDevices = ['Desktop', 'Mobile', 'Tablet', 'Unknown'];
    if (device && validDevices.includes(device)) {
      doc.device = device;
    } else {
      const ua = req.headers['user-agent'] || '';
      doc.device = detectDevice(ua);
    }

    await Analytics.create(doc);

    // Respond immediately — do not block client
    res.status(204).end();
  } catch (err) {
    // Silently fail for analytics — never break the user experience
    console.error('[Analytics Track]', err.message);
    res.status(500).json({ error: 'Analytics tracking failed' });
  }
});

module.exports = router;
