const XLSX = require('xlsx');

const ACCEPTED_EXTENSIONS = new Set(['.csv', '.xls', '.xlsx']);

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getExtension(filename) {
  const match = String(filename || '').toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : '';
}

function validateFilename(filename) {
  const ext = getExtension(filename);
  if (!ACCEPTED_EXTENSIONS.has(ext)) {
    throw new Error('Unsupported file type. Upload CSV, XLS, or XLSX.');
  }
}

function toNumber(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value).replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapRow(rawRow) {
  const row = {};
  for (const [key, value] of Object.entries(rawRow || {})) {
    row[normalizeHeader(key)] = value;
  }

  return {
    mpn: row.mpn || row.part_number || row.manufacturer_part_number || row.mfr_part_number || row.manufacturer_pn || row.pn || '',
    manufacturer: row.manufacturer || row.mfr || row.vendor || '',
    description: row.description || row.desc || row.part_description || '',
    qty: toNumber(row.qty || row.quantity || row.qty_required || row.count),
    package: row.footprint || row.package || row.pkg || row.case || '',
    category: row.category || row.type || row.classification || '',
  };
}

function parseBomBuffer(filename, buffer) {
  validateFilename(filename);

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('No worksheet found in uploaded file.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', blankrows: false });
  if (!rows.length) {
    throw new Error('Uploaded BOM is empty.');
  }

  const mapped = rows.map(mapRow).filter((row) => row.mpn || row.manufacturer || row.description || row.qty || row.package);
  if (!mapped.length) {
    throw new Error('No recognizable BOM rows found. Check your column headers and content.');
  }

  return {
    filename: String(filename || '').toLowerCase(),
    sheetName: firstSheetName,
    rows: mapped,
  };
}

module.exports = {
  parseBomBuffer,
  validateFilename,
};
