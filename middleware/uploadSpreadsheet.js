'use strict';

const path = require('path');
const multer = require('multer');

// Store uploaded spreadsheets in memory for fast parsing and zero disk pollution
const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls']);
const ALLOWED_MIMETYPES = new Set([
  'text/csv',
  'text/plain',
  'text/x-csv',
  'application/csv',
  'application/x-csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  'application/wps-office.xlsx',
  'application/x-excel',
]);

function spreadsheetFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  const isExtValid = ALLOWED_EXTENSIONS.has(ext);
  const isMimeValid = ALLOWED_MIMETYPES.has(mime) || ext === '.csv'; // some browsers send text/plain for CSV

  if (isExtValid && isMimeValid) {
    return cb(null, true);
  }

  cb(new Error('กรุณาอัปโหลดไฟล์ .csv, .xlsx หรือ .xls เท่านั้น'));
}

const uploadSpreadsheet = multer({
  storage,
  fileFilter: spreadsheetFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum
    files: 1,
  },
});

module.exports = { uploadSpreadsheet };
