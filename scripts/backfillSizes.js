const fs = require('fs');
const path = require('path');
const db = require('../db');

const uploadsDir = path.join(__dirname, '..', 'uploads');

const images = db
  .prepare(
    `SELECT id, full_path, web_path, thumb_path, full_bytes, web_bytes, thumb_bytes
     FROM images WHERE full_bytes = 0 OR web_bytes = 0 OR thumb_bytes = 0`
  )
  .all();

const update = db.prepare(
  'UPDATE images SET full_bytes = ?, web_bytes = ?, thumb_bytes = ? WHERE id = ?'
);

let updated = 0;
for (const image of images) {
  const fullPath = path.join(uploadsDir, image.full_path);
  const webPath = path.join(uploadsDir, image.web_path);
  const thumbPath = path.join(uploadsDir, image.thumb_path);

  const fullBytes = fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
  const webBytes = fs.existsSync(webPath) ? fs.statSync(webPath).size : 0;
  const thumbBytes = fs.existsSync(thumbPath) ? fs.statSync(thumbPath).size : 0;

  if (fullBytes || webBytes || thumbBytes) {
    update.run(fullBytes, webBytes, thumbBytes, image.id);
    updated += 1;
  }
}

console.log(`Backfilled sizes for ${updated} images.`);
