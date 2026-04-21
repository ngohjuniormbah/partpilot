const { catalogParts } = require('./catalog');
const { summarizeParts, computeGrade, buildAlerts } = require('./analysis');

const parametricResults = catalogParts
  .filter((item) => item.vinMin != null)
  .map((item) => ({
    mpn: item.mpn,
    manufacturer: item.manufacturer,
    package: item.package,
    vinMin: item.vinMin,
    vinMax: item.vinMax,
    vout: item.vout,
    ioutMax: item.ioutMax,
    noise: item.noise,
    tempMin: item.tempMin,
    tempMax: item.tempMax,
    stock: item.stock,
    price1k: item.price1k ?? item.unitPrice,
    lifecycle: item.lifecycle,
    compliance: item.compliance,
    distributors: item.distributors,
    category: item.category,
  }));

function summarizeDemoParts() {
  const demoParts = catalogParts.slice(0, 12).map((part, index) => ({
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
    compliance: part.compliance,
    distributors: part.distributors,
  }));
  const summary = summarizeParts(demoParts);
  const grade = computeGrade(summary);
  return { demoParts, summary, alerts: buildAlerts(demoParts), grade };
}

module.exports = {
  parametricResults,
  summarizeDemoParts,
};
