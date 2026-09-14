const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { spawn } = require('child_process');
const sharp = require('sharp');
const XLSX = require('xlsx');

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test123';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@localhost';
const ROOT = path.join(__dirname, '..');
let adminCookie = '';
let sessionCookie = '';

function assert(cond, msg) {
  if (cond) { console.log(`PASS: ${msg}`); return true; }
  console.error(`FAIL: ${msg}`);
  return false;
}

function dirSizeBytes(rootDir) {
  if (!fs.existsSync(rootDir)) return 0;
  let total = 0;
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) total += fs.statSync(full).size;
    }
  }
  return total;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on('error', reject);
  });
}

async function waitForServer(base, timeoutMs = 25000) {
  const started = Date.now();
  let lastErr = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/branding`);
      if (res.ok) return;
      lastErr = new Error(`branding ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Temp server not ready at ${base}: ${lastErr && lastErr.message}`);
}

async function withTempServer(env, fn) {
  const port = await getFreePort();
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      EMAIL_PROVIDER: 'console',
      MESSAGING_PROVIDER: 'console',
      RATE_LIMIT_DISABLED: 'true',
      RETENTION_AUTO_PURGE: 'false',
      ADMIN_PASSWORD,
      ADMIN_EMAIL,
      SESSION_COOKIE_SECRET: process.env.SESSION_COOKIE_SECRET || 'dev-secret-change-me',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  child.stdout.on('data', () => {});

  const base = `http://127.0.0.1:${port}`;
  try {
    await waitForServer(base);
    await fn(base);
  } catch (err) {
    if (stderr.trim()) console.error(stderr.trim());
    throw err;
  } finally {
    if (!child.killed) {
      child.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (!child.killed) child.kill('SIGKILL');
    }
  }
}

function clearConfigModules() {
  for (const rel of [
    '../config',
    '../lib/retention',
    '../lib/access',
    '../lib/quota',
  ]) {
    try {
      delete require.cache[require.resolve(rel)];
    } catch {
      // ignore
    }
  }
}

function withPlanConfig(plan, fn) {
  const prevPlan = process.env.PLAN;
  const prevRetention = process.env.DEFAULT_RETENTION_MONTHS;
  const prevOverrides = {
    FEATURE_PRODUCT_CODES: process.env.FEATURE_PRODUCT_CODES,
    FEATURE_ORDER_FILTERING: process.env.FEATURE_ORDER_FILTERING,
    FEATURE_TAGS: process.env.FEATURE_TAGS,
    FEATURE_RETENTION_OVERRIDE: process.env.FEATURE_RETENTION_OVERRIDE,
  };

  process.env.PLAN = plan;
  delete process.env.DEFAULT_RETENTION_MONTHS;
  for (const key of Object.keys(prevOverrides)) delete process.env[key];
  clearConfigModules();

  try {
    return fn({
      config: require('../config'),
      retention: require('../lib/retention'),
      access: require('../lib/access'),
    });
  } finally {
    if (prevPlan === undefined) delete process.env.PLAN;
    else process.env.PLAN = prevPlan;
    if (prevRetention === undefined) delete process.env.DEFAULT_RETENTION_MONTHS;
    else process.env.DEFAULT_RETENTION_MONTHS = prevRetention;
    for (const [key, value] of Object.entries(prevOverrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    clearConfigModules();
  }
}

async function adminLogin(email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  let res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  // Backward-compatible: single-admin installs can still auth with password only
  if (!res.ok) {
    res = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  }
  if (!res.ok) throw new Error('Admin login failed');
  const cookies = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
  adminCookie = cookies.map((c) => c.split(';')[0]).join('; ');
}

function adminFetch(url, opts = {}) {
  return fetch(url, { ...opts, headers: { ...opts.headers, Cookie: adminCookie } });
}

function customerFetch(url, opts = {}) {
  return fetch(url, { ...opts, headers: { ...opts.headers, Cookie: sessionCookie } });
}

async function createImages(dir) {
  const files = [];
  for (let i = 1; i <= 4; i++) {
    const filename = `IMG_00${i}.jpg`;
    const filePath = path.join(dir, filename);
    await sharp({ create: { width: 900, height: 1200, channels: 3, background: `#${i}96969` } }).jpeg().toFile(filePath);
    files.push({ filename, filePath });
  }
  return files;
}

function writeXlsx(filePath, rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
  XLSX.writeFile(wb, filePath);
}

async function waitForCollectionThumbs(collectionId, minCount, timeoutMs = 15000) {
  const uploadsRoot = path.join(__dirname, '..', 'uploads');
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const col = await adminFetch(`${BASE}/api/admin/collections/${collectionId}`).then((r) => r.json());
    if ((col.images || []).length >= minCount) {
      const ready = col.images.every((img) => {
        const rel = String(img.thumb_path || '').replace(/\\/g, '/');
        if (!rel.includes('/thumb/')) return false;
        return fs.existsSync(path.join(uploadsRoot, img.thumb_path));
      });
      if (ready) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function uploadImages(collectionId, images) {
  const fd = new FormData();
  for (const img of images) {
    fd.append('images', new Blob([fs.readFileSync(img.filePath)]), img.filename);
  }
  const result = await adminFetch(`${BASE}/api/admin/collections/${collectionId}/images`, {
    method: 'POST',
    body: fd,
  }).then((r) => r.json());
  await waitForCollectionThumbs(collectionId, images.length);
  return result;
}

async function createCustomer(body) {
  const res = await adminFetch(`${BASE}/api/admin/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function customerLogin(phone, code) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  sessionCookie = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  return res;
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-smoke-'));
  let fails = 0;
  const fail = (cond, msg) => { if (!assert(cond, msg)) fails++; };

  try {
    // Clean DB for idempotent reruns
    const db = require('../db');
    db.exec(`
      DELETE FROM download_log;
      DELETE FROM message_log;
      DELETE FROM collection_customers;
      DELETE FROM storage_snapshots;
      DELETE FROM order_items;
      DELETE FROM sessions;
      DELETE FROM auth_attempts;
      DELETE FROM images;
      DELETE FROM collections;
      DELETE FROM customers;
    `);

    await adminLogin();

    const logoutRes = await adminFetch(`${BASE}/api/logout`, { method: 'POST' });
    fail(logoutRes.ok, 'admin logout clears session');
    adminCookie = '';
    const blocked = await fetch(`${BASE}/api/admin/collections`);
    fail(blocked.status === 401, 'admin collections require auth after logout');
    await adminLogin();

    const changeBad = await adminFetch(`${BASE}/api/admin/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'newpass123' }),
    });
    fail(changeBad.status === 400, 'admin change-password rejects wrong current password');

    const adminsList = await adminFetch(`${BASE}/api/admin/admins`).then((r) => r.json());
    fail(Array.isArray(adminsList.data) && adminsList.data.length >= 1, 'admin list returns at least one admin');
    fail(adminsList.data.some((a) => a.isSuperadmin), 'superadmin is present in admin list');

    const me = await adminFetch(`${BASE}/api/admin/me`).then((r) => r.json());
    fail(me.isSuperadmin === true, 'bootstrap admin is superadmin');

    const secondAdminEmail = `second-admin-${Date.now()}@example.com`;
    const createdAdmin = await adminFetch(`${BASE}/api/admin/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: secondAdminEmail,
        name: 'Second Admin',
        password: 'secondpass123',
      }),
    });
    fail(createdAdmin.status === 201, 'superadmin can create a second admin');
    const createdAdminBody = await createdAdmin.json();
    fail(createdAdminBody.email === secondAdminEmail, 'created admin returns email');
    fail(createdAdminBody.isSuperadmin !== true, 'created admin is not superadmin');

    await adminFetch(`${BASE}/api/logout`, { method: 'POST' });
    adminCookie = '';
    await adminLogin(secondAdminEmail, 'secondpass123');
    fail(Boolean(adminCookie), 'second admin can log in');

    const forbiddenCreate = await adminFetch(`${BASE}/api/admin/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `other-${Date.now()}@example.com`,
        name: 'Other',
        password: 'otherpass123',
      }),
    });
    fail(forbiddenCreate.status === 403, 'regular admin cannot create admins');

    const forbiddenList = await adminFetch(`${BASE}/api/admin/admins`);
    fail(forbiddenList.status === 403, 'regular admin cannot list admins');

    const deleteSelf = await adminFetch(`${BASE}/api/admin/admins/${createdAdminBody.id}`, { method: 'DELETE' });
    fail(deleteSelf.status === 403 || deleteSelf.status === 400, 'regular admin cannot delete admins');

    await adminFetch(`${BASE}/api/logout`, { method: 'POST' });
    adminCookie = '';
    await adminLogin();

    const deleteSuper = await adminFetch(`${BASE}/api/admin/admins/${me.id}`, { method: 'DELETE' });
    fail(deleteSuper.status === 400, 'superadmin cannot be deleted');

    const deleted = await adminFetch(`${BASE}/api/admin/admins/${createdAdminBody.id}`, { method: 'DELETE' });
    fail(deleted.ok, 'superadmin can delete regular admin');

    const images = await createImages(tmp);

    // Collection A - no mapping, no orders
    const colA = await adminFetch(`${BASE}/api/admin/collections`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Collection A' }),
    }).then(r => r.json());
    await uploadImages(colA.id, images);
    await adminFetch(`${BASE}/api/admin/collections/${colA.id}/publish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notify: false }),
    });

    const c1 = await createCustomer({ name: 'Customer One', phone: '6912345678', email: 'c1@test.com', sendCode: false });
    const c2 = await createCustomer({ name: 'Customer Two', phone: '6987654321', email: 'c2@test.com', sendCode: false });
    const c3 = await createCustomer({ name: 'Customer Three', phone: '6971111111', sendCode: false });

    let loginRes = await customerLogin('6912345678', c1.accessCode);
    fail(loginRes.ok, 'login with correct code sets session');
    fail(sessionCookie.includes('pd_session'), 'session cookie present');

    let galA = await customerFetch(`${BASE}/api/collections/${colA.id}`).then(r => r.json());
    fail(galA.images.length === 4 && galA.images.every(i => i.downloadable), 'customer 1 sees all 4 in A downloadable');
    fail(galA.images.every(i => i.webBytes > 0 && i.fullBytes > 0), 'gallery images expose byte sizes');
    fail(galA.fullAvailable === true, 'collection reports fullAvailable before purge');

    // Wrong code
    sessionCookie = '';
    const badLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '6912345678', code: 'WRONGCOD' }),
    });
    fail(badLogin.status === 401, 'login with wrong code returns 401');

    const unauth = await fetch(`${BASE}/api/collections`);
    const unauthData = await unauth.json();
    fail(unauth.status === 401 && unauthData.requiresLogin, 'unauthenticated GET /api/collections returns 401');

    // Draft not visible
    const colDraft = await adminFetch(`${BASE}/api/admin/collections`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Draft Only' }),
    }).then(r => r.json());
    await customerLogin('6912345678', c1.accessCode);
    const list = await customerFetch(`${BASE}/api/collections`).then(r => r.json());
    fail(!list.find(c => c.id === colDraft.id), 'draft collection never appears');

    await uploadImages(colDraft.id, images.slice(0, 1));
    const draftCol = await adminFetch(`${BASE}/api/admin/collections/${colDraft.id}`).then((r) => r.json());
    const draftImage = draftCol.images[0];
    const uploadsRoot = path.join(__dirname, '..', 'uploads');
    const thumbFile = path.join(uploadsRoot, draftImage.thumb_path);
    const thumbBefore = await adminFetch(
      `${BASE}/api/admin/collections/${colDraft.id}/images/${draftImage.id}/thumb`
    );
    fail(thumbBefore.ok, 'admin collection image thumb is served');
    fail(fs.existsSync(thumbFile), 'image thumb file exists before delete');

    const delRes = await adminFetch(
      `${BASE}/api/admin/collections/${colDraft.id}/images/${draftImage.id}`,
      { method: 'DELETE' }
    );
    fail(delRes.ok, 'admin can delete collection image');

    const afterDelete = await adminFetch(`${BASE}/api/admin/collections/${colDraft.id}`).then((r) => r.json());
    fail(afterDelete.images.length === 0, 'deleted image removed from collection');

    const thumbAfter = await adminFetch(
      `${BASE}/api/admin/collections/${colDraft.id}/images/${draftImage.id}/thumb`
    );
    fail(thumbAfter.status === 404, 'deleted image thumb returns 404');
    fail(!fs.existsSync(thumbFile), 'image thumb file removed after delete');

    await uploadImages(colDraft.id, images.slice(1, 3));
    const draftColBulk = await adminFetch(`${BASE}/api/admin/collections/${colDraft.id}`).then((r) => r.json());
    const bulkIds = draftColBulk.images.map((img) => img.id);
    const bulkDel = await adminFetch(`${BASE}/api/admin/collections/${colDraft.id}/images/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageIds: bulkIds }),
    });
    fail(bulkDel.ok, 'admin bulk-delete images');
    const afterBulk = await adminFetch(`${BASE}/api/admin/collections/${colDraft.id}`).then((r) => r.json());
    fail(afterBulk.images.length === 0, 'bulk-delete removes images from collection');

    // Collection B with mapping and orders
    const mappingPath = path.join(tmp, 'mapping.xlsx');
    writeXlsx(mappingPath, [
      ['filename', 'product'],
      ['IMG_001.jpg', 'DRESS-001'], ['IMG_002.jpg', 'DRESS-002'],
      ['IMG_003.jpg', 'SHIRT-010'], ['IMG_004.jpg', 'SHIRT-011'],
    ]);
    const ordersPath = path.join(tmp, 'orders.xlsx');
    writeXlsx(ordersPath, [['erp', 'product'], ['ERP001', 'DRESS-001']]);

    const colB = await adminFetch(`${BASE}/api/admin/collections`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Collection B' }),
    }).then(r => r.json());
    await uploadImages(colB.id, images);

    const mapFd = new FormData();
    mapFd.append('mapping', new Blob([fs.readFileSync(mappingPath)]), 'mapping.xlsx');
    await adminFetch(`${BASE}/api/admin/collections/${colB.id}/mapping`, { method: 'POST', body: mapFd });

    await adminFetch(`${BASE}/api/admin/customers/${c1.customer.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ erp_code: 'ERP001', default_access_mode: 'order_only' }),
    });

    const ordFd = new FormData();
    ordFd.append('orders', new Blob([fs.readFileSync(ordersPath)]), 'orders.xlsx');
    await adminFetch(`${BASE}/api/admin/collections/${colB.id}/orders`, { method: 'POST', body: ordFd });
    await adminFetch(`${BASE}/api/admin/collections/${colB.id}/publish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notify: false }),
    });

    await customerLogin('6912345678', c1.accessCode);
    galA = await customerFetch(`${BASE}/api/collections/${colA.id}`).then(r => r.json());
    const galB = await customerFetch(`${BASE}/api/collections/${colB.id}`).then(r => r.json());
    fail(galA.images.length === 4, 'customer 1 still sees all 4 in A');
    fail(galB.images.length === 1, 'customer 1 sees only 1 in B');

    const sampleRes = await adminFetch(`${BASE}/api/admin/samples/image-mapping`);
    fail(
      sampleRes.ok && sampleRes.headers.get('content-type')?.includes('spreadsheetml'),
      'sample image-mapping excel is downloadable'
    );

    const adminExport = await adminFetch(`${BASE}/api/admin/collections/${colB.id}/export/image-mapping`);
    fail(
      adminExport.ok && adminExport.headers.get('content-type')?.includes('spreadsheetml'),
      'admin collection image-mapping export is downloadable'
    );

    const ordersSampleRes = await adminFetch(`${BASE}/api/admin/samples/orders`);
    fail(
      ordersSampleRes.ok && ordersSampleRes.headers.get('content-type')?.includes('spreadsheetml'),
      'sample orders excel is downloadable'
    );

    const customersSampleRes = await adminFetch(`${BASE}/api/admin/samples/customers`);
    fail(
      customersSampleRes.ok && customersSampleRes.headers.get('content-type')?.includes('spreadsheetml'),
      'sample customers excel is downloadable'
    );

    const adminOrdersExport = await adminFetch(`${BASE}/api/admin/collections/${colB.id}/export/orders`);
    fail(
      adminOrdersExport.ok && adminOrdersExport.headers.get('content-type')?.includes('spreadsheetml'),
      'admin collection orders export is downloadable'
    );

    const colBDetail = await adminFetch(`${BASE}/api/admin/collections/${colB.id}`).then(r => r.json());
    const deniedImg = colBDetail.images.find(i => i.product_code !== 'DRESS-001');

    const dlRes = await customerFetch(`${BASE}/api/collections/${colB.id}/download/${deniedImg.id}`);
    fail(dlRes.status === 403, 'download unauthorized image returns 403');

    const thumbRes = await customerFetch(`${BASE}/api/collections/${colB.id}/image/${deniedImg.id}/thumb`);
    fail(thumbRes.status === 403, 'thumbnail outside order returns 403');

    const allowed = galB.images[0];
    const zipRes = await customerFetch(`${BASE}/api/collections/${colB.id}/download-zip`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageIds: [allowed.id, deniedImg.id] }),
    });
    if (zipRes.ok) {
      const buf = Buffer.from(await zipRes.arrayBuffer());
      fail(buf.includes(Buffer.from('IMG_001.jpg')) && !buf.includes(Buffer.from('IMG_002.jpg')), 'zip contains only allowed file');
    } else fail(false, 'zip request failed');

    // Phone normalization
    sessionCookie = '';
    const formats = ['6912345678', '+30 691 234 5678', '306912345678'];
    for (const phone of formats) {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: c1.accessCode }),
      });
      if (r.ok) sessionCookie = r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    }
    fail(sessionCookie.includes('pd_session'), 'phone normalization resolves same customer');

    // --- Extensions: visibility (tag-based) ---
    await adminFetch(`${BASE}/api/admin/customers/${c2.customer.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: 'smoke-vip' }),
    });
    const colC = await adminFetch(`${BASE}/api/admin/collections`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Collection C Restricted' }),
    }).then(r => r.json());
    await uploadImages(colC.id, images);
    await adminFetch(`${BASE}/api/admin/collections/${colC.id}/visibility`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: 'selected', tags: ['smoke-vip'] }),
    });
    await adminFetch(`${BASE}/api/admin/collections/${colC.id}/publish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notify: true }),
    });

    await customerLogin('6912345678', c1.accessCode);
    const listC1 = await customerFetch(`${BASE}/api/collections`).then(r => r.json());
    fail(!listC1.find(c => c.id === colC.id), 'customer 1 does NOT see C in list');

    const directC1 = await customerFetch(`${BASE}/api/collections/${colC.id}`);
    fail(directC1.status === 404, 'customer 1 direct GET collection C returns 404');

    const colCDetail = await adminFetch(`${BASE}/api/admin/collections/${colC.id}`).then(r => r.json());
    const imgC = colCDetail.images[0];
    const imgC1 = await customerFetch(`${BASE}/api/collections/${colC.id}/image/${imgC.id}/thumb`);
    fail(imgC1.status === 403 || imgC1.status === 404, 'customer 1 image from C returns 403/404');

    await customerLogin('6987654321', c2.accessCode);
    const galC2 = await customerFetch(`${BASE}/api/collections/${colC.id}`).then(r => r.json());
    fail(galC2.images.length === 4, 'customer 2 sees C and can access gallery');

    const msgs = await adminFetch(`${BASE}/api/admin/messages`).then(r => r.json());
    const colCAnnounce = msgs.filter(m => m.kind === 'new_collection' && m.customer_id === c2.customer.id);
    fail(colCAnnounce.length >= 1, 'publishing C with notify announces to customer 2');
    const colCAnnounceC1 = msgs.filter(m => m.kind === 'new_collection' && m.customer_id === c1.customer.id && m.created_at > colC.created_at);
    fail(colCAnnounceC1.length === 0, 'publishing C does not announce to customer 1');

    // --- Extensions: retention ---
    const colADetail = await adminFetch(`${BASE}/api/admin/collections/${colA.id}`).then(r => r.json());
    const imgRow = db.prepare('SELECT full_bytes, full_purged FROM images WHERE collection_id = ?').get(colA.id);
    fail(imgRow.full_bytes > 0, 'images.full_bytes is non-zero after upload');

    const { purgeCollection } = require('../lib/retention');
    const dry = purgeCollection(colA.id, { dryRun: true });
    fail(dry.bytesReclaimed > 0 && dry.filesDeleted > 0, 'purgeCollection dryRun reports reclaimable bytes');

    const fullDir = path.join(__dirname, '..', 'uploads', String(colA.id), 'full');
    const fullCountBefore = fs.existsSync(fullDir) ? fs.readdirSync(fullDir).length : 0;
    purgeCollection(colA.id, { dryRun: false });
    const fullCountAfter = fs.existsSync(fullDir) ? fs.readdirSync(fullDir).length : 0;
    const purgedRow = db.prepare('SELECT full_purged FROM images WHERE collection_id = ? LIMIT 1').get(colA.id);
    fail(fullCountAfter === 0 && fullCountBefore > 0 && purgedRow.full_purged === 1, 'real purge clears full/ and sets full_purged');

    await customerLogin('6912345678', c1.accessCode);
    const purgedImg = colADetail.images[0];
    const dlPurged = await customerFetch(`${BASE}/api/collections/${colA.id}/download/${purgedImg.id}?size=full`);
    fail(dlPurged.status === 200, 'downloading purged image with size=full returns 200 with web variant');

    const dlWeb = await customerFetch(`${BASE}/api/collections/${colA.id}/download/${purgedImg.id}?size=web`);
    fail(dlWeb.status === 200, 'downloading with size=web returns 200');

    const dlBad = await customerFetch(`${BASE}/api/collections/${colA.id}/download/${purgedImg.id}?size=thumb`);
    fail(dlBad.status === 400, 'invalid download size returns 400');

    const galAfterPurge = await customerFetch(`${BASE}/api/collections/${colA.id}`).then(r => r.json());
    fail(galAfterPurge.fullAvailable === false, 'collection fullAvailable false after purge');

    const zipPurged = await customerFetch(`${BASE}/api/collections/${colA.id}/download-zip`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageIds: [purgedImg.id], size: 'full' }),
    });
    const zipBuf = Buffer.from(await zipPurged.arrayBuffer());
    fail(zipBuf.includes(Buffer.from('README.txt')), 'zip from purged collection contains README.txt');

    const logged = db.prepare('SELECT variant FROM download_log WHERE image_id = ? ORDER BY id DESC LIMIT 1').get(purgedImg.id);
    fail(logged?.variant === 'full' || logged?.variant === 'web', 'download_log records variant');

    const { getDiskUsage } = require('../lib/storage');
    const disk = getDiskUsage();
    fail(disk.totalBytes > 0 && disk.usedPercent >= 0 && disk.usedPercent <= 100, 'getDiskUsage returns plausible numbers');

    // --- Quota (temp server with tiny QUOTA_GB) ---
    const uploadsRootForQuota = path.join(ROOT, 'uploads');
    await withTempServer({ QUOTA_GB: '0.000001', PLAN: 'pro' }, async (quotaBase) => {
      const beforeBytes = dirSizeBytes(uploadsRootForQuota);
      const quotaCol = await fetch(`${quotaBase}/api/admin/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ name: 'Quota Reject' }),
      }).then((r) => r.json());

      const oversized = path.join(tmp, 'quota-over.jpg');
      await sharp({
        create: { width: 1200, height: 1600, channels: 3, background: '#334455' },
      }).jpeg({ quality: 90 }).toFile(oversized);

      const fd = new FormData();
      fd.append('images', new Blob([fs.readFileSync(oversized)]), 'quota-over.jpg');
      const overRes = await fetch(`${quotaBase}/api/admin/collections/${quotaCol.id}/images`, {
        method: 'POST',
        headers: { Cookie: adminCookie },
        body: fd,
      });
      const overBody = await overRes.json().catch(() => ({}));
      fail(overRes.status === 507, 'uploading beyond QUOTA_GB returns 507');
      fail(
        typeof overBody.error === 'string' && /χώρος|Χρησιμοποιούνται/i.test(overBody.error),
        'quota 507 returns Greek space message'
      );

      const afterBytes = dirSizeBytes(uploadsRootForQuota);
      fail(afterBytes === beforeBytes, 'rejected quota upload does not grow uploads/');

      const storage = await fetch(`${quotaBase}/api/admin/storage`, {
        headers: { Cookie: adminCookie },
      }).then((r) => r.json());
      const quota = storage.quota || {};
      const expectedPct = quota.quotaBytes > 0 ? (quota.usedBytes / quota.quotaBytes) * 100 : 0;
      fail(
        Number.isFinite(quota.percentUsed)
          && Math.abs(quota.percentUsed - expectedPct) < 0.01,
        'GET /api/admin/storage reports correct percentUsed'
      );
    });

    // --- Feature flags: PLAN=basic ---
    await withTempServer({ PLAN: 'basic' }, async (basicBase) => {
      const mapFdBasic = new FormData();
      mapFdBasic.append('mapping', new Blob([fs.readFileSync(mappingPath)]), 'mapping.xlsx');
      const mapBasic = await fetch(`${basicBase}/api/admin/collections/${colB.id}/mapping`, {
        method: 'POST',
        headers: { Cookie: adminCookie },
        body: mapFdBasic,
      });
      const mapBasicBody = await mapBasic.json().catch(() => ({}));
      fail(mapBasic.status === 403, 'PLAN=basic POST mapping returns 403');
      fail(/Pro|πακέτο/i.test(String(mapBasicBody.error || '')), 'basic mapping 403 names Pro plan');

      const ordFdBasic = new FormData();
      ordFdBasic.append('orders', new Blob([fs.readFileSync(ordersPath)]), 'orders.xlsx');
      const ordBasic = await fetch(`${basicBase}/api/admin/collections/${colB.id}/orders`, {
        method: 'POST',
        headers: { Cookie: adminCookie },
        body: ordFdBasic,
      });
      fail(ordBasic.status === 403, 'PLAN=basic POST orders returns 403');

      const visSelected = await fetch(`${basicBase}/api/admin/collections/${colB.id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ visibility: 'selected', tags: ['smoke-vip'] }),
      });
      fail(visSelected.status === 403, "PLAN=basic PATCH visibility to 'selected' returns 403");

      const visAll = await fetch(`${basicBase}/api/admin/collections/${colB.id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ visibility: 'all', tags: [] }),
      });
      fail(visAll.status === 200, "PLAN=basic PATCH visibility back to 'all' returns 200");

      const orderCount = db
        .prepare('SELECT COUNT(*) AS count FROM order_items WHERE collection_id = ?')
        .get(colB.id).count;
      fail(orderCount > 0, 'downgrade fixture collection B still has order_items rows');

      await customerLogin('6912345678', c1.accessCode);
      const galBasic = await fetch(`${basicBase}/api/collections/${colB.id}`, {
        headers: { Cookie: sessionCookie },
      }).then((r) => r.json());
      fail(
        Array.isArray(galBasic.images)
          && galBasic.images.length === 4
          && galBasic.images.every((img) => img.downloadable),
        'PLAN=basic with order_items still shows every image (downgrade safety)'
      );
    });

    // --- Feature flags: PLAN=pro ---
    await withTempServer({ PLAN: 'pro' }, async (proBase) => {
      const proFetch = (url, opts = {}) =>
        fetch(url, { ...opts, headers: { ...opts.headers, Cookie: adminCookie } });

      const mapFdPro = new FormData();
      mapFdPro.append('mapping', new Blob([fs.readFileSync(mappingPath)]), 'mapping.xlsx');
      const mapPro = await proFetch(`${proBase}/api/admin/collections/${colB.id}/mapping`, {
        method: 'POST',
        body: mapFdPro,
      });
      fail(mapPro.status === 200, 'PLAN=pro POST mapping succeeds');

      const ordFdPro = new FormData();
      ordFdPro.append('orders', new Blob([fs.readFileSync(ordersPath)]), 'orders.xlsx');
      const ordPro = await proFetch(`${proBase}/api/admin/collections/${colB.id}/orders`, {
        method: 'POST',
        body: ordFdPro,
      });
      fail(ordPro.status === 200, 'PLAN=pro POST orders succeeds');

      const visSelectedPro = await proFetch(`${proBase}/api/admin/collections/${colC.id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: 'selected', tags: ['smoke-vip'] }),
      });
      fail(visSelectedPro.status === 200, "PLAN=pro PATCH visibility to 'selected' succeeds");

      const visAllPro = await proFetch(`${proBase}/api/admin/collections/${colC.id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: 'all', tags: [] }),
      });
      fail(visAllPro.status === 200, "PLAN=pro PATCH visibility back to 'all' succeeds");

      // Restore restricted visibility for consistency with earlier assertions' data shape
      await proFetch(`${proBase}/api/admin/collections/${colC.id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: 'selected', tags: ['smoke-vip'] }),
      });

      await customerLogin('6912345678', c1.accessCode);
      const galPro = await fetch(`${proBase}/api/collections/${colB.id}`, {
        headers: { Cookie: sessionCookie },
      }).then((r) => r.json());
      fail(
        Array.isArray(galPro.images) && galPro.images.length === 1,
        'PLAN=pro with order_items filters correctly again'
      );
    });

    // --- Retention derived from PLAN ---
    withPlanConfig('basic', ({ config, retention }) => {
      fail(config.DEFAULT_RETENTION_MONTHS === 12, 'PLAN=basic effective retention is 12 months');
      fail(
        retention.getEffectiveRetention({ retention_months: null, retention_pinned: 0 }) === 12,
        'PLAN=basic getEffectiveRetention defaults to 12'
      );
    });

    const ancient = db.prepare(
      `INSERT INTO collections (name, status, published_at, retention_pinned, retention_months)
       VALUES ('Ancient Retention', 'published', datetime('now', '-10 years'), 0, NULL)`
    ).run();
    withPlanConfig('business', ({ config, retention }) => {
      fail(config.DEFAULT_RETENTION_MONTHS == null, 'PLAN=business default retention is null');
      const candidates = retention.findPurgeCandidates();
      fail(candidates.length === 0, 'PLAN=business returns no purge candidates');
      fail(
        !candidates.some((c) => c.id === ancient.lastInsertRowid),
        'PLAN=business ignores decade-old published collections'
      );
    });
    db.prepare('DELETE FROM collections WHERE id = ?').run(ancient.lastInsertRowid);

    // --- Admin login rate limit + cookie flags ---
    await withTempServer({ RATE_LIMIT_DISABLED: 'false' }, async (adminRlBase) => {
      const blockedIp = '198.51.100.50';
      const otherIp = '198.51.100.99';
      const loginHeaders = (ip) => ({
        'Content-Type': 'application/json',
        'X-Forwarded-For': ip,
      });

      let lastFailStatus = 0;
      for (let i = 0; i < 5; i += 1) {
        const failRes = await fetch(`${adminRlBase}/api/login`, {
          method: 'POST',
          headers: loginHeaders(blockedIp),
          body: JSON.stringify({ email: ADMIN_EMAIL, password: 'definitely-wrong-password' }),
        });
        lastFailStatus = failRes.status;
      }
      fail(lastFailStatus === 401, 'first 5 failed admin logins return 401');

      const sixth = await fetch(`${adminRlBase}/api/login`, {
        method: 'POST',
        headers: loginHeaders(blockedIp),
        body: JSON.stringify({ email: ADMIN_EMAIL, password: 'definitely-wrong-password' }),
      });
      const sixthBody = await sixth.json().catch(() => ({}));
      fail(sixth.status === 429, '6th failed admin login from same IP within 15 minutes returns 429');
      fail(
        typeof sixthBody.error === 'string' && /προσπάθειες|αργότερα/i.test(sixthBody.error),
        'admin login 429 returns generic Greek message'
      );

      const otherIpOk = await fetch(`${adminRlBase}/api/login`, {
        method: 'POST',
        headers: loginHeaders(otherIp),
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });
      fail(otherIpOk.status === 200, 'correct password still works from a different IP during the block');
    });

    await withTempServer({ NODE_ENV: 'production', RATE_LIMIT_DISABLED: 'true' }, async (prodBase) => {
      const loginRes = await fetch(`${prodBase}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });
      fail(loginRes.status === 200, 'admin login succeeds under NODE_ENV=production');
      const setCookies = loginRes.headers.getSetCookie
        ? loginRes.headers.getSetCookie()
        : [loginRes.headers.get('set-cookie')].filter(Boolean);
      const adminSetCookie = setCookies.find((c) => /^pd_admin=/i.test(c)) || '';
      fail(/HttpOnly/i.test(adminSetCookie), 'admin session cookie has httpOnly when NODE_ENV=production');
      fail(/Secure/i.test(adminSetCookie), 'admin session cookie has secure when NODE_ENV=production');
      fail(/SameSite=Strict/i.test(adminSetCookie), 'admin session cookie has sameSite=strict when NODE_ENV=production');
    });

    // Disable customer
    await adminFetch(`${BASE}/api/admin/customers/${c1.customer.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'disabled' }),
    });
    const disabledCheck = await customerFetch(`${BASE}/api/auth/me`);
    fail(disabledCheck.status === 401, 'disabled customer session returns 401');

    // No email customer gets code via paid channel attempt
    const noEmail = await createCustomer({ name: 'No Email', phone: '6972222222', sendCode: true });
    const messages = await adminFetch(`${BASE}/api/admin/messages`).then(r => r.json());
    const lastMsgs = messages.filter(m => m.customer_id === noEmail.customer.id);
    fail(lastMsgs.some(m => m.channel !== 'email'), 'customer without email uses non-email channel');

    // Reset uniform response (after main flows — reset invalidates codes)
    const resetReg = await fetch(`${BASE}/api/auth/reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '6971111111' }),
    });
    const resetUnreg = await fetch(`${BASE}/api/auth/reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '6999999999' }),
    });
    fail((await resetReg.text()) === (await resetUnreg.text()), 'reset returns identical body for registered/unregistered');

    // Rate limit — use c2 phone so c1 flow is unaffected
    const maxLoginFailures = Number(process.env.RATE_LIMIT_LOGIN_MAX_FAILURES) || 15;
    for (let i = 0; i < maxLoginFailures; i++) {
      await fetch(`${BASE}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '6987654321', code: 'BADCODE1' }),
      });
    }
    const limited = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '6987654321', code: 'BADCODE1' }),
    });
    fail(limited.status === 429, `${maxLoginFailures + 1}th failed login returns 429`);

    if (fails) {
      console.error(`\n${fails} test(s) failed.`);
      process.exitCode = 1;
    } else {
      console.log('\nAll smoke tests passed.');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
