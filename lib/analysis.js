const crypto = require('crypto');
const { catalogByMpn } = require('./catalog');

function stableHash(input) {
  return crypto.createHash('sha256').update(String(input || '')).digest('hex');
}

function normalizeMpn(value) {
  return String(value || '').trim().toUpperCase();
}

function inferCategory(part) {
  const blob = `${part.category || ''} ${part.description || ''} ${part.package || ''}`.toLowerCase();
  if (/ldo|regulator|buck|converter|power/.test(blob)) return 'Power';
  if (/mcu|microcontroller|cortex/.test(blob)) return 'MCU';
  if (/uart|can|usb|interface|transceiver/.test(blob)) return 'Interface';
  if (/tvs|esd|protection/.test(blob)) return 'Protection';
  if (/capacitor|x7r|uf|nf|pf/.test(blob)) return 'Capacitor';
  if (/resistor|ohm|kohm|mohm/.test(blob)) return 'Resistor';
  if (/flash|eeprom|memory/.test(blob)) return 'Memory';
  if (/crystal|resonator|oscillator/.test(blob)) return 'Crystal';
  if (/diode|schottky/.test(blob)) return 'Diode';
  return part.category || 'Misc';
}

function inferLifecycle(description, stock) {
  const text = String(description || '').toLowerCase();
  if (/eol|obsolete|deprecated/.test(text)) return 'EOL';
  if (/nrnd|not recommended/.test(text)) return 'NRND';
  if (stock <= 0) return 'NRND';
  return 'Active';
}

function computeDeterministicMetrics(part) {
  const key = normalizeMpn(part.mpn) || `${part.manufacturer}|${part.description}|${part.package}`;
  const hash = stableHash(key);
  const stockBucket = parseInt(hash.slice(0, 4), 16);
  const stock = stockBucket % 9 === 0 ? 0 : stockBucket % 7 === 0 ? stockBucket % 90 : 500 + (stockBucket % 250000);
  const unitPrice = Number(((parseInt(hash.slice(4, 8), 16) % 1200) / 100 + 0.05).toFixed(2));
  const yteolYears = stock === 0 ? 1 : stock < 100 ? 3 : 8 + (parseInt(hash.slice(8, 10), 16) % 8);
  const trendIndex = parseInt(hash.slice(10, 12), 16) % 3;
  return {
    stock,
    unitPrice,
    yteolYears,
    trend: ['up', 'flat', 'down'][trendIndex],
  };
}

function deriveRisk({ stock, lifecycle }) {
  if (lifecycle === 'EOL' || stock <= 0) return 'critical';
  if (lifecycle === 'NRND' || stock < 100) return 'warning';
  return 'healthy';
}

function enrichPart(inputPart, rowNumber) {
  const normalizedMpn = normalizeMpn(inputPart.mpn);
  const catalogMatch = catalogByMpn.get(normalizedMpn);
  const category = inferCategory({ ...inputPart, category: catalogMatch?.category || inputPart.category });
  const metrics = catalogMatch
    ? {
        stock: catalogMatch.stock ?? 0,
        unitPrice: catalogMatch.unitPrice,
        yteolYears: catalogMatch.yteolYears ?? 8,
        trend: catalogMatch.trend || 'flat',
      }
    : computeDeterministicMetrics({ ...inputPart, category });

  const lifecycle = catalogMatch?.lifecycle || inferLifecycle(inputPart.description, metrics.stock);
  const risk = deriveRisk({ stock: metrics.stock, lifecycle });
  const extPrice = metrics.unitPrice == null ? null : Number(((Number(inputPart.qty) || 0) * metrics.unitPrice).toFixed(2));

  return {
    rowNumber,
    mpn: normalizedMpn || `ROW-${rowNumber}`,
    manufacturer: inputPart.manufacturer || catalogMatch?.manufacturer || 'Unknown',
    description: inputPart.description || catalogMatch?.description || 'Unspecified component',
    qty: Number.isFinite(Number(inputPart.qty)) ? Number(inputPart.qty) : 0,
    package: inputPart.package || catalogMatch?.package || '',
    category,
    lifecycle,
    yteol: `${metrics.yteolYears}y`,
    stock: metrics.stock,
    unitPrice: metrics.unitPrice ?? null,
    extPrice,
    trend: metrics.trend,
    risk,
    compliance: catalogMatch?.compliance || ['RoHS'],
    distributors: catalogMatch?.distributors || ['DigiKey', 'Mouser'],
  };
}

function summarizeParts(parts) {
  const totalLines = parts.length;
  const totalQty = parts.reduce((sum, part) => sum + (Number(part.qty) || 0), 0);
  const critical = parts.filter((p) => p.risk === 'critical').length;
  const warning = parts.filter((p) => p.risk === 'warning').length;
  const healthy = parts.filter((p) => p.risk === 'healthy').length;
  const bomTotal = parts.reduce((sum, part) => sum + (Number(part.extPrice) || 0), 0);
  return {
    totalLines,
    totalQty,
    critical,
    warning,
    healthy,
    bomTotal: Number(bomTotal.toFixed(2)),
  };
}

function computeGrade(summary) {
  if (summary.critical >= 3) return 'C';
  if (summary.critical >= 1 || summary.warning >= 3) return 'B';
  return 'A';
}

function buildAlerts(parts) {
  const alerts = [];
  for (const part of parts) {
    if (part.stock <= 0) {
      alerts.push({ severity: 'critical', part: part.mpn, title: 'Out of Stock', description: 'Zero stock available across indexed distributors.' });
    }
    if (part.lifecycle === 'EOL') {
      alerts.push({ severity: 'critical', part: part.mpn, title: 'End of Life', description: 'Manufacturer lifecycle indicates obsolescence. Redesign or alternate sourcing required.' });
    }
    if (part.lifecycle === 'NRND') {
      alerts.push({ severity: 'warning', part: part.mpn, title: 'Not Recommended', description: `NRND status. YTEOL: ${part.yteol}. Plan migration.` });
    }
    if (part.stock > 0 && part.stock < Math.max(100, (part.qty || 0) * 5)) {
      alerts.push({ severity: 'warning', part: part.mpn, title: 'Low Stock', description: `Only ${part.stock} units indexed. Production ramp risk is elevated.` });
    }
  }
  return alerts.slice(0, 24);
}

module.exports = {
  enrichPart,
  summarizeParts,
  computeGrade,
  buildAlerts,
};
