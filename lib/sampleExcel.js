const XLSX = require('xlsx');

const IMAGE_MAPPING_HEADERS = ['filename', 'product'];
const ORDERS_HEADERS = ['erp', 'product'];
const CUSTOMERS_HEADERS = ['phone', 'name', 'email', 'erp', 'access', 'tags'];

function buildSheetBuffer(headers, rows) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function imageMappingSampleBuffer() {
  return buildSheetBuffer(IMAGE_MAPPING_HEADERS, [
    ['DSC_0001.jpg', 'DRESS-001'],
    ['DSC_0002.jpg', 'DRESS-002'],
    ['DSC_0003.jpg', 'COAT-101'],
  ]);
}

function imageMappingExportBuffer(images) {
  const rows = images.map((image) => [
    image.original_filename || image.filename || '',
    image.product_code || image.productCode || '',
  ]);
  return buildSheetBuffer(IMAGE_MAPPING_HEADERS, rows);
}

function ordersSampleBuffer() {
  return buildSheetBuffer(ORDERS_HEADERS, [
    ['ERP001', 'DRESS-001'],
    ['ERP001', 'COAT-101'],
    ['ERP002', 'DRESS-002'],
  ]);
}

function customerOrderIdentifier(customer) {
  const erp = String(customer.erp_code || '').trim();
  if (erp) return erp;
  const email = String(customer.email || '').trim();
  if (email) return email;
  return String(customer.phone || '').trim();
}

function ordersExportBuffer(rows) {
  const data = rows.map((row) => [
    row.identifier || customerOrderIdentifier(row),
    row.product_code || row.productCode || '',
  ]);
  return buildSheetBuffer(ORDERS_HEADERS, data);
}

function customersSampleBuffer() {
  return buildSheetBuffer(CUSTOMERS_HEADERS, [
    ['6912345678', 'Μαρία Παπαδοπούλου', 'maria@example.com', 'ERP001', 'full_access', 'vip, athens'],
    ['6987654321', 'Γιάννης Νικολάου', 'giannis@example.com', 'ERP002', 'order_only', 'wholesale'],
    ['6971112233', 'Κώστας Αντωνίου', '', 'ERP003', 'browse_all_download_order', ''],
  ]);
}

function sendXlsx(res, filename, buffer) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

function safeFilename(name, fallback) {
  const base = String(name || fallback)
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || fallback;
}

module.exports = {
  imageMappingSampleBuffer,
  imageMappingExportBuffer,
  ordersSampleBuffer,
  ordersExportBuffer,
  customersSampleBuffer,
  customerOrderIdentifier,
  sendXlsx,
  safeFilename,
};
