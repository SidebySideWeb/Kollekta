const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const archiver = require('archiver');

const db = require('../db');
const config = require('../config');
const {
  getCustomerFromSession,
  listVisibleCollections,
  getCollectionContext,
  canView,
  canDownload,
} = require('../lib/access');
const { normalizePhone, maskPhone } = require('../lib/phone');
const { compareCode, generateSessionToken } = require('../lib/codes');
const { sendAuthMessage } = require('../lib/messaging');
const { recordAttempt, checkLoginAllowed, checkResetAllowed } = require('../lib/rateLimit');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', 'uploads');
const SESSION_COOKIE = 'pd_session';
const SESSION_DAYS = 30;

// Deliberate uniform response on reset — prevents enumeration of the customer list.
const RESET_OK_RESPONSE = {
  ok: true,
  message: 'Αν ο αριθμός είναι καταχωρημένος, θα λάβεις νέο κωδικό.',
};

function parseDownloadSize(value, defaultSize = 'full') {
  if (value === undefined || value === null || value === '') return defaultSize;
  if (value === 'web' || value === 'full') return value;
  return null;
}

function resolveDownloadBySize(image, size) {
  const webFile = path.join(uploadsDir, image.web_path);
  const fullFile = path.join(uploadsDir, image.full_path);
  const base = path.basename(image.original_filename, path.extname(image.original_filename));

  if (size === 'web') {
    if (!fs.existsSync(webFile)) return null;
    return {
      filePath: webFile,
      filename: `${base}-web.jpg`,
      isWebFallback: false,
      loggedVariant: 'web',
    };
  }

  if (!image.full_purged && fs.existsSync(fullFile)) {
    return {
      filePath: fullFile,
      filename: image.original_filename,
      isWebFallback: false,
      loggedVariant: 'full',
    };
  }

  if (fs.existsSync(webFile)) {
    return {
      filePath: webFile,
      filename: `${base}-web.jpg`,
      isWebFallback: true,
      loggedVariant: 'full',
    };
  }

  return null;
}

function getSessionToken(req) {
  return req.signedCookies?.[SESSION_COOKIE] || null;
}

function requireCustomer(req, res, next) {
  const customer = getCustomerFromSession(getSessionToken(req));
  if (!customer) {
    return res.status(401).json({ error: 'Απαιτείται σύνδεση.', requiresLogin: true });
  }
  req.customer = customer;
  return next();
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

router.post('/auth/login', (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const code = req.body.code;
  const ip = req.ip;

  if (!phone) {
    return res.status(400).json({ error: 'Μη έγκυρος αριθμός κινητού.' });
  }

  const limit = checkLoginAllowed(phone, ip);
  if (!limit.allowed) {
    return res.status(429).json({
      error: 'Πολλές προσπάθειες. Δοκίμασε ξανά αργότερα.',
    });
  }

  const customer = db
    .prepare("SELECT * FROM customers WHERE phone = ? AND status = 'active'")
    .get(phone);

  const valid = customer && compareCode(code, customer.access_code);

  if (!valid) {
    recordAttempt({ phone, ip, kind: 'login', success: false });
    return res.status(401).json({ error: 'Λάθος αριθμός ή κωδικός.' });
  }

  recordAttempt({ phone, ip, kind: 'login', success: true });

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO sessions (token, customer_id, expires_at, user_agent)
     VALUES (?, ?, ?, ?)`
  ).run(token, customer.id, expiresAt, req.get('user-agent') || null);

  setSessionCookie(res, token);
  res.json({ ok: true });
});

router.post('/auth/reset', async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const ip = req.ip;

  if (!phone) {
    return res.json(RESET_OK_RESPONSE);
  }

  const limit = checkResetAllowed(phone, ip);
  if (!limit.allowed) {
    return res.json(RESET_OK_RESPONSE);
  }

  recordAttempt({ phone, ip, kind: 'reset', success: true });

  const customer = db
    .prepare("SELECT * FROM customers WHERE phone = ? AND status = 'active'")
    .get(phone);

  if (customer) {
    const { generateAccessCode } = require('../lib/codes');
    const newCode = generateAccessCode();
    db.prepare(
      `UPDATE customers SET access_code = ?, code_updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(newCode, customer.id);
    db.prepare('DELETE FROM sessions WHERE customer_id = ?').run(customer.id);
    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id);
    await sendAuthMessage(updated, 'reset', { code: newCode });
  }

  res.json(RESET_OK_RESPONSE);
});

router.post('/auth/logout', (req, res) => {
  const token = getSessionToken(req);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.post('/auth/reset-own', requireCustomer, async (req, res) => {
  const customer = req.customer;
  const { generateAccessCode } = require('../lib/codes');
  const newCode = generateAccessCode();
  db.prepare(
    `UPDATE customers SET access_code = ?, code_updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(newCode, customer.id);
  db.prepare('DELETE FROM sessions WHERE customer_id = ?').run(customer.id);

  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id);
  const sendResult = await sendAuthMessage(updated, 'reset', { code: newCode });

  clearSessionCookie(res);
  res.json({
    ok: true,
    message: 'Στάλθηκε νέος κωδικός. Συνδέσου ξανά με τον νέο κωδικό.',
    sent: Boolean(sendResult?.ok),
  });
});

router.get('/auth/me', requireCustomer, (req, res) => {
  res.json({
    name: req.customer.name,
    phone: maskPhone(req.customer.phone),
  });
});

router.get('/collections', requireCustomer, (req, res) => {
  const collections = listVisibleCollections(req.customer).map((collection) => {
    const firstImage = db
      .prepare('SELECT id FROM images WHERE collection_id = ? ORDER BY id LIMIT 1')
      .get(collection.id);
    return {
      id: collection.id,
      name: collection.name,
      publishedAt: collection.published_at,
      imageCount: collection.image_count,
      coverThumbUrl: firstImage
        ? `/api/collections/${collection.id}/image/${firstImage.id}/thumb`
        : null,
    };
  });

  res.json(collections);
});

router.get('/collections/:id', requireCustomer, (req, res) => {
  const collectionId = Number(req.params.id);
  const ctx = getCollectionContext(req.customer, collectionId);
  if (!ctx) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }

  const images = db
    .prepare('SELECT * FROM images WHERE collection_id = ? ORDER BY id')
    .all(collectionId)
    .filter((image) => canView(ctx, image))
    .map((image) => ({
      id: image.id,
      productCode: image.product_code,
      thumbUrl: `/api/collections/${collectionId}/image/${image.id}/thumb`,
      webUrl: `/api/collections/${collectionId}/image/${image.id}/web`,
      downloadable: canDownload(ctx, image),
      webBytes: image.web_bytes || 0,
      fullBytes: image.full_bytes || 0,
      fullAvailable: !image.full_purged,
    }));

  const allCollectionImages = db
    .prepare('SELECT full_purged FROM images WHERE collection_id = ?')
    .all(collectionId);
  const fullAvailable =
    allCollectionImages.length > 0 && allCollectionImages.some((image) => !image.full_purged);
  const hasPurgedImages = images.some((image) => !image.fullAvailable);

  res.json({
    collectionName: ctx.collection.name,
    accessMode: ctx.customer.default_access_mode,
    hasOrderData: ctx.hasOrderData,
    fullAvailable,
    hasPurgedImages,
    images,
  });
});

router.get('/collections/:id/image/:imageId/:variant', requireCustomer, (req, res) => {
  const collectionId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  const { variant } = req.params;

  if (variant !== 'thumb' && variant !== 'web') {
    return res.status(400).json({ error: 'Μη έγκυρη παραλλαγή εικόνας.' });
  }

  const ctx = getCollectionContext(req.customer, collectionId);
  if (!ctx) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }

  const image = db
    .prepare('SELECT * FROM images WHERE id = ? AND collection_id = ?')
    .get(imageId, collectionId);

  if (!image) {
    return res.status(404).json({ error: 'Η εικόνα δεν βρέθηκε.' });
  }

  if (!canView(ctx, image)) {
    return res.status(403).json({ error: 'Δεν έχετε πρόσβαση σε αυτή την εικόνα.' });
  }

  const relPath = variant === 'thumb' ? image.thumb_path : image.web_path;
  let filePath = path.join(uploadsDir, relPath);
  if (!fs.existsSync(filePath) && variant === 'thumb' && image.web_path) {
    filePath = path.join(uploadsDir, image.web_path);
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Το αρχείο εικόνας δεν βρέθηκε.' });
  }

  res.sendFile(filePath);
});

router.get('/collections/:id/download/:imageId', requireCustomer, (req, res) => {
  const collectionId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  const size = parseDownloadSize(req.query.size);
  if (!size) {
    return res.status(400).json({ error: 'Μη έγκυρο μέγεθος λήψης.' });
  }

  const ctx = getCollectionContext(req.customer, collectionId);

  if (!ctx) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }

  const image = db
    .prepare('SELECT * FROM images WHERE id = ? AND collection_id = ?')
    .get(imageId, collectionId);

  if (!image) {
    return res.status(404).json({ error: 'Η εικόνα δεν βρέθηκε.' });
  }

  if (!canDownload(ctx, image)) {
    return res.status(403).json({ error: 'Δεν επιτρέπεται η λήψη αυτής της εικόνας.' });
  }

  const resolved = resolveDownloadBySize(image, size);
  if (!resolved) {
    return res.status(404).json({ error: 'Το αρχείο εικόνας δεν βρέθηκε.' });
  }

  db.prepare('INSERT INTO download_log (customer_id, image_id, variant) VALUES (?, ?, ?)').run(
    req.customer.id,
    image.id,
    resolved.loggedVariant
  );

  res.download(resolved.filePath, resolved.filename);
});

router.post('/collections/:id/download-zip', requireCustomer, (req, res) => {
  const collectionId = Number(req.params.id);
  const imageIds = Array.isArray(req.body.imageIds) ? req.body.imageIds.map(Number) : [];
  const size = parseDownloadSize(req.body.size);
  if (!size) {
    return res.status(400).json({ error: 'Μη έγκυρο μέγεθος λήψης.' });
  }
  const ctx = getCollectionContext(req.customer, collectionId);

  if (!ctx) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }

  const downloadableImages = imageIds
    .map((id) =>
      db.prepare('SELECT * FROM images WHERE id = ? AND collection_id = ?').get(id, collectionId)
    )
    .filter((image) => image && canDownload(ctx, image));

  if (downloadableImages.length === 0) {
    return res.status(403).json({ error: 'Δεν επιτρέπεται η λήψη των επιλεγμένων εικόνων.' });
  }

  const zipName = `${ctx.collection.name.replace(/[^\w.-]+/g, '_') || 'collection'}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.attachment(zipName);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (error) => {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Σφάλμα κατά τη δημιουργία του zip.' });
    } else {
      res.end();
    }
  });

  archive.pipe(res);

  const logDownload = db.prepare(
    'INSERT INTO download_log (customer_id, image_id, variant) VALUES (?, ?, ?)'
  );

  let hasWebFallback = false;

  for (const image of downloadableImages) {
    const resolved = resolveDownloadBySize(image, size);
    if (!resolved) continue;
    if (resolved.isWebFallback) hasWebFallback = true;
    archive.file(resolved.filePath, { name: resolved.filename });
    logDownload.run(req.customer.id, image.id, resolved.loggedVariant);
  }

  if (hasWebFallback && size === 'full') {
    archive.append(
      'Αυτή η συλλογή έχει αρχειοθετηθεί. Οι εικόνες είναι σε ανάλυση web.\n',
      { name: 'README.txt' }
    );
  }

  archive.finalize();
});

router.get('/unsubscribe/:token', (req, res) => {
  const customers = db.prepare('SELECT id FROM customers').all();
  let matchedId = null;

  for (const customer of customers) {
    const expected = crypto
      .createHmac('sha256', config.SESSION_COOKIE_SECRET)
      .update(String(customer.id))
      .digest('hex');
    if (expected === req.params.token) {
      matchedId = customer.id;
      break;
    }
  }

  if (matchedId) {
    db.prepare('UPDATE customers SET notify_by_email = 0 WHERE id = ?').run(matchedId);
  }

  res.send(`<!DOCTYPE html><html lang="el"><head><meta charset="UTF-8"><title>Απεγγραφή</title>
    <style>body{font-family:sans-serif;max-width:480px;margin:48px auto;padding:24px;color:#222;}</style>
    </head><body><h1>Απεγγραφή ολοκληρώθηκε</h1>
    <p>Δεν θα λαμβάνεις πλέον ειδοποιήσεις email για νέες συλλογές.</p></body></html>`);
});

module.exports = router;
module.exports.requireCustomer = requireCustomer;
