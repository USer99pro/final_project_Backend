'use strict';

/**
 * analyticsTrack.js
 * Public POST /api/analytics — track user events
 * Events: PAGE_VIEW, SEARCH, VIEW_WORK, DOWNLOAD_WORK, LOGIN, REGISTER
 */

const express = require('express');
const mongoose = require('mongoose');
const Analytics = require('../models/Analytics');
const ViewLog = require('../models/ViewLog');
const SearchLog = require('../models/SearchLog');
const DownloadLog = require('../models/DownloadLog');

const router = express.Router();

const ALLOWED_EVENTS = ['PAGE_VIEW', 'SEARCH', 'VIEW_WORK', 'DOWNLOAD_WORK', 'LOGIN', 'REGISTER'];
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

router.post('/', async (req, res) => {
  try {
    const {
      visitorId,
      sessionId,
      userId,
      event,
      page,
      workId,
      searchKeyword,
      device,
      browser,
      os,
      referrer,
    } = req.body;

    if (!event || !ALLOWED_EVENTS.includes(event)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    const validWorkId = workId && mongoose.Types.ObjectId.isValid(workId) ? workId : null;
    const validUserId = userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null;

    const doc = {
      visitorId: sanitizeStr(visitorId, MAX_SHORT),
      sessionId: sanitizeStr(sessionId, MAX_SHORT),
      userId: validUserId,
      event,
      page: sanitizeStr(page),
      workId: validWorkId,
      searchKeyword: sanitizeStr(searchKeyword, 200),
      referrer: sanitizeStr(referrer),
      browser: sanitizeStr(browser, MAX_SHORT),
      os: sanitizeStr(os, MAX_SHORT),
    };

    const validDevices = ['Desktop', 'Mobile', 'Tablet', 'Unknown'];
    if (device && validDevices.includes(device)) {
      doc.device = device;
    } else {
      const ua = req.headers['user-agent'] || '';
      doc.device = detectDevice(ua);
    }

    // Save to generic analytics event collection
    await Analytics.create(doc);

    // Also sync to specialized log models if applicable
    if (event === 'VIEW_WORK' && validWorkId) {
      ViewLog.create({ workId: validWorkId, userId: validUserId }).catch(() => {});
    } else if (event === 'DOWNLOAD_WORK' && validWorkId) {
      DownloadLog.create({ workId: validWorkId, userId: validUserId }).catch(() => {});
    } else if (event === 'SEARCH' && doc.searchKeyword) {
      SearchLog.create({ keyword: doc.searchKeyword, userId: validUserId }).catch(() => {});
    }

    res.status(204).end();
  } catch (err) {
    console.error('[Analytics Track]', err.message);
    res.status(500).json({ error: 'Analytics tracking failed' });
  }
});

module.exports = router;
