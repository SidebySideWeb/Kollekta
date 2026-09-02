const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function sanitizeFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, '');
  return `${sanitized || 'image'}.jpg`;
}

function statSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

async function processImage(inputPath, collectionId, baseFilename) {
  const filename = sanitizeFilename(baseFilename);
  const baseDir = path.join(__dirname, '..', 'uploads', String(collectionId));
  const variants = {
    full: path.join(baseDir, 'full', filename),
    web: path.join(baseDir, 'web', filename),
    thumb: path.join(baseDir, 'thumb', filename),
  };

  for (const filePath of Object.values(variants)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const image = sharp(inputPath);

  await image.clone().jpeg({ quality: 92 }).toFile(variants.full);
  await image
    .clone()
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(variants.web);
  await image
    .clone()
    .resize({ width: 400, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(variants.thumb);

  const rel = (p) =>
    path.join(String(collectionId), path.relative(baseDir, p)).replace(/\\/g, '/');

  return {
    fullPath: rel(variants.full),
    webPath: rel(variants.web),
    thumbPath: rel(variants.thumb),
    fullBytes: statSize(variants.full),
    webBytes: statSize(variants.web),
    thumbBytes: statSize(variants.thumb),
  };
}

const uploadsRoot = path.join(__dirname, '..', 'uploads');

function deleteImageAssets(image) {
  for (const relPath of [image.full_path, image.web_path, image.thumb_path]) {
    if (!relPath) continue;
    const filePath = path.join(uploadsRoot, relPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

module.exports = { processImage, deleteImageAssets };
