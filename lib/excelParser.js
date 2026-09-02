const XLSX = require('xlsx');

const VALID_ACCESS_MODES = new Set([
  'order_only',
  'browse_all_download_order',
  'full_access',
]);

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase();
}

function findColumnIndex(headers, matchers) {
  for (let i = 0; i < headers.length; i++) {
    const header = normalizeHeader(headers[i]);
    if (matchers.some((matcher) => header.includes(matcher))) {
      return i;
    }
  }
  return -1;
}

function sheetToRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
  });

  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0].map((cell) => String(cell || '').trim());
  const dataRows = rows.slice(1).map((row, index) => ({
    rowIndex: index + 2,
    values: headers.map((_, colIndex) => String(row[colIndex] ?? '').trim()),
  }));

  return { headers, rows: dataRows };
}

function parseImageMapping(buffer) {
  const { headers, rows } = sheetToRows(buffer);
  const filenameIdx = findColumnIndex(headers, ['filename', 'εικόνα', 'αρχείο']);
  const productIdx = findColumnIndex(headers, ['product', 'κωδικ']);

  if (filenameIdx === -1 || productIdx === -1) return [];

  const results = [];
  for (const row of rows) {
    const filename = row.values[filenameIdx]?.trim();
    const productCode = row.values[productIdx]?.trim();
    if (!filename || !productCode) continue;
    results.push({ filename, productCode });
  }
  return results;
}

function parseCustomers(buffer) {
  const { headers, rows } = sheetToRows(buffer);
  const phoneIdx = findColumnIndex(headers, ['phone', 'κινητό', 'κινητο', 'τηλ', 'mobile']);
  const emailIdx = findColumnIndex(headers, ['email', 'mail']);
  const nameIdx = findColumnIndex(headers, ['name', 'όνομα', 'ονομα', 'επωνυμ']);
  const erpIdx = findColumnIndex(headers, ['erp', 'κωδικ']);
  const modeIdx = findColumnIndex(headers, ['access', 'mode', 'πρόσβαση', 'προσβαση']);
  const tagsIdx = findColumnIndex(headers, ['tags', 'ετικέτ', 'ομάδα', 'κατηγορ']);

  const parsedRows = [];
  const errors = [];

  if (phoneIdx === -1) {
    return { rows: [], errors: [{ rowIndex: 1, reason: 'Δεν βρέθηκε στήλη τηλεφώνου.' }] };
  }

  for (const row of rows) {
    const phone = row.values[phoneIdx]?.trim();
    if (!phone) {
      errors.push({ rowIndex: row.rowIndex, reason: 'Λείπει το τηλέφωνο.' });
      continue;
    }

    const rawMode = modeIdx >= 0 ? row.values[modeIdx]?.trim() : '';
    const accessMode = VALID_ACCESS_MODES.has(rawMode) ? rawMode : 'full_access';

    parsedRows.push({
      rowIndex: row.rowIndex,
      phone,
      email: emailIdx >= 0 ? row.values[emailIdx]?.trim() : '',
      name: nameIdx >= 0 ? row.values[nameIdx]?.trim() : '',
      erpCode: erpIdx >= 0 ? row.values[erpIdx]?.trim() : '',
      accessMode,
      tags: tagsIdx >= 0 ? row.values[tagsIdx]?.trim() : '',
    });
  }

  return { rows: parsedRows, errors };
}

function parseOrders(buffer) {
  const { headers, rows } = sheetToRows(buffer);
  const identifierIdx = findColumnIndex(headers, ['erp', 'email', 'phone', 'κινητ', 'πελ']);
  const productIdx = findColumnIndex(headers, ['product', 'κωδικ']);

  if (identifierIdx === -1 || productIdx === -1) return [];

  const results = [];
  for (const row of rows) {
    const identifier = row.values[identifierIdx]?.trim();
    const productCode = row.values[productIdx]?.trim();
    if (!identifier || !productCode) continue;
    results.push({ identifier, productCode });
  }
  return results;
}

module.exports = {
  parseImageMapping,
  parseCustomers,
  parseOrders,
};
