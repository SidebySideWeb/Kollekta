const fs = require('fs');
const path = require('path');

const tmpDir = path.join(__dirname, '..', 'tmp');

function ensureTmpDir() {
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

function cleanupTmpDir() {
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
    return;
  }
  for (const entry of fs.readdirSync(tmpDir)) {
    fs.rmSync(path.join(tmpDir, entry), { recursive: true, force: true });
  }
}

function deleteTempFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore cleanup errors
  }
}

function deleteTempFiles(files) {
  for (const file of files || []) {
    deleteTempFile(file?.path);
  }
}

module.exports = {
  tmpDir,
  ensureTmpDir,
  cleanupTmpDir,
  deleteTempFile,
  deleteTempFiles,
};
