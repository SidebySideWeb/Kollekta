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

function isJpegSource(inputPath, originalName = '', mimeType = '') {
  const mime = String(mimeType || '').toLowerCase();
  if (mime === 'image/jpeg' || mime === 'image/jpg') return true;
  const fromName = path.extname(originalName || '').toLowerCase();
  if (fromName === '.jpg' || fromName === '.jpeg') return true;
  const fromPath = path.extname(inputPath || '').toLowerCase();
  return fromPath === '.jpg' || fromPath === '.jpeg';
}

function variantPaths(collectionId, baseFilename) {
  const filename = sanitizeFilename(baseFilename);
  const baseDir = path.join(__dirname, '..', 'uploads', String(collectionId));
  return {
    filename,
    baseDir,
    full: path.join(baseDir, 'full', filename),
    web: path.join(baseDir, 'web', filename),
    thumb: path.join(baseDir, 'thumb', filename),
  };
}

function toRel(collectionId, baseDir, absolutePath) {
  return path.join(String(collectionId), path.relative(baseDir, absolutePath)).replace(/\\/g, '/');
}

async function ensureVariantDirs(variants) {
  for (const filePath of [variants.full, variants.web, variants.thumb]) {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  }
}

async function writeFullVariant(inputPath, outputPath, { originalName = '', mimeType = '' } = {}) {
  if (isJpegSource(inputPath, originalName, mimeType)) {
    try {
      await fs.promises.rename(inputPath, outputPath);
      return { moved: true };
    } catch {
      await fs.promises.copyFile(inputPath, outputPath);
      return { moved: false };
    }
  }

  await sharp(inputPath).jpeg({ quality: 92 }).toFile(outputPath);
  return { moved: false };
}

async function writeWebVariant(sourcePath, outputPath) {
  await sharp(sourcePath)
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(outputPath);
}

async function writeThumbVariant(sourcePath, outputPath) {
  await sharp(sourcePath)
    .resize({ width: 400, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(outputPath);
}

/**
 * Fast upload path: place full + web immediately.
 * Thumb is deferred — caller should queue generateThumbForImage.
 * Until then, thumb_path in DB can temporarily point at web_path.
 */
async function processImageFast(inputPath, collectionId, baseFilename, { mimeType = '' } = {}) {
  const variants = variantPaths(collectionId, baseFilename);
  await ensureVariantDirs(variants);

  const fullResult = await writeFullVariant(inputPath, variants.full, {
    originalName: baseFilename,
    mimeType,
  });

  // Prefer full as source for web (already on disk); fall back to input if rename failed oddly
  const webSource = fs.existsSync(variants.full) ? variants.full : inputPath;
  await writeWebVariant(webSource, variants.web);

  return {
    fullPath: toRel(collectionId, variants.baseDir, variants.full),
    webPath: toRel(collectionId, variants.baseDir, variants.web),
    thumbPath: toRel(collectionId, variants.baseDir, variants.thumb),
    fullBytes: statSize(variants.full),
    webBytes: statSize(variants.web),
    thumbBytes: 0,
    thumbPending: true,
    fullAbsolute: variants.full,
    thumbAbsolute: variants.thumb,
    inputConsumed: fullResult.moved,
  };
}

async function generateThumbForImage(sourceAbsolutePath, thumbAbsolutePath) {
  await fs.promises.mkdir(path.dirname(thumbAbsolutePath), { recursive: true });
  await writeThumbVariant(sourceAbsolutePath, thumbAbsolutePath);
  return { thumbBytes: statSize(thumbAbsolutePath) };
}

/** Full synchronous pipeline (tests / fallback). */
async function processImage(inputPath, collectionId, baseFilename, options = {}) {
  const fast = await processImageFast(inputPath, collectionId, baseFilename, options);
  await generateThumbForImage(fast.fullAbsolute, fast.thumbAbsolute);
  return {
    fullPath: fast.fullPath,
    webPath: fast.webPath,
    thumbPath: fast.thumbPath,
    fullBytes: fast.fullBytes,
    webBytes: fast.webBytes,
    thumbBytes: statSize(fast.thumbAbsolute),
    inputConsumed: fast.inputConsumed,
  };
}

const uploadsRoot = path.join(__dirname, '..', 'uploads');

function deleteImageAssets(image) {
  const unique = new Set(
    [image.full_path, image.web_path, image.thumb_path].filter(Boolean)
  );
  for (const relPath of unique) {
    const filePath = path.join(uploadsRoot, relPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

function resolveUploadPath(relPath) {
  if (!relPath) return null;
  return path.join(uploadsRoot, relPath);
}

module.exports = {
  processImage,
  processImageFast,
  generateThumbForImage,
  deleteImageAssets,
  resolveUploadPath,
  isJpegSource,
};
