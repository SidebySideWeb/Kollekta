const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { uploadsDir } = require('./storage');

function getEffectiveRetention(collection) {
  // Downgrade safety: on Basic, ignore per-collection override and pin.
  if (config.FEATURE_RETENTION_OVERRIDE) {
    if (collection.retention_pinned) return null;
    if (collection.retention_months != null) return collection.retention_months;
  }
  return config.DEFAULT_RETENTION_MONTHS;
}

function monthsSince(dateString) {
  if (!dateString) return 0;
  const then = new Date(dateString);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

function getPurgeDeadline(collection) {
  if (!collection || collection.full_purged_at || !collection.published_at) return null;
  const months = getEffectiveRetention(collection);
  if (months == null) return null;
  const deadline = new Date(collection.published_at);
  if (Number.isNaN(deadline.getTime())) return null;
  deadline.setMonth(deadline.getMonth() + months);
  return deadline;
}

function getRetentionSummary(collection) {
  const effectiveRetentionMonths = getEffectiveRetention(collection);
  const deadline = getPurgeDeadline(collection);
  const purgeAt = deadline ? deadline.toISOString() : null;

  let purgeWarning = null;
  if (deadline) {
    const msUntil = deadline.getTime() - Date.now();
    const daysUntil = Math.ceil(msUntil / (24 * 60 * 60 * 1000));
    if (daysUntil <= 30) {
      purgeWarning = { purgeAt, daysUntil };
    }
  }

  return { effectiveRetentionMonths, purgeAt, purgeWarning };
}

function findPurgeCandidates() {
  const collections = db
    .prepare(
      `SELECT c.*,
              COALESCE(SUM(i.full_bytes), 0) AS reclaimableBytes
       FROM collections c
       LEFT JOIN images i ON i.collection_id = c.id AND i.full_purged = 0
       WHERE c.status = 'published'
         AND c.full_purged_at IS NULL
         AND c.published_at IS NOT NULL
       GROUP BY c.id`
    )
    .all();

  return collections
    .map((collection) => {
      // When override is off, pinned rows are ignored by getEffectiveRetention.
      if (config.FEATURE_RETENTION_OVERRIDE && collection.retention_pinned) {
        return null;
      }
      const retentionMonths = getEffectiveRetention(collection);
      const ageMonths = monthsSince(collection.published_at);
      if (retentionMonths == null) return null;
      if (ageMonths < retentionMonths) return null;
      return {
        ...collection,
        retentionMonths,
        ageMonths,
        reclaimableBytes: collection.reclaimableBytes || 0,
      };
    })
    .filter(Boolean);
}

function purgeCollection(collectionId, { dryRun = false } = {}) {
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(collectionId);
  if (!collection) {
    throw new Error('Η συλλογή δεν βρέθηκε.');
  }

  const fullDir = path.join(uploadsDir, String(collectionId), 'full');
  const images = db
    .prepare('SELECT id, full_path, full_bytes FROM images WHERE collection_id = ? AND full_purged = 0')
    .all(collectionId);

  let filesDeleted = 0;
  let bytesReclaimed = 0;

  for (const image of images) {
    const filePath = path.join(uploadsDir, image.full_path);
    const size = image.full_bytes || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);
    bytesReclaimed += size;
    if (!dryRun && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      filesDeleted += 1;
    } else if (dryRun && fs.existsSync(filePath)) {
      filesDeleted += 1;
    }
  }

  if (!dryRun) {
    if (fs.existsSync(fullDir)) {
      const remaining = fs.readdirSync(fullDir);
      for (const file of remaining) {
        fs.unlinkSync(path.join(fullDir, file));
      }
    }
    db.prepare('UPDATE images SET full_purged = 1 WHERE collection_id = ?').run(collectionId);
    db.prepare(
      'UPDATE collections SET full_purged_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(collectionId);
  }

  return { filesDeleted, bytesReclaimed, dryRun };
}

function startRetentionJob() {
  const run = () => {
    const candidates = findPurgeCandidates();
    for (const candidate of candidates) {
      console.log(
        `[${new Date().toISOString()}] Purge candidate: ${candidate.name} (${candidate.ageMonths}mo, ${candidate.reclaimableBytes} bytes)`
      );
      if (config.RETENTION_AUTO_PURGE) {
        const result = purgeCollection(candidate.id, { dryRun: false });
        console.log(
          `[${new Date().toISOString()}] Purged ${candidate.name}: ${result.filesDeleted} files, ${result.bytesReclaimed} bytes`
        );
      }
    }
  };

  run();
  setInterval(run, 24 * 60 * 60 * 1000);
}

module.exports = {
  getEffectiveRetention,
  getPurgeDeadline,
  getRetentionSummary,
  findPurgeCandidates,
  purgeCollection,
  startRetentionJob,
};
