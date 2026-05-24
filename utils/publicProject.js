const { enrichContent, getBaseUrl } = require('./paths');

function toPublicProject(doc, req) {
  const o = enrichContent(doc, req);
  const author =
    o.author && typeof o.author === 'object'
      ? { _id: o.author._id, fullName: o.author.fullName }
      : null;

  return {
    _id: o._id,
    title: o.title,
    description: o.description,
    abstract: o.abstract || '',
    studentName: o.studentName || author?.fullName || '',
    major: o.major || '',
    academicYear: o.academicYear || '',
    category: o.category,
    tags: o.tags,
    author,
    status: o.status,
    hasPdf: o.hasPdf,
    pdfFilename: o.pdfFilename || '',
    pdfOriginalName: o.pdfOriginalName || '',
    pdfPath: o.pdfPath,
    pdfUrl: o.pdfUrl,
    fileUrl: o._id ? `${getBaseUrl(req)}/api/public/projects/${o._id}/file` : null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

module.exports = { toPublicProject };
