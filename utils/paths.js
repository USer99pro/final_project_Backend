/** path สาธารณะสำหรับไฟล์ paper (PDF) */
const PAPERS_URL_PATH = process.env.PAPERS_URL_PATH || '/uploads/papers';

function getBaseUrl(req) {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL.replace(/\/$/, '');
  if (req) {
    const proto = req.protocol || 'http';
    const host = req.get('host');
    if (host) return `${proto}://${host}`;
  }
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}

function getPaperPdfPath(filename) {
  if (!filename) return null;
  return `${PAPERS_URL_PATH}/${filename}`;
}

function getPaperPdfUrl(filename, req) {
  const rel = getPaperPdfPath(filename);
  if (!rel) return null;
  return `${getBaseUrl(req)}${rel}`;
}

function enrichContent(doc, req) {
  const o = doc?.toObject ? doc.toObject() : { ...doc };
  const hasPdf = Boolean(o.pdfFilename);
  o.hasPdf = hasPdf;
  o.pdfPath = hasPdf ? getPaperPdfPath(o.pdfFilename) : null;
  o.pdfUrl = hasPdf ? getPaperPdfUrl(o.pdfFilename, req) : null;
  return o;
}

module.exports = {
  PAPERS_URL_PATH,
  getBaseUrl,
  getPaperPdfPath,
  getPaperPdfUrl,
  enrichContent,
};
