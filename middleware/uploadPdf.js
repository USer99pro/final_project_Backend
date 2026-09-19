'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');

const isServerless =
  process.env.VERCEL ||
  process.env.LAMBDA_TASK_ROOT ||
  __dirname.includes('/var/task') ||
  __dirname.includes('\\var\\task');

const uploadDir = isServerless
  ? path.join('/tmp', 'uploads', 'pdfs')
  : path.join(__dirname, '..', 'uploads', 'pdfs');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `${unique}${ext}`);
  },
});

/**
 * First-pass filter: checks extension and client-supplied MIME.
 * This runs before the file is written to disk.
 */
function pdfOnly(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  const mimeOk = mime === 'application/pdf' || mime === 'application/x-pdf';
  if (ext === '.pdf' && mimeOk) return cb(null, true);
  cb(new Error('กรุณาอัปโหลดไฟล์ PDF เท่านั้น'));
}

const uploadPdf = multer({
  storage,
  fileFilter: pdfOnly,
  limits: { fileSize: 15 * 1024 * 1024 },
});

/**
 * F6: Magic-byte verification middleware.
 * Runs after Multer writes the file to disk and checks that the first 4 bytes
 * are the PDF signature: %PDF (0x25 0x50 0x44 0x46).
 * If the signature is missing the file is deleted and the request is rejected.
 * This prevents attackers from bypassing the MIME check by setting the
 * Content-Type header manually.
 *
 * Attach after uploadPdf.single('pdf') / uploadPdf.array():
 *   router.post('/', uploadPdf.single('pdf'), verifyPdfMagic, handler)
 */
function verifyPdfMagic(req, res, next) {
  if (!req.file) return next(); // No file uploaded — let route handle it

  const filePath = req.file.path;
  let fd;
  try {
    // Read first 4 bytes only
    const buf = Buffer.alloc(4);
    fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    fd = undefined;

    // %PDF magic: 25 50 44 46
    if (buf[0] !== 0x25 || buf[1] !== 0x50 || buf[2] !== 0x44 || buf[3] !== 0x46) {
      // Delete the non-PDF file immediately
      try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
      return res.status(400).json({ error: 'ไฟล์ที่อัปโหลดไม่ใช่ PDF จริง (magic bytes ไม่ตรง)' });
    }
  } catch (err) {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (_) { /* ignore */ } }
    try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
    return res.status(500).json({ error: 'ไม่สามารถตรวจสอบไฟล์ได้' });
  }

  next();
}

module.exports = { uploadPdf, uploadDir, verifyPdfMagic };
