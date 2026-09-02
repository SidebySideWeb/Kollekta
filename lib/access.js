// When a collection has no order data at all, order-based filtering is disabled
// entirely and every active customer gets full access. Product code mapping is
// an optional feature, never a prerequisite.

const db = require('../db');
const { customerHasVisibilityTag, parseTags } = require('./tags');

// Visibility is enforced in getCollectionContext — every image, download and zip
// route depends on it, so they inherit the same rule.

function customerCanSeeCollection(customerId, collection) {
  const visibility = collection.visibility || 'all';
  if (visibility === 'all') return true;
  if (visibility === 'selected') {
    const customer = db.prepare('SELECT tags FROM customers WHERE id = ?').get(customerId);
    if (!customer) return false;
    return customerHasVisibilityTag(customer.tags, collection.visibility_tags);
  }
  return false;
}

function getCustomerFromSession(sessionToken) {
  if (!sessionToken) return null;

  const row = db
    .prepare(
      `SELECT c.*, s.id AS session_id, s.expires_at AS session_expires_at
       FROM sessions s
       JOIN customers c ON c.id = s.customer_id
       WHERE s.token = ?`
    )
    .get(sessionToken);

  if (!row) return null;
  if (new Date(row.session_expires_at).getTime() <= Date.now()) return null;
  if (row.status !== 'active') return null;

  db.prepare('UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    row.session_id
  );

  return row;
}

// Visibility filtering applies here for the collection list UI.
function listVisibleCollections(customer) {
  const collections = db
    .prepare(
      `SELECT c.id, c.name, c.published_at, c.visibility,
              (SELECT COUNT(*) FROM images i WHERE i.collection_id = c.id) AS image_count,
              (SELECT i.thumb_path FROM images i WHERE i.collection_id = c.id ORDER BY i.id LIMIT 1) AS cover_thumb
       FROM collections c
       WHERE c.status = 'published'
       ORDER BY c.published_at DESC, c.id DESC`
    )
    .all();

  return collections.filter((collection) => customerCanSeeCollection(customer.id, collection));
}

function getCollectionContext(customer, collectionId) {
  const collection = db
    .prepare('SELECT * FROM collections WHERE id = ? AND status = ?')
    .get(collectionId, 'published');

  if (!collection) return null;
  if (!customerCanSeeCollection(customer.id, collection)) return null;

  const orderCount = db
    .prepare('SELECT COUNT(*) AS count FROM order_items WHERE collection_id = ?')
    .get(collectionId).count;

  const hasOrderData = orderCount > 0;

  const orderRows = db
    .prepare(
      `SELECT product_code FROM order_items
       WHERE collection_id = ? AND customer_id = ?`
    )
    .all(collectionId, customer.id);

  const orderedCodes = new Set(orderRows.map((row) => row.product_code));

  return {
    collection,
    customer,
    hasOrderData,
    orderedCodes,
  };
}

function getAudienceCustomers(collectionId) {
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId);
  if (!collection) return [];

  const customers = db.prepare("SELECT * FROM customers WHERE status = 'active'").all();
  return customers.filter((customer) => customerCanSeeCollection(customer.id, collection));
}

function getAudienceStats(collectionId) {
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId);
  const totalActiveCustomers = db
    .prepare("SELECT COUNT(*) AS count FROM customers WHERE status = 'active'")
    .get().count;

  if (!collection) {
    return { visibility: 'all', selectedTags: [], totalActiveCustomers, reachCount: 0 };
  }

  const selectedTags = parseTags(collection.visibility_tags);

  const reachCount = getAudienceCustomers(collectionId).length;

  return {
    visibility: collection.visibility || 'all',
    selectedTags,
    totalActiveCustomers,
    reachCount,
  };
}

function canView(ctx, image) {
  if (!ctx.hasOrderData) return true;

  const mode = ctx.customer.default_access_mode;
  if (mode === 'order_only') {
    return Boolean(image.product_code) && ctx.orderedCodes.has(image.product_code);
  }

  return true;
}

function canDownload(ctx, image) {
  if (!ctx.hasOrderData) return true;

  const mode = ctx.customer.default_access_mode;
  if (mode === 'full_access') return true;

  return Boolean(image.product_code) && ctx.orderedCodes.has(image.product_code);
}

module.exports = {
  getCustomerFromSession,
  listVisibleCollections,
  getCollectionContext,
  getAudienceCustomers,
  getAudienceStats,
  customerCanSeeCollection,
  canView,
  canDownload,
};
