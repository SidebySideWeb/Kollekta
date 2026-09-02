// These limits protect against three things — brute-forcing an 8-character code,
// enumerating which phone numbers are registered customers, and spamming a
// real customer's phone or inbox through repeated reset requests.

const db = require('../db');
const config = require('../config');

const LOCAL_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isLocalDevRequest(ip) {
  if (process.env.RATE_LIMIT_DISABLED === 'true') return true;
  if (process.env.NODE_ENV === 'production') return false;
  return LOCAL_IPS.has(ip);
}

function recordAttempt({ phone, ip, kind, success }) {
  db.prepare(
    `INSERT INTO auth_attempts (phone, ip, kind, success)
     VALUES (?, ?, ?, ?)`
  ).run(phone || null, ip || null, kind, success ? 1 : 0);
}

function countRecent(whereClause, params) {
  return db.prepare(`SELECT COUNT(*) AS count FROM auth_attempts WHERE ${whereClause}`).get(...params)
    .count;
}

function checkLoginAllowed(phone, ip) {
  const windowMinutes = config.RATE_LIMIT_LOGIN_WINDOW_MINUTES;
  const phoneFails = countRecent(
    `phone = ? AND kind = 'login' AND success = 0 AND datetime(created_at) > datetime('now', '-${windowMinutes} minutes')`,
    [phone]
  );
  if (phoneFails >= config.RATE_LIMIT_LOGIN_MAX_FAILURES) {
    return { allowed: false, retryAfterSeconds: windowMinutes * 60 };
  }

  if (!isLocalDevRequest(ip)) {
    const ipAttempts = countRecent(
      "ip = ? AND kind = 'login' AND datetime(created_at) > datetime('now', '-1 hour')",
      [ip]
    );
    if (ipAttempts >= config.RATE_LIMIT_LOGIN_MAX_PER_IP) {
      return { allowed: false, retryAfterSeconds: 60 * 60 };
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function checkResetAllowed(phone, ip) {
  const phoneResets = countRecent(
    "phone = ? AND kind = 'reset' AND datetime(created_at) > datetime('now', '-1 hour')",
    [phone]
  );
  if (phoneResets >= config.RATE_LIMIT_RESET_MAX_PER_PHONE) {
    return { allowed: false, retryAfterSeconds: 60 * 60 };
  }

  if (!isLocalDevRequest(ip)) {
    const ipResets = countRecent(
      "ip = ? AND kind = 'reset' AND datetime(created_at) > datetime('now', '-1 hour')",
      [ip]
    );
    if (ipResets >= config.RATE_LIMIT_RESET_MAX_PER_IP) {
      return { allowed: false, retryAfterSeconds: 60 * 60 };
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function cleanupOldAttempts() {
  db.prepare("DELETE FROM auth_attempts WHERE datetime(created_at) < datetime('now', '-24 hours')").run();
}

module.exports = {
  recordAttempt,
  checkLoginAllowed,
  checkResetAllowed,
  cleanupOldAttempts,
};
