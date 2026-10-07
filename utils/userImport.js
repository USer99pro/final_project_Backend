'use strict';

const XLSX = require('xlsx');
const mongoose = require('mongoose');
const User = require('../models/User');
const { logAudit } = require('./audit');
const { stripVersion } = require('./serialize');

// Mapping of accepted header variants (lowercase, trimmed, underscores/dashes stripped)
const HEADER_MAP = {
  // studentId (Required - username on frontend)
  studentid: 'studentId',
  student_id: 'studentId',
  'student id': 'studentId',
  username: 'studentId',
  user_name: 'studentId',
  รหัสนักศึกษา: 'studentId',
  รหัสประจำตัว: 'studentId',
  รหัส: 'studentId',

  // citizenId (13 digits - default password)
  citizenid: 'citizenId',
  citizen_id: 'citizenId',
  'citizen id': 'citizenId',
  nationalid: 'citizenId',
  national_id: 'citizenId',
  'national id': 'citizenId',
  idcard: 'citizenId',
  'id card': 'citizenId',
  id_card: 'citizenId',
  เลขบัตรประชาชน: 'citizenId',
  เลขประจำตัวประชาชน: 'citizenId',
  เลข13หลัก: 'citizenId',
  'เลข 13 หลัก': 'citizenId',
  บัตรประชาชน: 'citizenId',

  // fullName (Required)
  fullname: 'fullName',
  full_name: 'fullName',
  'full name': 'fullName',
  name: 'fullName',
  'ชื่อ-นามสกุล': 'fullName',
  'ชื่อ นามสกุล': 'fullName',
  'ชื่อ-สกุล': 'fullName',
  ชื่อสกุล: 'fullName',
  ชื่อ: 'fullName',

  // email (Optional - auto-generated from studentId if missing)
  email: 'email',
  'e-mail': 'email',
  mail: 'email',
  อีเมล: 'email',

  // password (Optional - defaults to 13-digit citizenId if empty)
  password: 'password',
  pass: 'password',
  pwd: 'password',
  รหัสผ่าน: 'password',

  // major (Required)
  major: 'major',
  department: 'major',
  สาขาวิชา: 'major',
  สาขา: 'major',
  แผนก: 'major',
  กลุ่มวิชา: 'major',

  // phone (Optional)
  phone: 'phone',
  tel: 'phone',
  telephone: 'phone',
  mobile: 'phone',
  เบอร์โทร: 'phone',
  เบอร์โทรศัพท์: 'phone',
  เบอร์ติดต่อ: 'phone',

  // role (Default 'graduate')
  role: 'role',
  บทบาท: 'role',
  สิทธิ์: 'role',
  ประเภทผู้ใช้: 'role',

  // isActive (Default true)
  isactive: 'isActive',
  active: 'isActive',
  status: 'isActive',
  สถานะ: 'isActive',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize header key to standard model attribute
 */
function normalizeHeaderKey(rawKey) {
  if (!rawKey) return null;
  const clean = String(rawKey).trim().toLowerCase();
  return HEADER_MAP[clean] || null;
}

/**
 * Parse boolean from diverse spreadsheet input
 */
function parseBoolean(val, defaultVal = true) {
  if (val === undefined || val === null || val === '') return defaultVal;
  const s = String(val).trim().toLowerCase();
  if (['true', '1', 'yes', 'active', 'ปกติ', 'ใช้งาน', 'เปิด'].includes(s)) return true;
  if (['false', '0', 'no', 'inactive', 'suspended', 'ระงับ', 'ปิด'].includes(s)) return false;
  return defaultVal;
}

/**
 * Parse buffer (CSV or Excel) into normalized raw objects
 */
function parseSpreadsheetBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('ไม่พบแผ่นงาน (Sheet) ในไฟล์ที่อัปโหลด');
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('ไฟล์ที่อัปโหลดไม่มีข้อมูลผู้ใช้ (แถวว่าง)');
  }

  return rawRows.map((rawRow, index) => {
    const rowNumber = index + 2; // Row 1 is header, data starts at row 2
    const normalized = { _rowNumber: rowNumber };

    for (const [key, val] of Object.entries(rawRow)) {
      const canonicalKey = normalizeHeaderKey(key);
      if (canonicalKey) {
        const cleanVal = typeof val === 'string' ? val.trim() : val;
        if (cleanVal !== '' && cleanVal !== undefined && cleanVal !== null) {
          normalized[canonicalKey] = cleanVal;
        } else if (normalized[canonicalKey] === undefined) {
          normalized[canonicalKey] = '';
        }
      }
    }

    return normalized;
  });
}

/**
 * Process and import users from CSV/Excel buffer
 *
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - Options: { dryRun, req, adminUser }
 * @returns {Promise<Object>} Summary and results
 */
async function processUserImport(buffer, options = {}) {
  const { dryRun = false, req = null, adminUser = null } = options;
  const rows = parseSpreadsheetBuffer(buffer);

  const errors = [];
  const skipped = [];
  const validCandidates = [];

  const seenEmailsInFile = new Set();
  const seenStudentIdsInFile = new Set();
  const defaultDomain = process.env.DEFAULT_EMAIL_DOMAIN || 'udvc.ac.th';

  // 1. Initial row validation & in-file duplicate check
  for (const row of rows) {
    const rowNum = row._rowNumber;
    const studentId = row.studentId ? String(row.studentId).trim() : '';
    const citizenId = row.citizenId ? String(row.citizenId).trim().replace(/\s+/g, '') : '';
    const fullName = row.fullName ? String(row.fullName).trim() : '';
    const rawEmail = row.email ? String(row.email).trim().toLowerCase() : '';
    const rawPassword = row.password !== undefined && row.password !== null ? String(row.password).trim() : '';
    const major = row.major ? String(row.major).trim() : '';
    const phone = row.phone ? String(row.phone).trim() : '';
    let role = row.role ? String(row.role).trim().toLowerCase() : 'graduate';
    const isActive = parseBoolean(row.isActive, true);

    // Normalize role (default: graduate)
    if (role === 'user') role = 'graduate';
    if (!['graduate', 'admin'].includes(role)) {
      role = 'graduate';
    }

    // Check if the entire row is empty
    if (!fullName && !studentId && !rawEmail && !citizenId) {
      continue; // Skip accidental empty rows
    }

    // 1.1 Required studentId (Username for frontend)
    if (!studentId) {
      errors.push({
        row: rowNum,
        studentId: null,
        email: rawEmail || null,
        reason: 'studentId (รหัสนักศึกษา) จำเป็นสำหรับเป็น Username ในการเข้าสู่ระบบ',
      });
      continue;
    }

    // 1.2 Required fullName
    if (!fullName) {
      errors.push({
        row: rowNum,
        studentId,
        email: rawEmail || null,
        reason: 'fullName (ชื่อ-นามสกุล) จำเป็น',
      });
      continue;
    }

    // 1.3 Required major
    if (!major) {
      errors.push({
        row: rowNum,
        studentId,
        email: rawEmail || null,
        reason: 'major (สาขาวิชา) จำเป็น',
      });
      continue;
    }

    // 1.4 Password determination:
    // If password provided -> use it (must be >= 6 chars)
    // Else default to 13-digit citizenId (must be >= 6 chars)
    let finalPassword = '';
    if (rawPassword) {
      if (rawPassword.length < 6) {
        errors.push({
          row: rowNum,
          studentId,
          email: rawEmail || null,
          reason: 'password (รหัสผ่าน) ต้องมีอย่างน้อย 6 ตัวอักษร',
        });
        continue;
      }
      finalPassword = rawPassword;
    } else if (citizenId) {
      if (citizenId.length < 6) {
        errors.push({
          row: rowNum,
          studentId,
          email: rawEmail || null,
          reason: 'citizenId (เลขบัตรประชาชนสำหรับเป็นรหัสผ่านเริ่มต้น) ต้องมีอย่างน้อย 6 ตัวอักษร',
        });
        continue;
      }
      finalPassword = citizenId;
    } else {
      errors.push({
        row: rowNum,
        studentId,
        email: rawEmail || null,
        reason: 'จำเป็นต้องระบุ password หรือ citizenId (เลขบัตรประชาชน 13 หลัก) สำหรับตั้งรหัสผ่านเริ่มต้น',
      });
      continue;
    }

    // 1.5 Email determination:
    // If provided, validate format. If missing, auto-generate studentId@<domain>
    let finalEmail = '';
    if (rawEmail) {
      if (!EMAIL_REGEX.test(rawEmail)) {
        errors.push({
          row: rowNum,
          studentId,
          email: rawEmail,
          reason: 'email (อีเมล) รูปแบบไม่ถูกต้อง',
        });
        continue;
      }
      finalEmail = rawEmail;
    } else {
      finalEmail = `${studentId.toLowerCase()}@${defaultDomain}`;
    }

    // 1.6 Duplicate studentId within file
    if (seenStudentIdsInFile.has(studentId)) {
      skipped.push({
        row: rowNum,
        studentId,
        email: finalEmail,
        reason: 'รหัสนักศึกษาซ้ำกับแถวก่อนหน้าในไฟล์เดียวกัน',
      });
      continue;
    }
    seenStudentIdsInFile.add(studentId);

    // 1.7 Duplicate email within file
    if (seenEmailsInFile.has(finalEmail)) {
      skipped.push({
        row: rowNum,
        studentId,
        email: finalEmail,
        reason: 'อีเมลซ้ำกับแถวก่อนหน้าในไฟล์เดียวกัน',
      });
      continue;
    }
    seenEmailsInFile.add(finalEmail);

    validCandidates.push({
      _rowNumber: rowNum,
      studentId,
      citizenId: citizenId || undefined,
      fullName,
      email: finalEmail,
      password: finalPassword,
      major,
      phone,
      role,
      isActive,
    });
  }

  // 2. Query MongoDB for existing emails or student IDs in batch
  const candidateEmails = validCandidates.map((c) => c.email);
  const candidateStudentIds = validCandidates
    .map((c) => c.studentId)
    .filter((id) => Boolean(id));

  const queryConditions = [];
  if (candidateEmails.length > 0) {
    queryConditions.push({ email: { $in: candidateEmails } });
  }
  if (candidateStudentIds.length > 0) {
    queryConditions.push({ studentId: { $in: candidateStudentIds } });
  }

  const isDbConnected = Boolean(mongoose.connection && mongoose.connection.readyState === 1);
  const existingInDb =
    queryConditions.length > 0 && isDbConnected
      ? await User.find({ $or: queryConditions }).select('email studentId')
      : [];

  const existingEmailSet = new Set(existingInDb.map((u) => u.email.toLowerCase()));
  const existingStudentIdSet = new Set(
    existingInDb.map((u) => u.studentId).filter(Boolean)
  );

  // 3. Filter out DB duplicates and create records
  const toCreate = [];
  for (const candidate of validCandidates) {
    if (candidate.studentId && existingStudentIdSet.has(candidate.studentId)) {
      skipped.push({
        row: candidate._rowNumber,
        studentId: candidate.studentId,
        email: candidate.email,
        reason: 'รหัสนักศึกษานี้มีอยู่ในระบบแล้ว',
      });
      continue;
    }

    if (existingEmailSet.has(candidate.email)) {
      skipped.push({
        row: candidate._rowNumber,
        studentId: candidate.studentId || null,
        email: candidate.email,
        reason: 'อีเมลนี้มีอยู่ในระบบแล้ว',
      });
      continue;
    }

    toCreate.push(candidate);
  }

  const imported = [];

  // 4. Save to DB if not dry-run
  if (!dryRun) {
    for (const item of toCreate) {
      try {
        const user = await User.create({
          studentId: item.studentId,
          citizenId: item.citizenId,
          fullName: item.fullName,
          email: item.email,
          password: item.password,
          major: item.major,
          phone: item.phone,
          role: item.role,
          isActive: item.isActive,
          authProvider: 'local',
        });

        imported.push({
          _id: user._id,
          studentId: user.studentId || null,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          major: user.major,
        });
      } catch (err) {
        if (err.code === 11000) {
          skipped.push({
            row: item._rowNumber,
            studentId: item.studentId || null,
            email: item.email,
            reason: 'ตรวจพบข้อมูลซ้ำขณะบันทึก',
          });
        } else {
          errors.push({
            row: item._rowNumber,
            studentId: item.studentId || null,
            email: item.email,
            reason: err.message || 'บันทึกไม่สำเร็จ',
          });
        }
      }
    }

    // Audit log
    if (adminUser) {
      await logAudit({
        userId: adminUser._id,
        action: 'user_bulk_import',
        targetType: 'user',
        metadata: {
          totalRows: rows.length,
          importedCount: imported.length,
          skippedCount: skipped.length,
          failedCount: errors.length,
        },
        req,
      });
    }
  } else {
    // In dry-run, list what would be created
    for (const item of toCreate) {
      imported.push({
        studentId: item.studentId || null,
        fullName: item.fullName,
        email: item.email,
        role: item.role,
        major: item.major,
      });
    }
  }

  return {
    success: errors.length === 0,
    dryRun,
    summary: {
      totalRows: rows.length,
      importedCount: imported.length,
      skippedCount: skipped.length,
      failedCount: errors.length,
    },
    imported,
    skipped,
    errors,
  };
}

/**
 * Generate CSV or Excel template file buffer for admin download
 *
 * @param {'xlsx'|'csv'} format
 * @returns {{ buffer: Buffer, filename: string, mimeType: string }}
 */
function generateImportTemplate(format = 'xlsx') {
  const isCsv = String(format).toLowerCase() === 'csv';

  const templateData = [
    {
      studentId: '68409010911',
      fullName: 'นางสาวกานติมา สมศักดิ์',
      citizenId: '1419900123456',
      email: 'kantima31048@gmail.com',
      password: '',
      major: 'สาขาวิชาเทคโนโลยีสารสนเทศ',
      phone: '',
      role: 'graduate',
    },
    {
      studentId: '68409010912',
      fullName: 'นายทดสอบ สมมุติ',
      citizenId: '1419900987654',
      email: '',
      password: '',
      major: 'สาขาวิชาเทคโนโลยีสารสนเทศ',
      phone: '0812345678',
      role: 'graduate',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData, {
    header: ['studentId', 'fullName', 'citizenId', 'email', 'password', 'major', 'phone', 'role'],
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

  if (isCsv) {
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    // Add UTF-8 BOM so Excel opens Thai characters correctly in CSV
    const buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csvOutput, 'utf8')]);
    return {
      buffer,
      filename: 'user_import_template.csv',
      mimeType: 'text/csv; charset=utf-8',
    };
  }

  const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return {
    buffer: xlsxBuffer,
    filename: 'user_import_template.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

module.exports = {
  parseSpreadsheetBuffer,
  processUserImport,
  generateImportTemplate,
  HEADER_MAP,
};
