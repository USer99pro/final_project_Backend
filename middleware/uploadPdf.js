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

function pdfOnly(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  const mimeOk = mime === 'application/pdf' || mime === 'application/x-pdf';
  if (ext === '.pdf' && mimeOk) return cb(null, true);
  cb(new Error('Only PDF files are allowed (application/pdf, .pdf)'));
}

const uploadPdf = multer({
  storage,
  fileFilter: pdfOnly,
  limits: { fileSize: 15 * 1024 * 1024 },
});

module.exports = { uploadPdf, uploadDir };
