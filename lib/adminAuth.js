const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { sendEmail } = require('./email');

const KEYS = {
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

function setSetting(key, value) {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
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

function safeStringEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyAdminPassword(password) {
  const stored = getSetting(KEYS.PASSWORD_HASH);
  if (stored) return verifySecret(password, stored);
  return safeStringEqual(password, config.ADMIN_PASSWORD);
}

function validateNewPassword(password) {
  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    return `Ο νέος κωδικός πρέπει να έχει τουλάχιστον ${MIN_PASSWORD_LENGTH} χαρακτήρες.`;
  }
  return null;
}

function setAdminPassword(password) {
  const error = validateNewPassword(password);
  if (error) return { ok: false, error };
  setSetting(KEYS.PASSWORD_HASH, hashSecret(password));
  deleteSetting(KEYS.RESET_HASH);
  deleteSetting(KEYS.RESET_EXPIRES);
  return { ok: true };
}

function changeAdminPassword(currentPassword, newPassword) {
  if (!verifyAdminPassword(currentPassword)) {
    return { ok: false, error: 'Ο τρέχων κωδικός είναι λάθος.' };
  }
  return setAdminPassword(newPassword);
}

function adminResetEmail() {
  return String(process.env.ADMIN_EMAIL || config.COMPANY_EMAIL || '').trim();
}

function resetAvailable() {
  return Boolean(adminResetEmail());
}

async function requestPasswordReset() {
  const message = 'Αν έχει ρυθμιστεί email διαχειριστή, στάλθηκε κωδικός επαναφοράς.';
  const email = adminResetEmail();
  if (!email) {
    console.warn('[adminAuth] No ADMIN_EMAIL or COMPANY_EMAIL configured for admin password reset.');
    return { ok: true, message };
  }

  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  setSetting(KEYS.RESET_HASH, hashSecret(code));
  setSetting(KEYS.RESET_EXPIRES, new Date(Date.now() + RESET_TTL_MS).toISOString());

  const loginUrl = `${String(config.APP_PUBLIC_URL || '').replace(/\/$/, '')}/admin/login.html`;
  await sendEmail({
    to: email,
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

function confirmPasswordReset(code, newPassword) {
  const stored = getSetting(KEYS.RESET_HASH);
  const expires = getSetting(KEYS.RESET_EXPIRES);
  if (!stored || !expires || new Date(expires) < new Date()) {
    return { ok: false, error: 'Ο κωδικός δεν είναι έγκυρος ή έχει λήξει.' };
  }
  if (!verifySecret(String(code || '').trim().toUpperCase(), stored)) {
    return { ok: false, error: 'Ο κωδικός δεν είναι έγκυρος ή έχει λήξει.' };
  }
  return setAdminPassword(newPassword);
}

module.exports = {
  verifyAdminPassword,
  changeAdminPassword,
  setAdminPassword,
  requestPasswordReset,
  confirmPasswordReset,
  resetAvailable,
  adminResetEmail,
  MIN_PASSWORD_LENGTH,
};
