const crypto = require('crypto');

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateAccessCode() {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}

function generateSessionToken() {
  return crypto.randomBytes(16).toString('hex');
}

function normalizeCodeInput(input) {
  return String(input || '').toUpperCase().replace(/[\s-]/g, '');
}

function compareCode(input, stored) {
  const normalized = normalizeCodeInput(input);
  const storedNormalized = normalizeCodeInput(stored);

  if (normalized.length !== storedNormalized.length) {
    return false;
  }

  const inputBuf = Buffer.from(normalized);
  const storedBuf = Buffer.from(storedNormalized);
  return crypto.timingSafeEqual(inputBuf, storedBuf);
}

module.exports = {
  generateAccessCode,
  generateSessionToken,
  normalizeCodeInput,
  compareCode,
};
