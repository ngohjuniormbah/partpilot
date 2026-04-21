const crypto = require('crypto');
const { parseBomBuffer } = require('./bom-parser');
const { enrichPart, summarizeParts, computeGrade, buildAlerts } = require('./analysis');
const { saveScan, getScan, getLatestScan, listParts } = require('./db');
const { catalogParts } = require('./catalog');

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

function verdictForGrade(grade) {
  if (grade === 'A') return 'Strong — Healthy supply posture';
  if (grade === 'B') return 'Good — Minor risks, review recommended';
  return 'High risk — redesign recommended';
}

async function processBomUpload({ filename, buffer, sourceType = 'upload' }) {
  const parsed = parseBomBuffer(filename, buffer);
  const scanId = createId('scan');
  const parts = parsed.rows.map((row, index) => ({ id: createId('part'), ...enrichPart(row, index + 1) }));
  const summary = summarizeParts(parts);
  const grade = computeGrade(summary);
  const alerts = buildAlerts(parts);

  const scan = {
    id: scanId,
    filename: parsed.filename,
    sheetName: parsed.sheetName,
    status: 'completed',
    sourceType,
    originalRowCount: parsed.rows.length,
    summary,
    grade,
    verdict: verdictForGrade(grade),
    alerts,
    metadata: {
      acceptedExtensions: ['csv', 'xls', 'xlsx'],
    },
    createdAt: new Date().toISOString(),
  };

  await saveScan(scan, parts);
  return { scan, parts };
}

async function buildDemoScan() {
  const latest = await getLatestScan();
  if (latest && latest.sourceType === 'demo') {
    const parts = await listParts(latest.id);
    return { scan: latest, parts };
  }

  const scanId = createId('scan');
  const parts = catalogParts.slice(0, 12).map((part, index) => ({
    id: createId('part'),
    rowNumber: index + 1,
    mpn: part.mpn,
    manufacturer: part.manufacturer,
    description: part.description,
    qty: [1,1,2,2,2,1,48,24,1,1,4,1][index] || 1,
    category: part.category,
    package: part.package,
    lifecycle: part.lifecycle,
    yteol: `${part.yteolYears}y`,
    stock: part.stock,
    unitPrice: part.unitPrice,
    extPrice: part.unitPrice == null ? null : Number(((( [1,1,2,2,2,1,48,24,1,1,4,1][index] || 1) * part.unitPrice)).toFixed(2)),
    trend: part.trend,
    risk: part.lifecycle === 'EOL' || part.stock <= 0 ? 'critical' : part.lifecycle === 'NRND' || part.stock < 100 ? 'warning' : 'healthy',
    compliance: part.compliance || ['RoHS'],
    distributors: part.distributors || ['DigiKey', 'Mouser'],
  }));
  const summary = summarizeParts(parts);
  const grade = computeGrade(summary);
  const scan = {
    id: scanId,
    filename: 'demo-bom.xlsx',
    sheetName: 'BOM',
    status: 'completed',
    sourceType: 'demo',
    originalRowCount: parts.length,
    summary,
    grade,
    verdict: verdictForGrade(grade),
    alerts: buildAlerts(parts),
    metadata: { demo: true },
    createdAt: new Date().toISOString(),
  };
  await saveScan(scan, parts);
  return { scan, parts };
}

async function getScanBundle(scanId) {
  const scan = scanId ? await getScan(scanId) : await getLatestScan();
  if (!scan) return null;
  const parts = await listParts(scan.id);
  return { scan, parts };
}

module.exports = {
  processBomUpload,
  buildDemoScan,
  getScanBundle,
};
