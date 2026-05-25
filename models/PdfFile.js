const mongoose = require('mongoose');

const pdfFileSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, unique: true },
    originalname: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true, collection: 'pdf_files' }
);

module.exports = mongoose.model('PdfFile', pdfFileSchema);
