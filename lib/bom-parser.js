const XLSX = require('xlsx');

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s/_-]+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function findColumn(columns, candidates) {
  for (const candidate of candidates) {
    const found = columns.find((col) => normalizeKey(col) === normalizeKey(candidate));
    if (found) return found;
  }

  for (const candidate of candidates) {
    const found = columns.find((col) => normalizeKey(col).includes(normalizeKey(candidate)));
    if (found) return found;
  }

  return null;
}

function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(String(value).replace(/,/g, '').trim());
  return Number.isNaN(num) ? fallback : num;
}

function inferCategory(text) {
  const t = String(text || '').toLowerCase();

  if (t.includes('mcu') || t.includes('microcontroller') || t.includes('stm32')) return 'MCU';
  if (t.includes('flash') || t.includes('memory')) return 'Memory';
  if (t.includes('resistor')) return 'Resistor';
  if (t.includes('capacitor') || t.includes('cap')) return 'Capacitor';
  if (t.includes('diode')) return 'Diode';
  if (t.includes('tvs') || t.includes('esd')) return 'Protection';
  if (t.includes('transceiver') || t.includes('uart') || t.includes('usb') || t.includes('can')) return 'Interface';
  if (t.includes('ldo') || t.includes('regulator') || t.includes('buck') || t.includes('converter') || t.includes('power')) return 'Power';
  if (t.includes('crystal') || t.includes('resonator')) return 'Crystal';

  return 'Other';
}

function assessPart(part) {
  const lifecycle = String(part.lifecycle || 'Active');
  const stock = safeNumber(part.stock, 0);

  let riskLevel = 'healthy';
  let trend = '—';
  let yteol = '—';

  if (lifecycle.toUpperCase() === 'EOL') {
    riskLevel = 'critical';
    trend = '↘';
    yteol = '0y';
  } else if (lifecycle.toUpperCase() === 'NRND') {
    riskLevel = stock === 0 ? 'critical' : 'warning';
    trend = '↘';
    yteol = '2y';
  } else if (stock === 0) {
    riskLevel = 'critical';
    trend = '↘';
    yteol = '1y';
  } else if (stock < 100) {
    riskLevel = 'warning';
    trend = '↘';
    yteol = '6y';
  } else {
    riskLevel = 'healthy';
    trend = stock > 10000 ? '↗' : '—';
    yteol = '10y';
  }

  return {
    ...part,
    lifecycle,
    stock,
    risk_level: riskLevel,
    trend,
    yteol
  };
}

function parseWorkbook(buffer, filename = 'upload.xlsx') {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('No worksheet found in uploaded file');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows.length) {
    throw new Error('Uploaded BOM file is empty');
  }

  const columns = Object.keys(rows[0]);

  const mpnCol = findColumn(columns, ['mpn', 'part number', 'manufacturer part number', 'mfr part number', 'pn']);
  const manufacturerCol = findColumn(columns, ['manufacturer', 'mfr', 'brand']);
  const descriptionCol = findColumn(columns, ['description', 'part description', 'item description']);
  const qtyCol = findColumn(columns, ['qty', 'quantity', 'qnty']);
  const packageCol = findColumn(columns, ['package', 'pkg', 'footprint', 'case']);
  const categoryCol = findColumn(columns, ['category', 'type']);
  const lifecycleCol = findColumn(columns, ['lifecycle', 'status']);
  const stockCol = findColumn(columns, ['stock', 'inventory', 'available']);
  const unitPriceCol = findColumn(columns, ['unit price', 'price', 'unit cost']);
  const complianceCol = findColumn(columns, ['compliance', 'rohs', 'reach']);

  if (!mpnCol) {
    throw new Error('Could not detect an MPN / part number column');
  }

  const parts = rows
    .map((row) => {
      const qty = safeNumber(row[qtyCol], 1);
      const unitPrice = safeNumber(row[unitPriceCol], 0);
      const description = String(row[descriptionCol] || '').trim();
      const category = String(row[categoryCol] || '').trim() || inferCategory(description);

      return assessPart({
        mpn: String(row[mpnCol] || '').trim(),
        manufacturer: String(row[manufacturerCol] || '').trim() || 'Unknown',
        description,
        qty,
        category,
        package: String(row[packageCol] || '').trim() || '—',
        lifecycle: String(row[lifecycleCol] || '').trim() || 'Active',
        stock: safeNumber(row[stockCol], 5000),
        unit_price: unitPrice,
        ext_price: Number((qty * unitPrice).toFixed(2)),
        compliance: String(row[complianceCol] || 'RoHS, REACH')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      });
    })
    .filter((part) => part.mpn);

  if (!parts.length) {
    throw new Error('No valid BOM rows found after parsing');
  }

  return {
    filename,
    totalRows: parts.length,
    parts
  };
}

function parseBase64File(base64, filename) {
  const clean = String(base64 || '').replace(/^data:.*;base64,/, '');
  const buffer = Buffer.from(clean, 'base64');
  return parseWorkbook(buffer, filename);
}

module.exports = {
  parseBase64File
};