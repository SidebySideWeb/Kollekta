const fs = require('fs');
const db = require('../db');
const { generateThumbForImage, resolveUploadPath } = require('./imageProcessor');

const THUMB_CONCURRENCY = Math.max(1, Number(process.env.IMAGE_THUMB_CONCURRENCY) || 2);

const queue = [];
let active = 0;
let idleWaiters = [];

function notifyIdle() {
  if (active === 0 && queue.length === 0) {
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const resolve of waiters) resolve();
  }
}

function pump() {
  while (active < THUMB_CONCURRENCY && queue.length) {
    const job = queue.shift();
    active += 1;
    Promise.resolve()
      .then(() => job.run())
      .catch((err) => {
        console.error('[imageJobs] thumb job failed:', err.message || err);
      })
      .finally(() => {
        active -= 1;
        pump();
        notifyIdle();
      });
  }
  notifyIdle();
}

function enqueueThumbJob({ imageId, fullPath, thumbPath }) {
  const fullAbsolute = resolveUploadPath(fullPath);
  const thumbAbsolute = resolveUploadPath(thumbPath);
  if (!imageId || !fullAbsolute || !thumbAbsolute) return;

  queue.push({
    run: async () => {
      const stillThere = db.prepare('SELECT id FROM images WHERE id = ?').get(imageId);
      if (!stillThere) return;
      if (!fs.existsSync(fullAbsolute)) {
        throw new Error(`Missing full image for thumb job #${imageId}`);
      }

      const { thumbBytes } = await generateThumbForImage(fullAbsolute, thumbAbsolute);
      const relThumb = thumbPath.replace(/\\/g, '/');
      const updated = db
        .prepare('UPDATE images SET thumb_path = ?, thumb_bytes = ? WHERE id = ?')
        .run(relThumb, thumbBytes, imageId);

      if (updated.changes === 0) {
        try {
          if (fs.existsSync(thumbAbsolute)) fs.unlinkSync(thumbAbsolute);
        } catch {
          // ignore
        }
      }
    },
  });
  pump();
}

function awaitImageJobsIdle() {
  if (active === 0 && queue.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    idleWaiters.push(resolve);
  });
}

function getImageJobsStats() {
  return { active, queued: queue.length, concurrency: THUMB_CONCURRENCY };
}

module.exports = {
  enqueueThumbJob,
  awaitImageJobsIdle,
  getImageJobsStats,
};
