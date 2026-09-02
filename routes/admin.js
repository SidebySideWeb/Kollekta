const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('../db');
const { processImage, deleteImageAssets } = require('../lib/imageProcessor');
const { uploadsDir } = require('../lib/storage');
const { parseImageMapping, parseCustomers, parseOrders } = require('../lib/excelParser');
const { normalizePhone, formatPhoneForDisplay } = require('../lib/phone');
const { generateAccessCode } = require('../lib/codes');
const { sendAuthMessage, sendAnnouncement } = require('../lib/messaging');
const { getAudienceCustomers, getAudienceStats } = require('../lib/access');
const { normalizeTags, parseTags, normalizeTagList, applyTagsUpdate } = require('../lib/tags');
const VALID_ACCESS_MODES = new Set(['order_only', 'browse_all_download_order', 'full_access']);
const {
  formatBytes,
  getCollectionStorage,
  getTotalStorage,
  getDiskUsage,
  getRecentSnapshots,
} = require('../lib/storage');
const { findPurgeCandidates, purgeCollection } = require('../lib/retention');
const {
  imageMappingSampleBuffer,
  imageMappingExportBuffer,
  ordersSampleBuffer,
  ordersExportBuffer,
  customersSampleBuffer,
  sendXlsx,
  safeFilename,
} = require('../lib/sampleExcel');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function collectionHasOrders(collectionId) {
  return (
    db.prepare('SELECT COUNT(*) AS count FROM order_items WHERE collection_id = ?').get(collectionId)
      .count > 0
  );
}

router.post('/collections', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Το όνομα της συλλογής είναι υποχρεωτικό.' });
  }
  const result = db.prepare("INSERT INTO collections (name, status) VALUES (?, 'draft')").run(name);
  res.json({ id: result.lastInsertRowid, name, status: 'draft' });
});

router.get('/collections', (_req, res) => {
  const collections = db
    .prepare(
      `SELECT c.id, c.name, c.status, c.published_at, c.created_at,
              (SELECT COUNT(*) FROM images i WHERE i.collection_id = c.id) AS image_count
       FROM collections c
       ORDER BY c.created_at DESC, c.id DESC`
    )
    .all();
  res.json(collections);
});

router.get('/collections/:id', (req, res) => {
  const id = Number(req.params.id);
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
  if (!collection) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }

  const images = db
    .prepare(
      `SELECT id, original_filename, product_code, thumb_path
       FROM images WHERE collection_id = ? ORDER BY id`
    )
    .all(id);

  res.json({
    ...collection,
    images,
    hasOrderData: collectionHasOrders(id),
  });
});

router.post('/collections/:id/images', upload.array('images', 500), async (req, res) => {
  const collectionId = Number(req.params.id);
  const collection = db.prepare('SELECT id FROM collections WHERE id = ?').get(collectionId);
  if (!collection) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }

  const files = req.files || [];
  const results = [];
  let uploaded = 0;

  const insertImage = db.prepare(
    `INSERT INTO images
      (collection_id, original_filename, product_code, full_path, web_path, thumb_path,
       full_bytes, web_bytes, thumb_bytes)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`
  );

  for (const file of files) {
    try {
      const paths = await processImage(file.buffer, collectionId, file.originalname);
      insertImage.run(
        collectionId,
        file.originalname,
        paths.fullPath,
        paths.webPath,
        paths.thumbPath,
        paths.fullBytes,
        paths.webBytes,
        paths.thumbBytes
      );
      uploaded += 1;
      results.push({ filename: file.originalname, ok: true });
    } catch (error) {
      results.push({ filename: file.originalname, ok: false, error: error.message });
    }
  }

  res.json({ uploaded, results });
});

router.get('/collections/:id/images/:imageId/:variant', (req, res) => {
  const collectionId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  const { variant } = req.params;

  if (variant !== 'thumb' && variant !== 'web') {
    return res.status(400).json({ error: 'Μη έγκυρη παραλλαγή εικόνας.' });
  }

  const image = db
    .prepare('SELECT * FROM images WHERE id = ? AND collection_id = ?')
    .get(imageId, collectionId);

  if (!image) {
    return res.status(404).json({ error: 'Η εικόνα δεν βρέθηκε.' });
  }

  const relPath = variant === 'thumb' ? image.thumb_path : image.web_path;
  const filePath = path.join(uploadsDir, relPath);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Το αρχείο εικόνας δεν βρέθηκε.' });
  }

  res.sendFile(filePath);
});

router.delete('/collections/:id/images/:imageId', (req, res) => {
  const collectionId = Number(req.params.id);
  const imageId = Number(req.params.imageId);

  const image = db
    .prepare('SELECT * FROM images WHERE id = ? AND collection_id = ?')
    .get(imageId, collectionId);

  if (!image) {
    return res.status(404).json({ error: 'Η εικόνα δεν βρέθηκε.' });
  }

  deleteImageAssets(image);
  db.prepare('DELETE FROM images WHERE id = ?').run(imageId);

  res.json({ ok: true, deletedId: imageId });
});

router.post('/collections/:id/images/bulk-delete', (req, res) => {
  const collectionId = Number(req.params.id);
  const collection = db.prepare('SELECT id FROM collections WHERE id = ?').get(collectionId);
  if (!collection) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }

  const imageIds = Array.isArray(req.body.imageIds)
    ? [...new Set(req.body.imageIds.map(Number).filter((id) => id > 0))]
    : [];
  if (!imageIds.length) {
    return res.status(400).json({ error: 'Δεν επιλέχθηκαν εικόνες.' });
  }

  const findImage = db.prepare('SELECT * FROM images WHERE id = ? AND collection_id = ?');
  const deleteImage = db.prepare('DELETE FROM images WHERE id = ? AND collection_id = ?');
  let deleted = 0;

  for (const imageId of imageIds) {
    const image = findImage.get(imageId, collectionId);
    if (!image) continue;
    deleteImageAssets(image);
    deleteImage.run(imageId, collectionId);
    deleted += 1;
  }

  res.json({ deleted, requested: imageIds.length });
});

router.post('/collections/:id/mapping', upload.single('mapping'), (req, res) => {
  const collectionId = Number(req.params.id);
  const collection = db.prepare('SELECT id FROM collections WHERE id = ?').get(collectionId);
  if (!collection) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Δεν επιλέχθηκε αρχείο αντιστοίχισης.' });
  }

  const rows = parseImageMapping(req.file.buffer);
  const updateStmt = db.prepare(
    `UPDATE images SET product_code = ?
     WHERE collection_id = ? AND original_filename = ?`
  );

  const matched = [];
  const unmatched = [];

  for (const row of rows) {
    const result = updateStmt.run(row.productCode, collectionId, row.filename);
    if (result.changes > 0) matched.push(row);
    else unmatched.push(row);
  }

  res.json({
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    matched,
    unmatched,
  });
});

router.get('/samples/image-mapping', (_req, res) => {
  sendXlsx(res, 'kollekta-image-mapping-sample.xlsx', imageMappingSampleBuffer());
});

router.get('/samples/orders', (_req, res) => {
  sendXlsx(res, 'kollekta-orders-sample.xlsx', ordersSampleBuffer());
});

router.get('/samples/customers', (_req, res) => {
  sendXlsx(res, 'kollekta-customers-sample.xlsx', customersSampleBuffer());
});

router.get('/collections/:id/export/image-mapping', (req, res) => {
  const collectionId = Number(req.params.id);
  const collection = db.prepare('SELECT id, name FROM collections WHERE id = ?').get(collectionId);
  if (!collection) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }

  const images = db
    .prepare(
      `SELECT original_filename, product_code
       FROM images WHERE collection_id = ? ORDER BY id`
    )
    .all(collectionId);

  const filename = `${safeFilename(collection.name, 'collection')}-images.xlsx`;
  sendXlsx(res, filename, imageMappingExportBuffer(images));
});

router.get('/collections/:id/export/orders', (req, res) => {
  const collectionId = Number(req.params.id);
  const collection = db.prepare('SELECT id, name FROM collections WHERE id = ?').get(collectionId);
  if (!collection) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }

  const rows = db
    .prepare(
      `SELECT c.erp_code, c.email, c.phone, oi.product_code
       FROM order_items oi
       JOIN customers c ON c.id = oi.customer_id
       WHERE oi.collection_id = ?
       ORDER BY c.id, oi.id`
    )
    .all(collectionId);

  const filename = `${safeFilename(collection.name, 'collection')}-orders.xlsx`;
  sendXlsx(res, filename, ordersExportBuffer(rows));
});

router.post('/collections/:id/orders', upload.single('orders'), (req, res) => {
  const collectionId = Number(req.params.id);
  const collection = db.prepare('SELECT id FROM collections WHERE id = ?').get(collectionId);
  if (!collection) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Δεν επιλέχθηκε αρχείο παραγγελιών.' });
  }

  const rows = parseOrders(req.file.buffer);
  const findCustomer = db.prepare(
    `SELECT id FROM customers
     WHERE erp_code = ? OR email = ? OR phone = ?
     LIMIT 1`
  );
  const insertOrder = db.prepare(
    `INSERT INTO order_items (collection_id, customer_id, product_code)
     VALUES (?, ?, ?)`
  );

  let inserted = 0;
  const unresolved = [];

  for (const row of rows) {
    const normalizedPhone = normalizePhone(row.identifier);
    const customer = findCustomer.get(
      row.identifier,
      row.identifier,
      normalizedPhone || row.identifier
    );
    if (!customer) {
      unresolved.push(row);
      continue;
    }
    insertOrder.run(collectionId, customer.id, row.productCode);
    inserted += 1;
  }

  res.json({ inserted, unresolvedCount: unresolved.length, unresolved });
});

router.post('/collections/:id/publish', async (req, res) => {
  const collectionId = Number(req.params.id);
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId);
  if (!collection) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }

  const notify = Boolean(req.body.notify);
  db.prepare(
    "UPDATE collections SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(collectionId);

  let notified = 0;
  let skipped = 0;
  let failed = 0;

  if (notify) {
    const customers = getAudienceCustomers(collectionId);
    const cover = db
      .prepare('SELECT thumb_path FROM images WHERE collection_id = ? ORDER BY id LIMIT 1')
      .get(collectionId);

    for (const customer of customers) {
      const result = await sendAnnouncement(customer, {
        collectionName: collection.name,
        coverImageUrl: cover ? `/uploads/${cover.thumb_path}` : null,
      });
      if (result.skipped) skipped += 1;
      else if (result.ok) notified += 1;
      else failed += 1;
    }
  }

  const audience = getAudienceStats(collectionId);
  res.json({ notified, skipped, failed, reachCount: audience.reachCount });
});

router.post('/collections/:id/unpublish', (req, res) => {
  const collectionId = Number(req.params.id);
  const result = db
    .prepare("UPDATE collections SET status = 'draft', published_at = NULL WHERE id = ?")
    .run(collectionId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }
  res.json({ ok: true, status: 'draft' });
});

router.get('/customers', (_req, res) => {
  const customers = db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM sessions s WHERE s.customer_id = c.id AND datetime(s.expires_at) > datetime('now')) AS active_sessions,
              (SELECT MAX(s.last_seen_at) FROM sessions s WHERE s.customer_id = c.id) AS last_login
       FROM customers c
       ORDER BY c.id DESC`
    )
    .all()
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: formatPhoneForDisplay(customer.phone),
      phoneRaw: customer.phone,
      email: customer.email,
      email_status: customer.email_status,
      erp_code: customer.erp_code,
      status: customer.status,
      default_access_mode: customer.default_access_mode,
      preferred_channel: customer.preferred_channel,
      last_auth_channel: customer.last_auth_channel,
      notify_by_email: customer.notify_by_email,
      tags: customer.tags,
      code_updated_at: customer.code_updated_at,
      active_sessions: customer.active_sessions,
      last_login: customer.last_login,
      has_logged_in: Boolean(customer.last_login),
    }));

  res.json(customers);
});

router.post('/customers', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = normalizePhone(req.body.phone);
  const email = String(req.body.email || '').trim() || null;
  const erpCode = String(req.body.erpCode || '').trim() || null;
  const defaultAccessMode = VALID_ACCESS_MODES.has(req.body.defaultAccessMode)
    ? req.body.defaultAccessMode
    : 'full_access';
  const preferredChannel = req.body.preferredChannel || 'auto';
  const sendCode = Boolean(req.body.sendCode);

  if (!name) {
    return res.status(400).json({ error: 'Το όνομα είναι υποχρεωτικό.' });
  }
  if (!phone) {
    return res.status(400).json({ error: 'Μη έγκυρος αριθμός κινητού.' });
  }

  const existing = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone);
  if (existing) {
    return res.status(400).json({ error: 'Ο αριθμός είναι ήδη καταχωρημένος.' });
  }

  const accessCode = generateAccessCode();
  const result = db
    .prepare(
      `INSERT INTO customers
        (phone, email, name, erp_code, access_code, default_access_mode, preferred_channel)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(phone, email, name, erpCode, accessCode, defaultAccessMode, preferredChannel);

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  let sendResult = null;
  if (sendCode) {
    sendResult = await sendAuthMessage(customer, 'welcome', { code: accessCode });
  }

  res.json({
    customer: {
      ...customer,
      phone: formatPhoneForDisplay(customer.phone),
    },
    accessCode,
    sendResult,
  });
});

router.post('/customers/upload', upload.single('customers'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Δεν επιλέχθηκε αρχείο πελατών.' });
  }

  const sendCodes = req.body.sendCodes === 'true' || req.body.sendCodes === true;
  const { rows, errors } = parseCustomers(req.file.buffer);
  const insert = db.prepare(
    `INSERT INTO customers
      (phone, email, name, erp_code, access_code, default_access_mode, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  let created = 0;
  let skipped = 0;
  const createdCustomers = [];

  for (const row of rows) {
    const phone = normalizePhone(row.phone);
    if (!phone) {
      errors.push({ rowIndex: row.rowIndex, reason: 'Μη έγκυρο τηλέφωνο.' });
      continue;
    }

    const existing = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone);
    if (existing) {
      skipped += 1;
      errors.push({ rowIndex: row.rowIndex, reason: 'Διπλότυπο τηλέφωνο.' });
      continue;
    }

    const accessCode = generateAccessCode();
    const result = insert.run(
      phone,
      row.email || null,
      row.name || null,
      row.erpCode || null,
      accessCode,
      row.accessMode,
      normalizeTags(row.tags)
    );
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    created += 1;
    createdCustomers.push({ customer, accessCode });
  }

  if (sendCodes) {
    for (const item of createdCustomers) {
      await sendAuthMessage(item.customer, 'welcome', { code: item.accessCode });
    }
  }

  res.json({ created, skipped, errors });
});

function deleteCustomerById(id) {
  db.prepare('DELETE FROM sessions WHERE customer_id = ?').run(id);
  db.prepare('DELETE FROM order_items WHERE customer_id = ?').run(id);
  return db.prepare('DELETE FROM customers WHERE id = ?').run(id).changes > 0;
}

router.post('/customers/bulk', async (req, res) => {
  const ids = Array.isArray(req.body.ids)
    ? [...new Set(req.body.ids.map(Number).filter((id) => id > 0))]
    : [];
  const action = req.body.action;

  if (ids.length === 0) {
    return res.status(400).json({ error: 'Επίλεξε τουλάχιστον έναν πελάτη.' });
  }

  const result = { processed: 0, failed: 0, sent: 0, skipped: 0 };

  if (action === 'delete') {
    const apply = db.transaction(() => {
      for (const id of ids) {
        if (deleteCustomerById(id)) result.processed += 1;
        else result.failed += 1;
      }
    });
    apply();
    return res.json(result);
  }

  if (action === 'disable') {
    const disable = db.prepare("UPDATE customers SET status = 'disabled' WHERE id = ?");
    const clearSessions = db.prepare('DELETE FROM sessions WHERE customer_id = ?');
    for (const id of ids) {
      const changes = disable.run(id).changes;
      if (changes > 0) {
        clearSessions.run(id);
        result.processed += 1;
      } else {
        result.failed += 1;
      }
    }
    return res.json(result);
  }

  if (action === 'resend-code') {
    for (const id of ids) {
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      if (!customer) {
        result.failed += 1;
        continue;
      }
      const sendResult = await sendAuthMessage(customer, 'resend', { code: customer.access_code });
      result.processed += 1;
      if (sendResult.skipped) result.skipped += 1;
      else if (sendResult.ok) result.sent += 1;
      else result.failed += 1;
    }
    return res.json(result);
  }

  if (action === 'tags') {
    const mode = ['set', 'add', 'remove'].includes(req.body.mode) ? req.body.mode : 'set';
    if (req.body.tags === undefined || req.body.tags === null || req.body.tags === '') {
      if (mode !== 'remove') {
        return res.status(400).json({ error: 'Δώσε tags για ενημέρωση.' });
      }
    }

    const update = db.prepare('UPDATE customers SET tags = ? WHERE id = ?');
    for (const id of ids) {
      const customer = db.prepare('SELECT id, tags FROM customers WHERE id = ?').get(id);
      if (!customer) {
        result.failed += 1;
        continue;
      }
      const newTags = applyTagsUpdate(customer.tags, req.body.tags, mode);
      update.run(newTags, id);
      result.processed += 1;
    }
    return res.json(result);
  }

  return res.status(400).json({ error: 'Μη έγκυρη μαζική ενέργεια.' });
});

router.patch('/customers/:id', (req, res) => {
  const id = Number(req.params.id);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return res.status(404).json({ error: 'Ο πελάτης δεν βρέθηκε.' });
  }

  const fields = [];
  const values = [];

  if (req.body.name !== undefined) {
    fields.push('name = ?');
    values.push(String(req.body.name).trim());
  }
  if (req.body.email !== undefined) {
    fields.push('email = ?');
    values.push(String(req.body.email).trim() || null);
  }
  if (req.body.erp_code !== undefined) {
    fields.push('erp_code = ?');
    values.push(String(req.body.erp_code).trim() || null);
  }
  if (req.body.default_access_mode !== undefined) {
    const mode = String(req.body.default_access_mode);
    if (!VALID_ACCESS_MODES.has(mode)) {
      return res.status(400).json({ error: 'Μη έγκυρος τρόπος πρόσβασης.' });
    }
    fields.push('default_access_mode = ?');
    values.push(mode);
  }
  if (req.body.preferred_channel !== undefined) {
    fields.push('preferred_channel = ?');
    values.push(req.body.preferred_channel);
  }
  if (req.body.notify_by_email !== undefined) {
    fields.push('notify_by_email = ?');
    values.push(req.body.notify_by_email ? 1 : 0);
  }
  if (req.body.status !== undefined) {
    fields.push('status = ?');
    values.push(req.body.status);
  }
  if (req.body.tags !== undefined) {
    fields.push('tags = ?');
    values.push(normalizeTags(req.body.tags));
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'Δεν δόθηκαν πεδία για ενημέρωση.' });
  }

  values.push(id);
  db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  if (req.body.status === 'disabled') {
    db.prepare('DELETE FROM sessions WHERE customer_id = ?').run(id);
  }

  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  res.json({
    ...updated,
    phone: formatPhoneForDisplay(updated.phone),
  });
});

router.post('/customers/:id/resend-code', async (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(req.params.id));
  if (!customer) {
    return res.status(404).json({ error: 'Ο πελάτης δεν βρέθηκε.' });
  }
  const result = await sendAuthMessage(customer, 'resend', { code: customer.access_code });
  res.json(result);
});

router.post('/customers/:id/reset-code', async (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(req.params.id));
  if (!customer) {
    return res.status(404).json({ error: 'Ο πελάτης δεν βρέθηκε.' });
  }

  const newCode = generateAccessCode();
  db.prepare(
    `UPDATE customers SET access_code = ?, code_updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(newCode, customer.id);
  db.prepare('DELETE FROM sessions WHERE customer_id = ?').run(customer.id);

  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id);
  const result = await sendAuthMessage(updated, 'reset', { code: newCode });
  res.json({ ...result, accessCode: newCode });
});

router.delete('/customers/:id', (req, res) => {
  const id = Number(req.params.id);
  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return res.status(404).json({ error: 'Ο πελάτης δεν βρέθηκε.' });
  }

  deleteCustomerById(id);
  res.json({ ok: true });
});

router.get('/customers/:id/activity', (req, res) => {
  const id = Number(req.params.id);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return res.status(404).json({ error: 'Ο πελάτης δεν βρέθηκε.' });
  }

  const activeSessions = db
    .prepare(
      `SELECT COUNT(*) AS count FROM sessions
       WHERE customer_id = ? AND datetime(expires_at) > datetime('now')`
    )
    .get(id).count;

  const lastLogin = db
    .prepare('SELECT MAX(last_seen_at) AS last_login FROM sessions WHERE customer_id = ?')
    .get(id).last_login;

  const downloads = db
    .prepare(
      `SELECT dl.downloaded_at, i.original_filename, c.name AS collection_name
       FROM download_log dl
       JOIN images i ON i.id = dl.image_id
       JOIN collections c ON c.id = i.collection_id
       WHERE dl.customer_id = ?
       ORDER BY dl.downloaded_at DESC
       LIMIT 50`
    )
    .all(id);

  res.json({ lastLogin, activeSessions, downloads });
});

router.get('/messages', (_req, res) => {
  const messages = db
    .prepare(
      `SELECT ml.*, c.name AS customer_name
       FROM message_log ml
       LEFT JOIN customers c ON c.id = ml.customer_id
       ORDER BY ml.created_at DESC
       LIMIT 200`
    )
    .all();
  res.json(messages);
});

router.patch('/collections/:id/visibility', (req, res) => {
  const collectionId = Number(req.params.id);
  const visibility = req.body.visibility === 'selected' ? 'selected' : 'all';
  const tags = Array.isArray(req.body.tags) ? req.body.tags : [];

  const collection = db.prepare('SELECT id FROM collections WHERE id = ?').get(collectionId);
  if (!collection) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }

  if (visibility === 'selected' && tags.length === 0) {
    return res.status(400).json({ error: 'Επίλεξε τουλάχιστον ένα tag για περιορισμένη ορατότητα.' });
  }

  const visibilityTags = visibility === 'selected' ? normalizeTagList(tags) : null;
  db.prepare('UPDATE collections SET visibility = ?, visibility_tags = ? WHERE id = ?').run(
    visibility,
    visibilityTags,
    collectionId
  );

  res.json(getAudienceStats(collectionId));
});

router.get('/collections/:id/audience', (req, res) => {
  const collectionId = Number(req.params.id);
  const collection = db.prepare('SELECT id FROM collections WHERE id = ?').get(collectionId);
  if (!collection) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }
  res.json(getAudienceStats(collectionId));
});

router.get('/customers/tags', (_req, res) => {
  const customers = db.prepare("SELECT tags FROM customers WHERE tags IS NOT NULL AND tags != ''").all();
  const counts = {};
  for (const row of customers) {
    for (const tag of parseTags(row.tags)) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  res.json(
    Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag))
  );
});

router.get('/storage', (_req, res) => {
  const total = getTotalStorage();
  const disk = getDiskUsage();
  const snapshots = getRecentSnapshots(30);
  res.json({ total, disk, snapshots });
});

router.get('/storage/candidates', (_req, res) => {
  const candidates = findPurgeCandidates();
  const totalReclaimable = candidates.reduce((sum, c) => sum + (c.reclaimableBytes || 0), 0);
  res.json({ candidates, totalReclaimable });
});

router.post('/collections/:id/purge-full', (req, res) => {
  const collectionId = Number(req.params.id);
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId);
  if (!collection) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }
  if (collection.status !== 'published') {
    return res.status(400).json({ error: 'Μόνο δημοσιευμένες συλλογές μπορούν να αρχειοθετηθούν.' });
  }
  const dryRun = Boolean(req.body.dryRun);
  const result = purgeCollection(collectionId, { dryRun });
  res.json(result);
});

router.patch('/collections/:id/retention', (req, res) => {
  const collectionId = Number(req.params.id);
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId);
  if (!collection) {
    return res.status(404).json({ error: 'Η συλλογή δεν βρέθηκε.' });
  }

  const retentionMonths =
    req.body.retentionMonths === null || req.body.retentionMonths === ''
      ? null
      : Number(req.body.retentionMonths);
  const pinned = req.body.pinned !== undefined ? (req.body.pinned ? 1 : 0) : collection.retention_pinned;

  db.prepare(
    'UPDATE collections SET retention_months = ?, retention_pinned = ? WHERE id = ?'
  ).run(retentionMonths, pinned, collectionId);

  const updated = db.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId);
  res.json({
    ...updated,
    storage: getCollectionStorage(collectionId),
  });
});

module.exports = router;
