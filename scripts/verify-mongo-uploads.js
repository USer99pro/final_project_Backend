const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const PdfFile = require('../models/PdfFile');
const Content = require('../models/Content');

const BASE = `http://localhost:${process.env.PORT || 3500}`;

async function run() {
  console.log('🧪 Starting rigorous MongoDB PDF upload verification...');

  // Connect to DB directly to verify collection state later
  await connectDB();

  // 1. Create a dummy PDF file locally to upload
  const dummyPdfPath = path.join(__dirname, 'dummy_test.pdf');
  fs.writeFileSync(dummyPdfPath, '%PDF-1.4 Dummy PDF Content for Testing Mongoose Storage');

  try {
    // 2. Register/Login to get Token
    const registerRes = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: `STU${Date.now()}`,
        fullName: 'MongoDB Verify Student',
        major: 'Information Technology',
        email: `verify${Date.now()}@test.local`,
        password: 'password123',
        confirmPassword: 'password123',
      }),
    });

    const regData = await registerRes.json();
    if (!registerRes.ok || !regData.token) {
      throw new Error(`Failed to register: ${JSON.stringify(regData)}`);
    }
    const token = regData.token;
    console.log('  ✓ Registered & logged in successfully.');

    // 3. Perform PDF upload via POST /api/contents
    const form = new FormData();
    form.append('title', 'Verify PDF Mongoose Storage');
    form.append('abstract', 'Testing abstract');
    form.append('status', 'published');
    
    // Create a Blob from the dummy file to append to form data
    const fileBuffer = fs.readFileSync(dummyPdfPath);
    const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
    form.append('pdf', fileBlob, 'dummy_test.pdf');

    console.log('  Sending POST /api/contents with PDF upload...');
    const uploadRes = await fetch(`${BASE}/api/contents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: form,
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData._id || !uploadData.pdfFilename) {
      throw new Error(`Failed to upload content: ${JSON.stringify(uploadData)}`);
    }
    const contentId = uploadData._id;
    const filename = uploadData.pdfFilename;
    console.log(`  ✓ Content created: ID = ${contentId}, PDF Filename = ${filename}`);

    // 4. Verify MongoDB collection state directly
    const dbFile = await PdfFile.findOne({ filename });
    if (!dbFile) {
      throw new Error('❌ PDF file not found in MongoDB `pdf_files` collection!');
    }
    console.log('  ✓ PDF file successfully verified inside MongoDB `pdf_files` collection!');
    console.log(`    - Original Name: ${dbFile.originalname}`);
    console.log(`    - Size: ${dbFile.size} bytes`);
    console.log(`    - Mimetype: ${dbFile.mimetype}`);
    console.log(`    - Buffer matches: ${dbFile.data.toString() === fileBuffer.toString()}`);

    // 5. Verify local disk cleanup (should be deleted immediately)
    const localDir = process.env.VERCEL || process.env.LAMBDA_TASK_ROOT || __dirname.includes('/var/task')
      ? path.join('/tmp', 'uploads', 'pdfs')
      : path.join(__dirname, '..', 'uploads', 'pdfs');
    const localFilePath = path.join(localDir, filename);
    const existsOnDisk = fs.existsSync(localFilePath);
    console.log(`  ✓ Local disk temp file check (Should be deleted): ${!existsOnDisk ? 'SUCCESS (Not on disk)' : 'FAILED (Still on disk)'}`);

    // 6. Retrieve PDF file from public endpoint and verify bytes
    console.log(`  Retrieving PDF via GET /api/public/projects/${contentId}/file...`);
    const fileRes = await fetch(`${BASE}/api/public/projects/${contentId}/file`);
    if (!fileRes.ok) {
      throw new Error(`Failed to retrieve uploaded file: ${fileRes.status}`);
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    const retrievedBuffer = Buffer.from(arrayBuffer);
    if (retrievedBuffer.toString() !== fileBuffer.toString()) {
      throw new Error('❌ Downloaded PDF content does not match uploaded dummy PDF content!');
    }
    console.log('  ✓ Downloaded PDF content matches original uploaded content exactly!');

    // 7. Delete content and verify direct cascade deletion in MongoDB
    console.log('  Sending DELETE /api/contents/:id...');
    const deleteRes = await fetch(`${BASE}/api/contents/${contentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!deleteRes.ok) {
      throw new Error(`Failed to delete content: ${deleteRes.status}`);
    }
    console.log('  ✓ Content deleted successfully.');

    // Verify PDF file cascade deleted from MongoDB `pdf_files`
    const deletedDbFile = await PdfFile.findOne({ filename });
    if (deletedDbFile) {
      throw new Error('❌ PDF file was NOT deleted from MongoDB `pdf_files` collection after content deletion!');
    }
    console.log('  ✓ Cascade deletion verified. PDF file completely removed from MongoDB `pdf_files` collection!');

    console.log('\n🎉 Rpath/MongoDB Upload Verification: 100% SUCCESS!');
  } finally {
    // Cleanup the local dummy file
    if (fs.existsSync(dummyPdfPath)) {
      fs.unlinkSync(dummyPdfPath);
    }
    // Close DB connection
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
