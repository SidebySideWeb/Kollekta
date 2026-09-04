const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { sendEmail } = require('./email');

const LEGACY_KEYS = {
  PASSWORD_HASH: 'admin_password_hash',
  RESET_HASH: 'admin_reset_hash',
  RESET_EXPIRES: 'admin_reset_expires',
};

const MIN_PASSWORD_LENGTH = 8;
const RESET_TTL_MS = 15 * 60 * 1000;

function getSetting(key) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function deleteSetting(key) {
  db.prepare('DELETE FROM app_settings WHERE key = ?').run(key);
}

function hashSecret(secret, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(secret), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifySecret(secret, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(String(secret), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
  } catch {
    return false;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateNewPassword(password) {
  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    return `Ο νέος κωδικός πρέπει να έχει τουλάχιστον ${MIN_PASSWORD_LENGTH} χαρακτήρες.`;
  }
  return null;
}

function publicAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getAdminById(id) {
  return db.prepare('SELECT * FROM admins WHERE id = ?').get(id) || null;
}

function getAdminByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return db.prepare('SELECT * FROM admins WHERE email = ?').get(normalized) || null;
}

function listAdmins() {
  return db.prepare(
    'SELECT id, email, name, created_at, updated_at FROM admins ORDER BY email COLLATE NOCASE'
  ).all().map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function countAdmins() {
  return db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
}

function bootstrapEmail() {
  return normalizeEmail(process.env.ADMIN_EMAIL || config.COMPANY_EMAIL || 'admin@localhost');
}

function ensureBootstrapAdmin() {
  if (countAdmins() > 0) return;

  const email = bootstrapEmail();
  const legacyHash = getSetting(LEGACY_KEYS.PASSWORD_HASH);
  const passwordHash = legacyHash || hashSecret(config.ADMIN_PASSWORD);

  db.prepare(
    `INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)`
  ).run(email, 'Admin', passwordHash);

  deleteSetting(LEGACY_KEYS.PASSWORD_HASH);
  deleteSetting(LEGACY_KEYS.RESET_HASH);
  deleteSetting(LEGACY_KEYS.RESET_EXPIRES);
}

function authenticateAdmin(email, password) {
  ensureBootstrapAdmin();
  const normalized = normalizeEmail(email);
  let admin = null;

  if (normalized) {
    admin = getAdminByEmail(normalized);
  } else if (countAdmins() === 1) {
    admin = db.prepare('SELECT * FROM admins LIMIT 1').get();
  }

  if (!admin || !verifySecret(password, admin.password_hash)) {
    return null;
  }
  return publicAdmin(admin);
}

function createAdmin({ email, name, password }) {
  ensureBootstrapAdmin();
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { ok: false, error: 'Μη έγκυρο email διαχειριστή.' };
  }
  const passwordError = validateNewPassword(password);
  if (passwordError) return { ok: false, error: passwordError };
  if (getAdminByEmail(normalized)) {
    return { ok: false, error: 'Υπάρχει ήδη διαχειριστής με αυτό το email.' };
  }

  const result = db.prepare(
    `INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)`
  ).run(normalized, String(name || '').trim() || null, hashSecret(password));

  return { ok: true, admin: publicAdmin(getAdminById(result.lastInsertRowid)) };
}

function deleteAdmin(adminId, actingAdminId) {
  const id = Number(adminId);
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: 'Μη έγκυρος διαχειριστής.' };
  }
  if (!getAdminById(id)) {
    return { ok: false, error: 'Ο διαχειριστής δεν βρέθηκε.' };
  }
  if (countAdmins() <= 1) {
    return { ok: false, error: 'Δεν μπορεί να διαγραφεί ο τελευταίος διαχειριστής.' };
  }
  if (Number(actingAdminId) === id) {
    return { ok: false, error: 'Δεν μπορείς να διαγράψεις τον δικό σου λογαριασμό.' };
  }

  db.prepare('DELETE FROM admins WHERE id = ?').run(id);
  return { ok: true };
}

function setAdminPasswordById(adminId, password) {
  const error = validateNewPassword(password);
  if (error) return { ok: false, error };
  const admin = getAdminById(adminId);
  if (!admin) return { ok: false, error: 'Ο διαχειριστής δεν βρέθηκε.' };

  db.prepare(
    `UPDATE admins
     SET password_hash = ?, reset_hash = NULL, reset_expires = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(hashSecret(password), adminId);
  return { ok: true };
}

function changeAdminPassword(adminId, currentPassword, newPassword) {
  const admin = getAdminById(adminId);
  if (!admin || !verifySecret(currentPassword, admin.password_hash)) {
    return { ok: false, error: 'Ο τρέχων κωδικός είναι λάθος.' };
  }
  return setAdminPasswordById(adminId, newPassword);
}

function resetAvailable() {
  ensureBootstrapAdmin();
  return countAdmins() > 0;
}

async function requestPasswordReset(email) {
  ensureBootstrapAdmin();
  const message = 'Αν υπάρχει λογαριασμός με αυτό το email, στάλθηκε κωδικός επαναφοράς.';
  const admin = getAdminByEmail(email);
  if (!admin) {
    return { ok: true, message };
  }

  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  db.prepare(
    `UPDATE admins
     SET reset_hash = ?, reset_expires = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(hashSecret(code), new Date(Date.now() + RESET_TTL_MS).toISOString(), admin.id);

  const loginUrl = `${String(config.APP_PUBLIC_URL || '').replace(/\/$/, '')}/admin/login.html`;
  await sendEmail({
    to: admin.email,
    subject: `${config.PRODUCT_NAME} — Επαναφορά κωδικού διαχειριστή`,
    text: [
      `Ο κωδικός επαναφοράς είναι: ${code}`,
      'Ισχύει για 15 λεπτά.',
      '',
      `Σύνδεση: ${loginUrl}`,
    ].join('\n'),
    html: `<p>Ο κωδικός επαναφοράς είναι: <strong style="font-family:monospace;font-size:20px;">${code}</strong></p><p>Ισχύει για 15 λεπτά.</p><p><a href="${loginUrl}">${loginUrl}</a></p>`,
  });

  return { ok: true, message };
}

function confirmPasswordReset(email, code, newPassword) {
  ensureBootstrapAdmin();
  const admin = getAdminByEmail(email);
  if (!admin || !admin.reset_hash || !admin.reset_expires || new Date(admin.reset_expires) < new Date()) {
    return { ok: false, error: 'Ο κωδικός δεν είναι έγκυρος ή έχει λήξει.' };
  }
  if (!verifySecret(String(code || '').trim().toUpperCase(), admin.reset_hash)) {
    return { ok: false, error: 'Ο κωδικός δεν είναι έγκυρος ή έχει λήξει.' };
  }
  return setAdminPasswordById(admin.id, newPassword);
}

ensureBootstrapAdmin();

module.exports = {
  ensureBootstrapAdmin,
  authenticateAdmin,
  getAdminById,
  listAdmins,
  createAdmin,
  deleteAdmin,
  changeAdminPassword,
  setAdminPasswordById,
  requestPasswordReset,
  confirmPasswordReset,
  resetAvailable,
  publicAdmin,
  normalizeEmail,
  MIN_PASSWORD_LENGTH,
};
