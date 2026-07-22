/**
 * Comprehensive API endpoint test — all routes
 * Usage: node scripts/test-all-endpoints.js  (server must be running)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = `http://localhost:${process.env.PORT || 3500}`;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@example.com').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';

const results = [];

async function request(method, urlPath, { token, body, formData, expectStatus } = {}) {
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
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
  } else {
    data = text;
  }
  return { status: res.status, data, contentType };
}

function record(method, path, auth, status, expected, pass, note = '') {
  results.push({ method, path, auth, status, expected, pass, note });
  const icon = pass ? '✓' : '✗';
  const line = `${icon} ${method} ${path}${note ? ` — ${note}` : ''}`;
  if (pass) console.log(`  ${line}`);
  else console.error(`  ${line} (got ${status}, expected ${expected})`);
}

function expect(method, path, auth, res, expectedStatuses, note = '') {
  const expected = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  const pass = expected.includes(res.status);
  record(method, path, auth, res.status, expected.join('|'), pass, note);
  return pass;
}

async function run() {
  console.log(`\n🔍 Full API test — ${BASE}\n`);

  let adminToken, gradToken, adminId, gradId, contentId, categoryId, tagId, deptId;

  // ── Public / no auth ──
  expect('GET', '/health', 'none', await request('GET', '/health'), 200, 'health check');
  expect('GET', '/api/public/projects', 'none', await request('GET', '/api/public/projects'), 200);
  expect('GET', '/api/public/projects?q=test', 'none', await request('GET', '/api/public/projects?q=test'), 200);
  expect('GET', '/api/public/projects?title=test', 'none', await request('GET', '/api/public/projects?title=test'), 200);
  expect('GET', '/api/public/papers', 'none', await request('GET', '/api/public/papers'), 200);
  expect('GET', '/api/public/categories', 'none', await request('GET', '/api/public/categories'), 200);
  expect('GET', '/api/public/tags', 'none', await request('GET', '/api/public/tags'), 200);
  expect('GET', '/api/departments', 'none', await request('GET', '/api/departments'), 200);
  expect('GET', '/api/tags', 'none', await request('GET', '/api/tags'), 200);
  expect('GET', '/api/categories', 'none', await request('GET', '/api/categories'), 200);

  // Auth required → 401
  expect('GET', '/api/contents', 'none', await request('GET', '/api/contents'), 401);
  expect('GET', '/api/users', 'none', await request('GET', '/api/users'), 401);
  expect('GET', '/api/me/works', 'none', await request('GET', '/api/me/works'), 401);
  expect('GET', '/api/admin/dashboard', 'none', await request('GET', '/api/admin/dashboard'), 401);

  // ── Auth ──
  {
    const res = await request('POST', '/api/auth/login', {
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (expect('POST', '/api/auth/login', 'none', res, 200)) {
      adminToken = res.data.token;
      adminId = res.data.user?._id;
    }
  }

  const gradEmail = `fulltest${Date.now()}@test.local`;
  {
    const res = await request('POST', '/api/auth/register', {
      body: {
        studentId: `FT${Date.now()}`,
        fullName: 'Full Test Graduate',
        major: 'วิทยาการคอมพิวเตอร์',
        email: gradEmail,
        password: 'test123456',
        confirmPassword: 'test123456',
      },
    });
    if (expect('POST', '/api/auth/register', 'none', res, 201)) {
      gradToken = res.data.token;
      gradId = res.data.user?._id;
    }
  }

  expect('POST', '/api/auth/login (bad creds)', 'none',
    await request('POST', '/api/auth/login', { body: { email: 'x@y.com', password: 'wrong' } }), 401);

  if (adminToken) {
    expect('GET', '/api/auth/me', 'admin', await request('GET', '/api/auth/me', { token: adminToken }), 200);
  }
  if (gradToken) {
    expect('GET', '/api/auth/me', 'graduate', await request('GET', '/api/auth/me', { token: gradToken }), 200);
  }

  // ── Users ──
  if (adminToken) {
    const res = await request('GET', '/api/users', { token: adminToken });
    expect('GET', '/api/users', 'admin', res, 200);
  }
  if (gradToken) {
    const res = await request('GET', '/api/users', { token: gradToken });
    expect('GET', '/api/users', 'graduate', res, 200, 'list active users');
  }
  if (gradToken && gradId) {
    expect('GET', `/api/users/${gradId}`, 'graduate', await request('GET', `/api/users/${gradId}`, { token: gradToken }), 200);
    expect('GET', `/api/users/${adminId}`, 'graduate', await request('GET', `/api/users/${adminId}`, { token: gradToken }), 403);
  }
  if (adminToken && gradId) {
    expect('GET', `/api/users/${gradId}`, 'admin', await request('GET', `/api/users/${gradId}`, { token: adminToken }), 200);
  }

  // ── Departments (for category/tag scoping) ──
  {
    const res = await request('GET', '/api/departments');
    if (res.data?.length) deptId = res.data[0]._id;
  }

  // ── Categories (admin CRUD) ──
  if (adminToken) {
    const createRes = await request('POST', '/api/categories', {
      token: adminToken,
      body: { name: `TestCat${Date.now()}`, description: 'test', departments: deptId ? [deptId] : [] },
    });
    if (expect('POST', '/api/categories', 'admin', createRes, 201)) {
      categoryId = createRes.data?.data?._id;
    }
    expect('POST', '/api/categories (no name)', 'admin',
      await request('POST', '/api/categories', { token: adminToken, body: {} }), 400);
  }
  if (gradToken) {
    expect('POST', '/api/categories', 'graduate',
      await request('POST', '/api/categories', { token: gradToken, body: { name: 'x' } }), 403);
  }

  // ── Tags ──
  if (gradToken) {
    const tagRes = await request('POST', '/api/tags', {
      token: gradToken,
      body: { name: `kw${Date.now()}` },
    });
    if (expect('POST', '/api/tags', 'graduate', tagRes, 201)) {
      tagId = tagRes.data?._id;
    }
  }

  // ── Contents CRUD ──
  if (gradToken) {
    const form = new FormData();
    form.append('title', 'Full Test Project');
    form.append('abstract', 'Abstract for testing');
    form.append('academicYear', '2567');
    form.append('major', 'วิทยาการคอมพิวเตอร์');
    form.append('status', 'published');
    if (categoryId) form.append('category', categoryId);
    const createRes = await request('POST', '/api/contents', { token: gradToken, formData: form });
    if (expect('POST', '/api/contents', 'graduate', createRes, 201)) {
      contentId = createRes.data?._id;
    }

    expect('GET', '/api/contents', 'graduate', await request('GET', '/api/contents', { token: gradToken }), 200);
    if (contentId) {
      expect('GET', `/api/contents/${contentId}`, 'graduate',
        await request('GET', `/api/contents/${contentId}`, { token: gradToken }), 200);
      expect('PATCH', `/api/contents/${contentId}`, 'graduate',
        await request('PATCH', `/api/contents/${contentId}`, {
          token: gradToken,
          body: { title: 'Updated Title', participants: adminId || '' },
        }), 200, 'participants as string id');
    }
  }

  if (adminToken) {
    expect('GET', '/api/contents', 'admin', await request('GET', '/api/contents', { token: adminToken }), 200);
    expect('GET', '/api/contents?q=test', 'admin', await request('GET', '/api/contents?q=test', { token: adminToken }), 200);
  }

  // ── Public detail (published) ──
  if (contentId) {
    const pubRes = await request('GET', `/api/public/projects/${contentId}`);
    expect('GET', `/api/public/projects/:id`, 'none', pubRes, 200);
    if (pubRes.data?.participants !== undefined) {
      record('GET', '/api/public/projects/:id participants', 'none', pubRes.status, '200', Array.isArray(pubRes.data.participants), 'participants in response');
    }
    expect('GET', `/api/public/projects/${contentId}/file`, 'none',
      await request('GET', `/api/public/projects/${contentId}/file`), [200, 404], 'file may 404 without PDF');
  }

  // ── Me ──
  if (gradToken) {
    expect('GET', '/api/me/works', 'graduate', await request('GET', '/api/me/works', { token: gradToken }), 200);
    expect('GET', '/api/me/activity', 'graduate', await request('GET', '/api/me/activity', { token: gradToken }), 200);
  }

  // ── Uploads ──
  if (gradToken) {
    expect('GET', '/api/uploads/papers', 'graduate', await request('GET', '/api/uploads/papers', { token: gradToken }), 200);
    if (contentId) {
      expect('GET', `/api/uploads/papers/${contentId}`, 'graduate',
        await request('GET', `/api/uploads/papers/${contentId}`, { token: gradToken }), [200, 404]);
    }
  }

  // ── Admin ──
  if (adminToken) {
    expect('GET', '/api/admin/dashboard', 'admin', await request('GET', '/api/admin/dashboard', { token: adminToken }), 200);
    expect('GET', '/api/admin/users', 'admin', await request('GET', '/api/admin/users', { token: adminToken }), 200);
    expect('GET', '/api/admin/users?search=test', 'admin',
      await request('GET', '/api/admin/users?search=test', { token: adminToken }), 200);
    expect('GET', '/api/admin/works', 'admin', await request('GET', '/api/admin/works', { token: adminToken }), 200);
    expect('GET', '/api/admin/audit-logs', 'admin', await request('GET', '/api/admin/audit-logs', { token: adminToken }), 200);
    expect('GET', '/api/admin/login-logs', 'admin', await request('GET', '/api/admin/login-logs', { token: adminToken }), 200);
    expect('GET', '/api/admin/reports/summary', 'admin',
      await request('GET', '/api/admin/reports/summary', { token: adminToken }), 200);
    const csvRes = await request('GET', '/api/admin/reports/export.csv', { token: adminToken });
    expect('GET', '/api/admin/reports/export.csv', 'admin', csvRes, 200);
  }
  if (gradToken) {
    expect('GET', '/api/admin/dashboard', 'graduate',
      await request('GET', '/api/admin/dashboard', { token: gradToken }), 403);
  }

  // ── Admin user management (on grad user) ──
  if (adminToken && gradId) {
    expect('PATCH', `/api/admin/users/${gradId}/suspend`, 'admin',
      await request('PATCH', `/api/admin/users/${gradId}/suspend`, { token: adminToken }), 200);
    expect('PATCH', `/api/admin/users/${gradId}/activate`, 'admin',
      await request('PATCH', `/api/admin/users/${gradId}/activate`, { token: adminToken }), 200);
    expect('POST', `/api/admin/users/${gradId}/reset-password`, 'admin',
      await request('POST', `/api/admin/users/${gradId}/reset-password`, {
        token: adminToken, body: { newPassword: 'newpass123' },
      }), 200);
  }

  // ── Cleanup ──
  if (gradToken && contentId) {
    expect('DELETE', `/api/contents/${contentId}`, 'graduate',
      await request('DELETE', `/api/contents/${contentId}`, { token: gradToken }), 200);
  }
  if (gradToken && tagId) {
    expect('DELETE', `/api/tags/${tagId}`, 'graduate',
      await request('DELETE', `/api/tags/${tagId}`, { token: gradToken }), 200);
  }
  if (adminToken && categoryId) {
    expect('DELETE', `/api/categories/${categoryId}`, 'admin',
      await request('DELETE', `/api/categories/${categoryId}`, { token: adminToken }), 200);
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed (total ${results.length})\n`);

  if (failed > 0) {
    console.log('Failures:');
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  ${r.method} ${r.path} — got ${r.status}, expected ${r.expected}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
