const ActivityLog = require('../models/ActivityLog');

async function logActivity({ contentId, byUser, fromStatus, toStatus, note }) {
  if (fromStatus === toStatus && !note) return;
  try {
    await ActivityLog.create({
      contentId,
      byUser,
      fromStatus: fromStatus || '',
      toStatus: toStatus || '',
      note: note || '',
    });
  } catch (err) {
    console.error('[ActivityLog]', err.message);
  }
}

module.exports = { logActivity };
