const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { uploadsDir } = require('./storage');

function getEffectiveRetention(collection) {
  if (collection.retention_pinned) return null;
  if (collection.retention_months != null) return collection.retention_months;
  if (config.DEFAULT_RETENTION_MONTHS != null) return config.DEFAULT_RETENTION_MONTHS;
  return null;
}

function monthsSince(dateString) {
  if (!dateString) return 0;
  const then = new Date(dateString);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

function findPurgeCandidates() {
  const collections = db
    .prepare(
      `SELECT c.*,
              COALESCE(SUM(i.full_bytes), 0) AS reclaimableBytes
       FROM collections c
       LEFT JOIN images i ON i.collection_id = c.id AND i.full_purged = 0
       WHERE c.status = 'published'
         AND c.retention_pinned = 0
         AND c.full_purged_at IS NULL
         AND c.published_at IS NOT NULL
       GROUP BY c.id`
    )
    .all();

  return collections
    .map((collection) => {
      const retentionMonths = getEffectiveRetention(collection);
      const ageMonths = monthsSince(collection.published_at);
      return {
        ...collection,
        retentionMonths,
        ageMonths,
        reclaimableBytes: collection.reclaimableBytes || 0,
      };
    })
    .filter((collection) => {
      if (collection.retentionMonths == null) return false;
      return collection.ageMonths >= collection.retentionMonths;
    });
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
  findPurgeCandidates,
  purgeCollection,
  startRetentionJob,
};
