'use strict';

const path = require('path');
const fs = require('fs');

/**
 * getSafeUploadPath:
 * Validates that the input filename or path is safe and strictly contained
 * within the specified base directory. Strips directory traversal components.
 *
 * @param {string} baseDir - Target directory (e.g. uploadDir)
 * @param {string} filenameOrPath - Input filename or path to check
 * @returns {{ safeName: string, safePath: string, baseDir: string } | null}
 */
function getSafeUploadPath(baseDir, filenameOrPath) {
  if (!filenameOrPath || typeof filenameOrPath !== 'string') return null;
  const safeName = path.basename(filenameOrPath);
  if (!safeName || safeName === '.' || safeName === '..') return null;

  const resolvedBase = path.resolve(baseDir);
  const safePath = path.resolve(resolvedBase, safeName);

  if (!safePath.startsWith(resolvedBase + path.sep)) {
    return null;
  }

  return { safeName, safePath, baseDir: resolvedBase };
}

/**
 * safeDeleteFile:
 * Safely unlinks a file only if it is strictly contained inside baseDir.
 *
 * @param {string} baseDir
 * @param {string} filenameOrPath
 * @returns {boolean} True if unlinked or not existing, false if blocked
 */
function safeDeleteFile(baseDir, filenameOrPath) {
  const safe = getSafeUploadPath(baseDir, filenameOrPath);
  if (!safe) return false;

  if (fs.existsSync(safe.safePath)) {
    try {
      fs.unlinkSync(safe.safePath);
      return true;
    } catch (_) {
      return false;
    }
  }
  return true;
}

module.exports = {
  getSafeUploadPath,
  safeDeleteFile,
};

