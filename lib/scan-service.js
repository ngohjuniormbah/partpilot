const db = require('./db');

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
      unit_price: null,
      ext_price: null,
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
      unit_price: null,
      ext_price: null,
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
    },
    {
      mpn: 'GRM155R71C104KA88D',
      manufacturer: 'Murata',
      description: '100nF 16V X7R 0402',
      qty: 48,
      category: 'Capacitor',
      package: '0402',
      lifecycle: 'Active',
      yteol: '15y',
      stock: 250000,
      unit_price: 0.0044,
      ext_price: 0.21,
      trend: '—',
      compliance: ['RoHS', 'REACH'],
      risk_level: 'healthy'
    },
    {
      mpn: 'RC0402FR-0710KL',
      manufacturer: 'Yageo',
      description: '10KΩ 1% 0402 Resistor',
      qty: 24,
      category: 'Resistor',
      package: '0402',
      lifecycle: 'Active',
      yteol: '18y',
      stock: 500000,
      unit_price: 0.0017,
      ext_price: 0.04,
      trend: '—',
      compliance: ['RoHS', 'REACH'],
      risk_level: 'healthy'
    },
    {
      mpn: 'W25Q128JVSIQ',
      manufacturer: 'Winbond',
      description: '128Mbit SPI Flash',
      qty: 1,
      category: 'Memory',
      package: 'SOIC-8',
      lifecycle: 'Active',
      yteol: '10y',
      stock: 15000,
      unit_price: 1.18,
      ext_price: 1.18,
      trend: '—',
      compliance: ['RoHS', 'REACH'],
      risk_level: 'healthy'
    },
    {
      mpn: 'CSTCE16M0V53-R0',
      manufacturer: 'Murata',
      description: '16MHz Ceramic Resonator',
      qty: 1,
      category: 'Crystal',
      package: '0603',
      lifecycle: 'Active',
      yteol: '14y',
      stock: 32000,
      unit_price: 0.25,
      ext_price: 0.25,
      trend: '↗',
      compliance: ['RoHS', 'REACH'],
      risk_level: 'healthy'
    },
    {
      mpn: 'BAT54S',
      manufacturer: 'Nexperia',
      description: 'Dual Schottky Diode',
      qty: 4,
      category: 'Diode',
      package: 'SOT-23',
      lifecycle: 'Active',
      yteol: '16y',
      stock: 120000,
      unit_price: 0.04,
      ext_price: 0.18,
      trend: '—',
      compliance: ['RoHS', 'REACH'],
      risk_level: 'healthy'
    },
    {
      mpn: 'TPS62160DSGR',
      manufacturer: 'TI',
      description: '1A Step-Down Converter 3-17V',
      qty: 1,
      category: 'Power',
      package: 'WSON-8',
      lifecycle: 'Active',
      yteol: '11y',
      stock: 7200,
      unit_price: 1.76,
      ext_price: 1.76,
      trend: '—',
      compliance: ['RoHS', 'REACH'],
      risk_level: 'healthy'
    }
  ];
}

function buildReport(parts) {
  const criticalParts = parts.filter((p) => p.risk_level === 'critical');
  const warningParts = parts.filter((p) => p.risk_level === 'warning');
  const totalCost = parts.reduce((sum, p) => sum + (Number(p.ext_price) || 0), 0);
  const totalQuantity = parts.reduce((sum, p) => sum + (Number(p.qty) || 0), 0);

  const alerts = [];

  for (const part of criticalParts) {
    if ((part.stock ?? 0) === 0) {
      alerts.push({
        level: 'critical',
        title: `${part.mpn} Out of Stock`,
        description: 'Zero stock across distributors. Immediate sourcing action required.'
      });
    }

    if ((part.lifecycle || '').toUpperCase() === 'EOL') {
      alerts.push({
        level: 'critical',
        title: `${part.mpn} End of Life`,
        description: 'Manufacturer lifecycle status is EOL. Redesign or alternate required.'
      });
    }
  }

  for (const part of warningParts) {
    if ((part.stock ?? 0) > 0 && (part.stock ?? 0) < 100) {
      alerts.push({
        level: 'warning',
        title: `${part.mpn} Low Stock`,
        description: `Only ${part.stock} units available. Monitor allocation risk.`
      });
    }

    if ((part.lifecycle || '').toUpperCase() === 'NRND') {
      alerts.push({
        level: 'warning',
        title: `${part.mpn} Not Recommended`,
        description: 'Lifecycle status is NRND. Plan migration before supply risk increases.'
      });
    }
  }

  return {
    grade: criticalParts.length > 0 ? 'B' : 'A',
    summary:
      criticalParts.length > 0
        ? 'Good — Minor risks, review recommended'
        : 'Healthy — No major supply-chain risks detected',
    totalParts: parts.length,
    totalLines: parts.length,
    totalQuantity,
    totalCost,
    criticalCount: criticalParts.length,
    warningCount: warningParts.length,
    outOfStockCount: parts.filter((p) => (p.stock ?? 0) === 0).length,
    alerts
  };
}

async function createDemoScan() {
  const parts = buildDemoParts();
  const report = buildReport(parts);

  const scanInsert = await db.runQuery(
    `
      insert into scans (
        status, grade, summary, total_parts, total_lines, total_quantity,
        total_cost, critical_count, warning_count, out_of_stock_count
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      returning id, status
    `,
    [
      'completed',
      report.grade,
      report.summary,
      report.totalParts,
      report.totalLines,
      report.totalQuantity,
      report.totalCost,
      report.criticalCount,
      report.warningCount,
      report.outOfStockCount
    ]
  );

  const scan = scanInsert.rows[0];

  for (const part of parts) {
    await db.runQuery(
      `
        insert into parts (
          scan_id, mpn, manufacturer, description, qty, category, package,
          lifecycle, yteol, stock, unit_price, ext_price, trend, compliance, risk_level
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      `,
      [
        scan.id,
        part.mpn,
        part.manufacturer,
        part.description,
        part.qty,
        part.category,
        part.package,
        part.lifecycle,
        part.yteol,
        part.stock,
        part.unit_price,
        part.ext_price,
        part.trend,
        JSON.stringify(part.compliance || []),
        part.risk_level
      ]
    );
  }

  return {
    scanId: scan.id,
    status: scan.status
  };
}

async function getScanStatus(scanId) {
  const result = await db.runQuery(
    `select id, status from scans where id = $1 limit 1`,
    [scanId]
  );

  return result.rows[0] || null;
}

async function getScanReport(scanId) {
  const scanResult = await db.runQuery(
    `
      select
        id, status, grade, summary, total_parts, total_lines, total_quantity,
        total_cost, critical_count, warning_count, out_of_stock_count
      from scans
      where id = $1
      limit 1
    `,
    [scanId]
  );

  const scan = scanResult.rows[0];
  if (!scan) return null;

  const partsResult = await db.runQuery(
    `
      select mpn, stock, lifecycle, risk_level
      from parts
      where scan_id = $1
      order by id asc
    `,
    [scanId]
  );

  const alerts = [];

  for (const part of partsResult.rows) {
    if (part.risk_level === 'critical' && Number(part.stock || 0) === 0) {
      alerts.push({
        level: 'critical',
        title: `${part.mpn} Out of Stock`,
        description: 'Zero stock across distributors. Immediate sourcing action required.'
      });
    }

    if ((part.lifecycle || '').toUpperCase() === 'EOL') {
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

    if ((part.lifecycle || '').toUpperCase() === 'NRND') {
      alerts.push({
        level: 'warning',
        title: `${part.mpn} Not Recommended`,
        description: 'Lifecycle status is NRND. Plan migration before supply risk increases.'
      });
    }
  }

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

module.exports = {
  createDemoScan,
  getScanStatus,
  getScanReport
};