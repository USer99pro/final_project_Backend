/**
 * ทดสอบ API อัตโนมัติ — รันหลัง server ทำงานที่ PORT (default 3000)
 * ใช้: node scripts/test-api.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = `http://localhost:${process.env.PORT || 3000}`;
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

  // 1. Health
  try {
    const { status, data } = await request('GET', '/health');
    if (status === 200 && data?.ok) ok('GET /health');
    else fail('GET /health', `status ${status}`);
  } catch (e) {
    fail('GET /health', `เชื่อม server ไม่ได้ — รัน npm start ก่อน (${e.message})`);
    console.log('\n❌ หยุดทดสอบ: server ไม่ทำงาน\n');
    process.exit(1);
  }

  // 2. Login admin
  let adminToken;
  try {
    const { status, data } = await request('POST', '/api/auth/login', {
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (status === 200 && data?.token) {
      adminToken = data.token;
      ok('POST /api/auth/login (admin)');
    } else {
      fail('POST /api/auth/login', JSON.stringify(data));
      console.log('\n💡 รัน npm run init:db ก่อนเพื่อสร้าง admin\n');
      process.exit(1);
    }
  } catch (e) {
    fail('POST /api/auth/login', e.message);
    process.exit(1);
  }

  // 3. Me
  {
    const { status, data } = await request('GET', '/api/auth/me', { token: adminToken });
    if (status === 200 && data?.role === 'admin') ok('GET /api/auth/me');
    else fail('GET /api/auth/me', JSON.stringify(data));
  }

  // 4. Category + Tag (admin)
  let categoryId;
  let tagId;
  {
    const name = `test-cat-${Date.now()}`;
    const { status, data } = await request('POST', '/api/categories', {
      token: adminToken,
      body: { name, description: 'ทดสอบ' },
    });
    if (status === 201 && data?._id) {
      categoryId = data._id;
      ok('POST /api/categories');
    } else fail('POST /api/categories', JSON.stringify(data));
  }
  {
    const name = `test-tag-${Date.now()}`;
    const { status, data } = await request('POST', '/api/tags', {
      token: adminToken,
      body: { name },
    });
    if (status === 201 && data?._id) {
      tagId = data._id;
      ok('POST /api/tags');
    } else fail('POST /api/tags', JSON.stringify(data));
  }

  // 5. List tags/categories (public)
  {
    const { status } = await request('GET', '/api/tags');
    if (status === 200) ok('GET /api/tags');
    else fail('GET /api/tags');
  }
  {
    const { status } = await request('GET', '/api/categories');
    if (status === 200) ok('GET /api/categories');
    else fail('GET /api/categories');
  }

  // 6. Create user (admin)
  const testUserEmail = `user${Date.now()}@test.local`;
  let userId;
  {
    const { status, data } = await request('POST', '/api/users', {
      token: adminToken,
      body: {
        fullName: 'ผู้ใช้ทดสอบ',
        email: testUserEmail,
        password: 'user123456',
        role: 'user',
      },
    });
    if (status === 201 && data?._id) {
      userId = data._id;
      ok('POST /api/users (admin สร้าง user)');
    } else fail('POST /api/users', JSON.stringify(data));
  }

  // 7. User login
  let userToken;
  {
    const { status, data } = await request('POST', '/api/auth/login', {
      body: { email: testUserEmail, password: 'user123456' },
    });
    if (status === 200 && data?.token) {
      userToken = data.token;
      ok('POST /api/auth/login (user)');
    } else fail('POST /api/auth/login (user)', JSON.stringify(data));
  }

  // 8. Create content (multipart without real PDF — optional field)
  let contentId;
  if (userToken && categoryId && tagId) {
    const form = new FormData();
    form.append('title', 'เนื้อหาทดสอบ');
    form.append('description', 'รายละเอียดทดสอบ API');
    form.append('category', categoryId);
    form.append('tags', tagId);
    const { status, data } = await request('POST', '/api/contents', {
      token: userToken,
      formData: form,
    });
    if (status === 201 && data?._id) {
      contentId = data._id;
      ok('POST /api/contents');
    } else fail('POST /api/contents', JSON.stringify(data));
  }

  // 9. List contents
  if (userToken) {
    const { status, data } = await request('GET', '/api/contents', { token: userToken });
    if (status === 200 && Array.isArray(data)) ok('GET /api/contents');
    else fail('GET /api/contents', JSON.stringify(data));
  }

  // 10. Patch own profile
  if (userToken && userId) {
    const { status } = await request('PATCH', `/api/users/${userId}`, {
      token: userToken,
      body: { phone: '0899999999' },
    });
    if (status === 200) ok('PATCH /api/users/:id (ตัวเอง)');
    else fail('PATCH /api/users/:id');
  }

  // 11. Unauthorized
  {
    const { status } = await request('GET', '/api/contents');
    if (status === 401) ok('GET /api/contents ไม่มี token → 401');
    else fail('ต้องได้ 401 เมื่อไม่มี token', `got ${status}`);
  }

  console.log(`\n📊 ผลลัพธ์: ผ่าน ${passed}, ไม่ผ่าน ${failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
