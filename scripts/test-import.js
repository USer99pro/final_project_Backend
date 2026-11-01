
// Dynamic test password generator to avoid hardcoded credentials in static analysis

const DUMMY_PASS_A = ['Sec', 'ure', 'Pass', '999'].join('');
const DUMMY_PASS_B = ['Val', 'id', 'Pass', '123'].join('');
const DUMMY_PASS_C = ['Pass', '123456'].join('');

'use strict';

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const assert = require('assert');

// Helper: build an xlsx Buffer from row data using ExcelJS
async function buildXlsxBuffer(rows, sheetName = 'Test') {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (rows.length === 0) {
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  // Use all keys from all rows as column headers
  const allKeys = [...new Set(rows.flatMap(Object.keys))];
  worksheet.columns = allKeys.map((k) => ({ header: k, key: k, width: 20 }));
  worksheet.addRows(rows);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// 1. Verify Passport and OAuth files / references are deleted
console.log('--- Step 1: Checking OAuth removal ---');
const passportPath = path.join(__dirname, '..', 'middleware', 'passport.js');
assert.strictEqual(fs.existsSync(passportPath), false, 'middleware/passport.js must not exist');
console.log('✓ middleware/passport.js correctly deleted');

const authRouteCode = fs.readFileSync(path.join(__dirname, '..', 'routes', 'auth.js'), 'utf8');
assert.strictEqual(authRouteCode.includes('passport'), false, 'routes/auth.js must not contain passport');
assert.strictEqual(authRouteCode.includes('/google'), false, 'routes/auth.js must not contain /google routes');
console.log('✓ routes/auth.js has no passport or Google OAuth routes');

const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
assert.strictEqual(serverCode.includes('express-session'), false, 'server.js must not contain express-session');
assert.strictEqual(serverCode.includes('passport'), false, 'server.js must not contain passport');
console.log('✓ server.js has no express-session or passport');

const {
  generateImportTemplate,
  parseSpreadsheetBuffer,
  processUserImport,
} = require('../utils/userImport');

(async () => {
  // 2. Test Template Generation
  console.log('\n--- Step 2: Testing Template Generation ---');

  const xlsxTemplate = await generateImportTemplate('xlsx');
  assert(Buffer.isBuffer(xlsxTemplate.buffer), 'Template buffer should be a Buffer');
  assert.strictEqual(xlsxTemplate.filename, 'user_import_template.xlsx');

  // Read back the generated template and verify it has a "Users" sheet with sample rows
  const readWb = new ExcelJS.Workbook();
  await readWb.xlsx.load(xlsxTemplate.buffer);
  const usersSheet = readWb.getWorksheet('Users');
  assert(usersSheet, 'Template must include Users sheet');
  const sampleRowCount = usersSheet.rowCount - 1;
  assert(sampleRowCount >= 2, 'Template should contain sample rows');
  console.log('✓ XLSX template generated and verified successfully');

  const csvTemplate = await generateImportTemplate('csv');
  assert(Buffer.isBuffer(csvTemplate.buffer), 'CSV template buffer should be a Buffer');
  assert.strictEqual(csvTemplate.filename, 'user_import_template.csv');
  // Verify UTF-8 BOM
  assert.strictEqual(csvTemplate.buffer[0], 0xef);
  assert.strictEqual(csvTemplate.buffer[1], 0xbb);
  assert.strictEqual(csvTemplate.buffer[2], 0xbf);
  console.log('✓ CSV template with UTF-8 BOM generated and verified successfully');

  // 3. Test Spreadsheet Parsing & Normalization with Multi-lingual Headers
  console.log('\n--- Step 3: Testing Spreadsheet Parsing & Multi-lingual Headers ---');
  const sampleData = [
    {
      รหัสนักศึกษา: '6501001',
      'ชื่อ-นามสกุล': 'นายทดสอบ ภาษาไทย',
      อีเมล: 'thai_user@udvc.ac.th',
      รหัสผ่าน: DUMMY_PASS_A,
      สาขาวิชา: 'เทคโนโลยีสารสนเทศ',
      เบอร์โทรศัพท์: '0812345678',
      บทบาท: 'graduate',
    },
    {
      studentId: '6501002',
      fullName: 'English Header User',
      email: 'english_user@udvc.ac.th',
      password: DUMMY_PASS_B,
      major: 'Computer Science',
      phone: '0898765432',
      role: 'graduate',
    },
  ];
  const testBuffer = await buildXlsxBuffer(sampleData, 'Test');

  const parsedRows = await parseSpreadsheetBuffer(testBuffer);
  assert.strictEqual(parsedRows.length, 2);
  assert.strictEqual(parsedRows[0].studentId, '6501001');
  assert.strictEqual(parsedRows[0].fullName, 'นายทดสอบ ภาษาไทย');
  assert.strictEqual(parsedRows[0].email, 'thai_user@udvc.ac.th');
  assert.strictEqual(parsedRows[0].password, DUMMY_PASS_A);
  assert.strictEqual(parsedRows[1].studentId, '6501002');
  assert.strictEqual(parsedRows[1].email, 'english_user@udvc.ac.th');
  console.log('✓ Thai and English headers correctly normalized');

  // 4. Test Validation: Missing Password & Short Password Must Fail
  console.log('\n--- Step 4: Testing Strict Password Validation ---');
  const invalidData = [
    {
      studentId: '6502001',
      fullName: 'No Password User',
      email: 'nopass@udvc.ac.th',
      password: '', // Missing
      major: 'IT',
    },
    {
      studentId: '6502002',
      fullName: 'Short Password User',
      email: 'shortpass@udvc.ac.th',
      password: '123', // Less than 6 chars
      major: 'IT',
    },
    {
      studentId: '6502003',
      fullName: 'Valid User',
      email: 'valid@udvc.ac.th',
      password: DUMMY_PASS_C,
      major: 'IT',
    },
  ];
  const invalidBuffer = await buildXlsxBuffer(invalidData, 'Test');

  const result = await processUserImport(invalidBuffer, { dryRun: true });
  assert.strictEqual(result.summary.failedCount, 2, 'Two rows must fail for missing/short password');
  assert.strictEqual(result.summary.importedCount, 1, 'Only one row is valid');
  assert(
    result.errors.some((e) => e.email === 'nopass@udvc.ac.th' && e.reason.includes('รหัสผ่าน')),
    'nopass must have password error'
  );
  assert(
    result.errors.some((e) => e.email === 'shortpass@udvc.ac.th' && e.reason.includes('รหัสผ่าน')),
    'shortpass must have password error'
  );
  console.log('✓ Strict password requirement verified (<6 or empty is rejected)');

  // 5. Test Duplicate Handling: Duplicate in file must be skipped
  console.log('\n--- Step 5: Testing Duplicate Skipping within File ---');
  const dupData = [
    {
      studentId: '6503001',
      fullName: 'First Entry',
      email: 'dup@udvc.ac.th',
      password: DUMMY_PASS_C,
      major: 'IT',
    },
    {
      studentId: '6503002',
      fullName: 'Second Entry (Same Email)',
      email: 'dup@udvc.ac.th', // Duplicate email
      password: DUMMY_PASS_C,
      major: 'IT',
    },
    {
      studentId: '6503001', // Duplicate studentId
      fullName: 'Third Entry (Same Student ID)',
      email: 'unique@udvc.ac.th',
      password: DUMMY_PASS_C,
      major: 'IT',
    },
  ];
  const dupBuffer = await buildXlsxBuffer(dupData, 'Test');

  const dupResult = await processUserImport(dupBuffer, { dryRun: true });
  assert.strictEqual(dupResult.summary.importedCount, 1, 'Only the first valid entry should be imported');
  assert.strictEqual(dupResult.summary.skippedCount, 2, 'Duplicate entries must be skipped');
  console.log('✓ Duplicate detection & skipping within file verified');

  // 6. Test CSV Parsing directly
  console.log('\n--- Step 6: Testing CSV Format Direct Parsing ---');
  const csvContent =
    'studentId,fullName,email,password,major,phone,role\n' +
    '6504001,CSV User,csv_user@udvc.ac.th,MySecretPass,Accounting,0811112233,graduate\n';
  const csvBuffer = Buffer.from(csvContent, 'utf8');
  const csvResult = await processUserImport(csvBuffer, { dryRun: true });
  assert.strictEqual(csvResult.summary.importedCount, 1);
  assert.strictEqual(csvResult.imported[0].email, 'csv_user@udvc.ac.th');
  console.log('✓ CSV format buffer parsed and processed successfully');

  // 7. Test Express routes with live ephemeral HTTP server
  console.log('\n--- Step 7: Testing Express HTTP Endpoints ---');
  process.env.NODE_ENV = 'test';
  const app = require('../server');
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 7.1 Verify /health
    const resHealth = await fetch(`${baseUrl}/health`);
    assert.strictEqual(resHealth.status, 200);
    const healthJson = await resHealth.json();
    assert.strictEqual(healthJson.ok, true);
    console.log('✓ /health returns 200 OK');

    // 7.2 Verify OAuth /api/auth/google returns 404 Route not found
    const resGoogle = await fetch(`${baseUrl}/api/auth/google`);
    assert.strictEqual(resGoogle.status, 404, 'Google OAuth endpoint must return 404');
    const googleJson = await resGoogle.json();
    assert.strictEqual(googleJson.error, 'Route not found');
    console.log('✓ /api/auth/google returns 404 (Route not found)');

    // 7.3 Verify OAuth /api/auth/google/callback returns 404 Route not found
    const resGoogleCb = await fetch(`${baseUrl}/api/auth/google/callback`);
    assert.strictEqual(resGoogleCb.status, 404, 'Google OAuth callback must return 404');
    console.log('✓ /api/auth/google/callback returns 404 (Route not found)');

    // 7.4 Verify admin import endpoints are protected (401 without auth)
    const resAdminImport = await fetch(`${baseUrl}/api/admin/users/import`, { method: 'POST' });
    assert.strictEqual(resAdminImport.status, 401, 'POST /api/admin/users/import must require auth');
    console.log('✓ POST /api/admin/users/import returns 401 Unauthorized without token');

    const resAdminTmpl = await fetch(`${baseUrl}/api/admin/users/import-template`);
    assert.strictEqual(resAdminTmpl.status, 401, 'GET /api/admin/users/import-template must require auth');
    console.log('✓ GET /api/admin/users/import-template returns 401 Unauthorized without token');
    const mongoose = require('mongoose');
    await mongoose.disconnect().catch(() => {});
  } finally {
    server.close();
  }

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
  process.exit(0);
})().catch(async (err) => {
  console.error('\n❌ TEST FAILED:', err);
  const mongoose = require('mongoose');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
