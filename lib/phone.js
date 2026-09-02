function normalizePhone(input) {
  if (!input) return null;

  let digits = String(input).replace(/[\s\-().+]/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (/^69\d{8}$/.test(digits)) {
    return `30${digits}`;
  }

  if (/^30\d{10}$/.test(digits) && digits.startsWith('3069')) {
    return digits;
  }

  return null;
}

function formatPhoneForDisplay(normalized) {
  if (!normalized || normalized.length !== 12 || !normalized.startsWith('30')) {
    return normalized || '';
  }
  return `+30 ${normalized.slice(2, 5)} ${normalized.slice(5, 8)} ${normalized.slice(8)}`;
}

function maskPhone(normalized) {
  if (!normalized || normalized.length !== 12) {
    return '***';
  }
  return `+30 ${normalized.slice(2, 4)}** *** ${normalized.slice(9)}`;
}

module.exports = {
  normalizePhone,
  formatPhoneForDisplay,
  maskPhone,
};
