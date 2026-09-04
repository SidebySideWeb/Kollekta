const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const XLSX = require('xlsx');

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test123';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@localhost';
let adminCookie = '';
let sessionCookie = '';

function assert(cond, msg) {
  if (cond) { console.log(`PASS: ${msg}`); return true; }
  console.error(`FAIL: ${msg}`);
  return false;
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
    fail(createdAdmin.status === 201, 'can create a second admin');
    const createdAdminBody = await createdAdmin.json();
    fail(createdAdminBody.email === secondAdminEmail, 'created admin returns email');

    await adminFetch(`${BASE}/api/logout`, { method: 'POST' });
    adminCookie = '';
    await adminLogin(secondAdminEmail, 'secondpass123');
    fail(Boolean(adminCookie), 'second admin can log in');

    const deleteSelf = await adminFetch(`${BASE}/api/admin/admins/${createdAdminBody.id}`, { method: 'DELETE' });
    fail(deleteSelf.status === 400, 'admin cannot delete own account');

    await adminFetch(`${BASE}/api/logout`, { method: 'POST' });
    adminCookie = '';
    await adminLogin();
    const deleted = await adminFetch(`${BASE}/api/admin/admins/${createdAdminBody.id}`, { method: 'DELETE' });
    fail(deleted.ok, 'primary admin can delete second admin');

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
