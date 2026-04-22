const { getSupabase } = require('./supabase');
const { parseBase64File } = require('./bom-parser');

function buildDemoParts() {
  return [
    {
      mpn: 'FT232RL-REEL',
      manufacturer: 'FTDI',
      description: 'USB to UART Bridge',
      qty: 1,
      category: 'Interface',
      package: 'SSOP-28',
      lifecycle: 'EOL',
      yteol: '0y',
      stock: 0,
      unit_price: 0,
      ext_price: 0,
      trend: '↘',
      compliance: ['RoHS'],
      risk_level: 'critical'
    },
    {
      mpn: 'ADP7142ARDZ-3.3',
      manufacturer: 'Analog Devices',
      description: 'Low Noise 3.3V LDO 200mA',
      qty: 1,
      category: 'Power',
      package: 'SOIC-8',
      lifecycle: 'NRND',
      yteol: '1y',
      stock: 0,
      unit_price: 0,
      ext_price: 0,
      trend: '↘',
      compliance: ['RoHS'],
      risk_level: 'critical'
    },
    {
      mpn: 'LM1117MPX-3.3',
      manufacturer: 'TI',
      description: '3.3V LDO Regulator 800mA',
      qty: 2,
      category: 'Power',
      package: 'SOT-223',
      lifecycle: 'NRND',
      yteol: '2y',
      stock: 45,
      unit_price: 1.02,
      ext_price: 2.04,
      trend: '↘',
      compliance: ['RoHS'],
      risk_level: 'warning'
    },
    {
      mpn: 'SN65HVD230DR',
      manufacturer: 'TI',
      description: 'CAN Bus Transceiver',
      qty: 2,
      category: 'Interface',
      package: 'SOIC-8',
      lifecycle: 'Active',
      yteol: '8y',
      stock: 80,
      unit_price: 2.09,
      ext_price: 4.18,
      trend: '—',
      compliance: ['RoHS', 'AEC-Q100'],
      risk_level: 'warning'
    },
    {
      mpn: 'ESD7004MUTAG',
      manufacturer: 'ON Semi',
      description: 'TVS Diode Array USB ESD',
      qty: 2,
      category: 'Protection',
      package: 'SOT-553',
      lifecycle: 'Active',
      yteol: '6y',
      stock: 30,
      unit_price: 0.19,
      ext_price: 0.39,
      trend: '—',
      compliance: ['RoHS'],
      risk_level: 'warning'
    },
    {
      mpn: 'STM32F407VGT6',
      manufacturer: 'STMicroelectronics',
      description: 'ARM Cortex-M4 MCU 168MHz 1MB',
      qty: 1,
      category: 'MCU',
      package: 'LQFP-100',
      lifecycle: 'Active',
      yteol: '12y',
      stock: 8500,
      unit_price: 6.88,
      ext_price: 6.88,
      trend: '—',
      compliance: ['RoHS', 'REACH'],
      risk_level: 'healthy'
    }
  ];
}

function buildSummary(parts) {
  const totalCost = parts.reduce((sum, p) => sum + (Number(p.ext_price) || 0), 0);
  const totalQuantity = parts.reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
  const criticalCount = parts.filter((p) => p.risk_level === 'critical').length;
  const warningCount = parts.filter((p) => p.risk_level === 'warning').length;
  const outOfStockCount = parts.filter((p) => Number(p.stock || 0) === 0).length;

  const alerts = [];

  for (const part of parts) {
    if (part.risk_level === 'critical' && Number(part.stock || 0) === 0) {
      alerts.push({
        level: 'critical',
        title: `${part.mpn} Out of Stock`,
        description: 'Zero stock across distributors. Immediate sourcing action required.'
      });
    }

    if (String(part.lifecycle || '').toUpperCase() === 'EOL') {
      alerts.push({
        level: 'critical',
        title: `${part.mpn} End of Life`,
        description: 'Manufacturer lifecycle status is EOL. Redesign or alternate required.'
      });
    }

    if (part.risk_level === 'warning' && Number(part.stock || 0) > 0 && Number(part.stock || 0) < 100) {
      alerts.push({
        level: 'warning',
        title: `${part.mpn} Low Stock`,
        description: `Only ${part.stock} units available. Monitor allocation risk.`
      });
    }

    if (String(part.lifecycle || '').toUpperCase() === 'NRND') {
      alerts.push({
        level: 'warning',
        title: `${part.mpn} Not Recommended`,
        description: 'Lifecycle status is NRND. Plan migration before supply risk increases.'
      });
    }
  }

  return {
    grade: criticalCount > 0 ? 'B' : 'A',
    summary:
      criticalCount > 0
        ? 'Good — Minor risks, review recommended'
        : 'Healthy — No major supply-chain risks detected',
    total_parts: parts.length,
    total_lines: parts.length,
    total_quantity: totalQuantity,
    total_cost: Number(totalCost.toFixed(2)),
    critical_count: criticalCount,
    warning_count: warningCount,
    out_of_stock_count: outOfStockCount,
    alerts
  };
}

async function insertScanAndParts(parts, source = 'demo', filename = null) {
  const supabase = getSupabase();
  const summary = buildSummary(parts);

  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .insert({
      status: 'completed',
      source,
      filename,
      grade: summary.grade,
      summary: summary.summary,
      total_parts: summary.total_parts,
      total_lines: summary.total_lines,
      total_quantity: summary.total_quantity,
      total_cost: summary.total_cost,
      critical_count: summary.critical_count,
      warning_count: summary.warning_count,
      out_of_stock_count: summary.out_of_stock_count
    })
    .select()
    .single();

  if (scanError) throw scanError;

  const rows = parts.map((part) => ({
    scan_id: scan.id,
    mpn: part.mpn,
    manufacturer: part.manufacturer,
    description: part.description,
    qty: part.qty,
    category: part.category,
    package: part.package,
    lifecycle: part.lifecycle,
    yteol: part.yteol,
    stock: part.stock,
    unit_price: part.unit_price,
    ext_price: part.ext_price,
    trend: part.trend,
    compliance: JSON.stringify(part.compliance || []),
    risk_level: part.risk_level
  }));

  const { error: partsError } = await supabase.from('parts').insert(rows);
  if (partsError) throw partsError;

  return {
    scanId: scan.id,
    status: scan.status
  };
}

async function createDemoScan() {
  return insertScanAndParts(buildDemoParts(), 'demo', 'demo-bom');
}

async function createScanFromUpload({ base64, filename }) {
  const parsed = parseBase64File(base64, filename);
  return insertScanAndParts(parsed.parts, 'upload', parsed.filename);
}

async function getScanStatus(scanId) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('scans')
    .select('id,status')
    .eq('id', scanId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

async function getScanReport(scanId) {
  const supabase = getSupabase();

  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .select('*')
    .eq('id', scanId)
    .single();

  if (scanError) {
    if (scanError.code === 'PGRST116') return null;
    throw scanError;
  }

  const { data: parts, error: partsError } = await supabase
    .from('parts')
    .select('mpn,stock,lifecycle,risk_level')
    .eq('scan_id', scanId)
    .order('id', { ascending: true });

  if (partsError) throw partsError;

  const alerts = buildSummary(parts).alerts;

  return {
    grade: scan.grade,
    summary: scan.summary,
    totalParts: Number(scan.total_parts || 0),
    totalLines: Number(scan.total_lines || 0),
    totalQuantity: Number(scan.total_quantity || 0),
    totalCost: Number(scan.total_cost || 0),
    criticalCount: Number(scan.critical_count || 0),
    warningCount: Number(scan.warning_count || 0),
    outOfStockCount: Number(scan.out_of_stock_count || 0),
    alerts
  };
}

async function getScanParts(scanId) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('parts')
    .select('*')
    .eq('scan_id', scanId)
    .order('id', { ascending: true });

  if (error) throw error;

  return data.map((row) => ({
    ...row,
    compliance: parseCompliance(row.compliance)
  }));
}

async function saveWatch({ email, scanId }) {
  const supabase = getSupabase();

  const { error } = await supabase.from('watchlist').insert({
    email,
    scan_id: scanId || null
  });

  if (error) throw error;

  return { ok: true };
}

function parseCompliance(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    return JSON.parse(value);
  } catch {
    return String(value)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
}

module.exports = {
  createDemoScan,
  createScanFromUpload,
  getScanStatus,
  getScanReport,
  getScanParts,
  saveWatch
};