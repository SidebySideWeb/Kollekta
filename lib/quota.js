const config = require('../config');
const db = require('../db');
const { formatBytes } = require('./storage');

const VARIANT_OVERHEAD = 1.12;

function getUsedBytes() {
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(full_bytes), 0)
         + COALESCE(SUM(web_bytes), 0)
         + COALESCE(SUM(thumb_bytes), 0)
         + COALESCE(SUM(grid_bytes), 0) AS usedBytes
       FROM images`
    )
    .get();
  return Number(row?.usedBytes || 0);
}

function getQuotaBytes() {
  const gb = Number(config.QUOTA_GB);
  if (!Number.isFinite(gb) || gb <= 0) return null;
  return Math.floor(gb * 1024 * 1024 * 1024);
}

function getQuotaStatus() {
  const usedBytes = getUsedBytes();
  const quotaBytes = getQuotaBytes();

  if (quotaBytes == null) {
    return {
      usedBytes,
      quotaBytes: null,
      percentUsed: 0,
      remainingBytes: null,
      state: 'ok',
      warnPercent: config.QUOTA_WARN_PERCENT,
    };
  }

  const percentUsed = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;
  const remainingBytes = Math.max(0, quotaBytes - usedBytes);
  let state = 'ok';
  if (percentUsed >= 100) state = 'full';
  else if (percentUsed >= config.QUOTA_WARN_PERCENT) state = 'warning';

  return {
    usedBytes,
    quotaBytes,
    percentUsed,
    remainingBytes,
    state,
    warnPercent: config.QUOTA_WARN_PERCENT,
  };
}

function quotaExceededMessage(status) {
  const used = formatBytes(status.usedBytes);
  const quota = formatBytes(status.quotaBytes || 0);
  return `Δεν υπάρχει αρκετός χώρος. Χρησιμοποιούνται ${used} από ${quota} διαθέσιμα. Αρχειοθέτησε παλιές συλλογές για να ελευθερώσεις χώρο.`;
}

function checkUploadAllowed(incomingBytes, { alreadyReserved = 0 } = {}) {
  const status = getQuotaStatus();
  if (status.quotaBytes == null) {
    return { allowed: true };
  }

  const estimatedCost = Math.ceil(Math.max(0, Number(incomingBytes) || 0) * VARIANT_OVERHEAD);
  const projected = status.usedBytes + Math.max(0, Number(alreadyReserved) || 0) + estimatedCost;

  if (projected > status.quotaBytes) {
    return {
      allowed: false,
      reason: quotaExceededMessage(status),
      wouldExceedBy: projected - status.quotaBytes,
    };
  }

  return { allowed: true, estimatedCost };
}

module.exports = {
  getUsedBytes,
  getQuotaStatus,
  checkUploadAllowed,
  quotaExceededMessage,
  VARIANT_OVERHEAD,
};
