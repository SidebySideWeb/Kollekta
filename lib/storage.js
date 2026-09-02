const fs = require('fs');
const path = require('path');
const db = require('../db');

const uploadsDir = path.join(__dirname, '..', 'uploads');

function formatBytes(n) {
  if (!n || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / 1024 ** i;
  return `${value >= 10 || i === 0 ? value.toFixed(i === 0 ? 0 : 1) : value.toFixed(1)} ${units[i]}`;
}

function getCollectionStorage(collectionId) {
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(full_bytes), 0) AS fullBytes,
         COALESCE(SUM(web_bytes), 0) AS webBytes,
         COALESCE(SUM(thumb_bytes), 0) AS thumbBytes,
         COUNT(*) AS imageCount,
         COALESCE(SUM(full_purged), 0) AS purgedCount
       FROM images WHERE collection_id = ?`
    )
    .get(collectionId);

  const total = row.fullBytes + row.webBytes + row.thumbBytes;
  return { ...row, totalBytes: total };
}

function getTotalStorage() {
  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(full_bytes), 0) AS fullBytes,
         COALESCE(SUM(web_bytes), 0) AS webBytes,
         COALESCE(SUM(thumb_bytes), 0) AS thumbBytes,
         COUNT(*) AS imageCount
       FROM images`
    )
    .get();

  const byCollection = db
    .prepare(
      `SELECT c.id, c.name, c.published_at, c.full_purged_at, c.retention_months, c.retention_pinned,
              COALESCE(SUM(i.full_bytes), 0) AS fullBytes,
              COALESCE(SUM(i.web_bytes), 0) AS webBytes,
              COALESCE(SUM(i.thumb_bytes), 0) AS thumbBytes,
              COUNT(i.id) AS imageCount
       FROM collections c
       LEFT JOIN images i ON i.collection_id = c.id
       GROUP BY c.id
       ORDER BY (fullBytes + webBytes + thumbBytes) DESC`
    )
    .all()
    .map((row) => ({
      ...row,
      totalBytes: row.fullBytes + row.webBytes + row.thumbBytes,
    }));

  return {
    fullBytes: totals.fullBytes,
    webBytes: totals.webBytes,
    thumbBytes: totals.thumbBytes,
    totalBytes: totals.fullBytes + totals.webBytes + totals.thumbBytes,
    imageCount: totals.imageCount,
    byCollection,
  };
}

function getDiskUsage() {
  const stats = fs.statfsSync(uploadsDir);
  const totalBytes = stats.bsize * stats.blocks;
  const freeBytes = stats.bsize * stats.bavail;
  const usedBytes = totalBytes - freeBytes;
  const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  return { totalBytes, freeBytes, usedPercent };
}

function takeSnapshot() {
  const storage = getTotalStorage();
  const disk = getDiskUsage();
  db.prepare(
    `INSERT INTO storage_snapshots
      (total_bytes, full_bytes, web_bytes, thumb_bytes, disk_free_bytes)
     VALUES (?, ?, ?, ?, ?)`
  ).run(storage.totalBytes, storage.fullBytes, storage.webBytes, storage.thumbBytes, disk.freeBytes);
}

function getRecentSnapshots(limit = 30) {
  return db
    .prepare('SELECT * FROM storage_snapshots ORDER BY created_at DESC LIMIT ?')
    .all(limit);
}

module.exports = {
  formatBytes,
  getCollectionStorage,
  getTotalStorage,
  getDiskUsage,
  takeSnapshot,
  getRecentSnapshots,
  uploadsDir,
};
