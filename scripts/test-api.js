/**
 * ทดสอบ API อัตโนมัติ
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = `http://localhost:${process.env.PORT || 3500}`;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@example.com').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failed += 1;
  console.error(`  ✗ ${name}`);
  if (detail) console.error(`    ${detail}`);
}

async function request(method, urlPath, { token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let bodyToSend;
  if (formData) {
    bodyToSend = formData;
  } else if (body != null) {
    headers['Content-Type'] = 'application/json';
    bodyToSend = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${urlPath}`, { method, headers, body: bodyToSend });
  let data;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function run() {
  console.log(`\n🧪 ทดสอบ API — ${BASE}\n`);

  try {
    const { status, data } = await request('GET', '/health');
    if (status === 200 && data?.ok) ok('GET /health');
    else fail('GET /health', `status ${status}`);
  } catch (e) {
    fail('GET /health', `server ไม่ทำงาน: ${e.message}`);
    process.exit(1);
  }

  {
    const { status, data } = await request('GET', '/api/public/projects');
    if (status === 200 && Array.isArray(data?.projects)) ok('GET /api/public/projects');
    else fail('GET /api/public/projects', JSON.stringify(data));
  }

  {
    const { status, data } = await request('GET', '/api/public/projects?q=test');
    if (status === 200) ok('GET /api/public/projects?q= (ค้นหา)');
    else fail('ค้นหา public', JSON.stringify(data));
  }

  let adminToken;
  {
    const { status, data } = await request('POST', '/api/auth/login', {
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const token = data?.accessToken || data?.token;
    if (status === 200 && token) {
      adminToken = token;
      ok('POST /api/auth/login (admin)');
    } else {
      fail('admin login', JSON.stringify(data));
      console.log('\n💡 รัน npm run init:db\n');
      process.exit(1);
    }
  }

  {
    const { status, data } = await request('GET', '/api/admin/dashboard', { token: adminToken });
    if (status === 200 && data?.users) ok('GET /api/admin/dashboard');
    else fail('dashboard', JSON.stringify(data));
  }

  const gradEmail = `grad${Date.now()}@test.local`;
  const gradPass = 'grad123456';
  let gradToken;
  {
    const { status, data } = await request('POST', '/api/auth/register', {
      body: {
        studentId: `G${Date.now()}`,
        fullName: 'นักศึกษาทดสอบ',
        major: 'วิทยาการคอมพิวเตอร์',
        email: gradEmail,
        password: gradPass,
        confirmPassword: gradPass,
      },
    });
    const token = data?.accessToken || data?.token;
    if (status === 201 && token) {
      gradToken = token;
      ok('POST /api/auth/register (graduate)');
    } else fail('register', JSON.stringify(data));
  }

  let contentId;
  if (gradToken) {
    const form = new FormData();
    form.append('title', 'ผลงานทดสอบระบบ');
    form.append('abstract', 'บทคัดย่อทดสอบ');
    form.append('academicYear', '2567');
    form.append('major', 'วิทยาการคอมพิวเตอร์');
    form.append('status', 'published');
    const { status, data } = await request('POST', '/api/contents', { token: gradToken, formData: form });
    if (status === 201 && data?._id) {
      contentId = data._id;
      ok('POST /api/contents (graduate)');
    } else fail('create content', JSON.stringify(data));
  }

  if (contentId) {
    const { status, data } = await request('GET', `/api/public/projects/${contentId}`);
    if (status === 200 && data?.abstract) ok('GET public detail + abstract');
    else fail('public published detail', JSON.stringify(data));
  }

  if (gradToken) {
    const { status, data } = await request('GET', '/api/me/works', { token: gradToken });
    if (status === 200 && Array.isArray(data?.works)) ok('GET /api/me/works');
    else fail('me/works', JSON.stringify(data));

    const { status: s2 } = await request('GET', '/api/me/activity', { token: gradToken });
    if (s2 === 200) ok('GET /api/me/activity');
    else fail('me/activity');
  }

  let advisorId;
  if (adminToken) {
    const { status, data } = await request('POST', '/api/advisors', {
      token: adminToken,
      body: {
        prefix: 'ผศ.ดร.',
        fullName: 'สมชาย ใฝ่เรียนรู้',
        email: 'somchai@test.ac.th',
        academicPosition: 'ผู้ช่วยศาสตราจารย์',
        departmentName: 'วิทยาการคอมพิวเตอร์',
        expertise: ['Machine Learning', 'Data Science'],
        office: 'CS-301',
      },
    });
    if (status === 201 && data?.advisor?._id) {
      advisorId = data.advisor._id;
      ok('POST /api/advisors (เพิ่มอาจารย์ที่ปรึกษา)');
    } else {
      fail('create advisor', JSON.stringify(data));
    }
  }

  {
    const { status, data } = await request('GET', '/api/advisors?q=สมชาย');
    if (status === 200 && Array.isArray(data?.advisors) && data.advisors.length > 0) {
      ok('GET /api/advisors?q= (ค้นหาอาจารย์ที่ปรึกษา)');
    } else {
      fail('search advisors', JSON.stringify(data));
    }
  }

  {
    const { status, data } = await request('GET', '/api/public/advisors?q=Machine');
    if (status === 200 && Array.isArray(data?.advisors) && data.advisors.length > 0) {
      ok('GET /api/public/advisors (ค้นหาอาจารย์ที่ปรึกษา Public)');
    } else {
      fail('public search advisors', JSON.stringify(data));
    }
  }

  if (adminToken) {
    const { status } = await request('GET', '/api/admin/audit-logs', { token: adminToken });
    if (status === 200) ok('GET /api/admin/audit-logs');
    else fail('audit-logs');

    const { status: s2, data } = await request('GET', '/api/admin/reports/summary', { token: adminToken });
    if (s2 === 200 && data?.period) ok('GET /api/admin/reports/summary');
    else fail('reports/summary');
  }

  {
    const { status } = await request('GET', '/api/contents');
    if (status === 401) ok('GET /api/contents ไม่มี token → 401');
    else fail('ต้องได้ 401', `got ${status}`);
  }

  console.log(`\n📊 ผลลัพธ์: ผ่าน ${passed}, ไม่ผ่าน ${failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
