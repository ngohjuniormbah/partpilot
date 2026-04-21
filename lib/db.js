const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const FILE_DB_PATH = path.join('/tmp', 'partpilot-db.json');
let pool;
let schemaReady = false;

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

async function getPool() {
  if (!hasDatabase()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
  }
  if (!schemaReady) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bom_scans (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        sheet_name TEXT,
        status TEXT NOT NULL,
        source_type TEXT NOT NULL DEFAULT 'upload',
        original_row_count INTEGER NOT NULL DEFAULT 0,
        total_lines INTEGER NOT NULL DEFAULT 0,
        total_qty NUMERIC NOT NULL DEFAULT 0,
        critical_count INTEGER NOT NULL DEFAULT 0,
        warning_count INTEGER NOT NULL DEFAULT 0,
        healthy_count INTEGER NOT NULL DEFAULT 0,
        bom_total NUMERIC NOT NULL DEFAULT 0,
        grade TEXT,
        verdict TEXT,
        alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bom_parts (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL REFERENCES bom_scans(id) ON DELETE CASCADE,
        row_number INTEGER NOT NULL,
        mpn TEXT NOT NULL,
        manufacturer TEXT,
        description TEXT,
        qty NUMERIC NOT NULL DEFAULT 0,
        category TEXT,
        package TEXT,
        lifecycle TEXT,
        yteol TEXT,
        stock NUMERIC NOT NULL DEFAULT 0,
        unit_price NUMERIC,
        ext_price NUMERIC,
        trend TEXT,
        risk TEXT,
        compliance JSONB NOT NULL DEFAULT '[]'::jsonb,
        distributors JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS watch_subscriptions (
        id TEXT PRIMARY KEY,
        scan_id TEXT REFERENCES bom_scans(id) ON DELETE SET NULL,
        email TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_bom_parts_scan_id ON bom_parts(scan_id);
      CREATE INDEX IF NOT EXISTS idx_bom_parts_mpn ON bom_parts(mpn);
      CREATE INDEX IF NOT EXISTS idx_watch_subscriptions_email ON watch_subscriptions(email);
    `);
    schemaReady = true;
  }
  return pool;
}

function readFileStore() {
  if (!fs.existsSync(FILE_DB_PATH)) {
    return { scans: [], parts: [], watches: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(FILE_DB_PATH, 'utf8'));
  } catch {
    return { scans: [], parts: [], watches: [] };
  }
}

function writeFileStore(data) {
  fs.writeFileSync(FILE_DB_PATH, JSON.stringify(data, null, 2));
}

async function getStoreMode() {
  return (await getPool()) ? 'postgres' : 'file';
}

async function saveScan(scan, parts) {
  const pg = await getPool();
  if (pg) {
    const client = await pg.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO bom_scans (
          id, filename, sheet_name, status, source_type, original_row_count, total_lines, total_qty,
          critical_count, warning_count, healthy_count, bom_total, grade, verdict, alerts, metadata, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,NOW())
        ON CONFLICT (id) DO UPDATE SET
          filename=EXCLUDED.filename,
          sheet_name=EXCLUDED.sheet_name,
          status=EXCLUDED.status,
          source_type=EXCLUDED.source_type,
          original_row_count=EXCLUDED.original_row_count,
          total_lines=EXCLUDED.total_lines,
          total_qty=EXCLUDED.total_qty,
          critical_count=EXCLUDED.critical_count,
          warning_count=EXCLUDED.warning_count,
          healthy_count=EXCLUDED.healthy_count,
          bom_total=EXCLUDED.bom_total,
          grade=EXCLUDED.grade,
          verdict=EXCLUDED.verdict,
          alerts=EXCLUDED.alerts,
          metadata=EXCLUDED.metadata,
          updated_at=NOW()`,
        [
          scan.id, scan.filename, scan.sheetName, scan.status, scan.sourceType || 'upload', scan.originalRowCount || 0,
          scan.summary.totalLines, scan.summary.totalQty, scan.summary.critical, scan.summary.warning, scan.summary.healthy,
          scan.summary.bomTotal, scan.grade, scan.verdict, JSON.stringify(scan.alerts || []), JSON.stringify(scan.metadata || {}),
        ]
      );
      await client.query('DELETE FROM bom_parts WHERE scan_id = $1', [scan.id]);
      for (const part of parts) {
        await client.query(
          `INSERT INTO bom_parts (
            id, scan_id, row_number, mpn, manufacturer, description, qty, category, package,
            lifecycle, yteol, stock, unit_price, ext_price, trend, risk, compliance, distributors
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb)`,
          [
            part.id, scan.id, part.rowNumber, part.mpn, part.manufacturer, part.description, part.qty, part.category,
            part.package, part.lifecycle, part.yteol, part.stock, part.unitPrice, part.extPrice, part.trend, part.risk,
            JSON.stringify(part.compliance || []), JSON.stringify(part.distributors || []),
          ]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return scan;
  }

  const store = readFileStore();
  store.scans = store.scans.filter((item) => item.id !== scan.id);
  store.parts = store.parts.filter((item) => item.scanId !== scan.id);
  store.scans.unshift({ ...scan, createdAt: scan.createdAt || new Date().toISOString() });
  store.parts.push(...parts.map((part) => ({ ...part, scanId: scan.id })));
  writeFileStore(store);
  return scan;
}

async function getScan(scanId) {
  const pg = await getPool();
  if (pg) {
    const { rows } = await pg.query('SELECT * FROM bom_scans WHERE id = $1 LIMIT 1', [scanId]);
    return rows[0] ? mapScanRow(rows[0]) : null;
  }
  const store = readFileStore();
  return store.scans.find((item) => item.id === scanId) || null;
}

async function getLatestScan() {
  const pg = await getPool();
  if (pg) {
    const { rows } = await pg.query('SELECT * FROM bom_scans ORDER BY created_at DESC LIMIT 1');
    return rows[0] ? mapScanRow(rows[0]) : null;
  }
  const store = readFileStore();
  return store.scans[0] || null;
}

async function listParts(scanId) {
  const pg = await getPool();
  if (pg) {
    const { rows } = await pg.query('SELECT * FROM bom_parts WHERE scan_id = $1 ORDER BY row_number ASC', [scanId]);
    return rows.map(mapPartRow);
  }
  const store = readFileStore();
  return store.parts.filter((item) => item.scanId === scanId).sort((a, b) => a.rowNumber - b.rowNumber);
}

async function saveWatchSubscription({ id, scanId, email }) {
  const pg = await getPool();
  if (pg) {
    await pg.query('INSERT INTO watch_subscriptions (id, scan_id, email) VALUES ($1,$2,$3)', [id, scanId || null, email]);
    return;
  }
  const store = readFileStore();
  store.watches.push({ id, scanId, email, createdAt: new Date().toISOString() });
  writeFileStore(store);
}

function mapScanRow(row) {
  return {
    id: row.id,
    filename: row.filename,
    sheetName: row.sheet_name,
    status: row.status,
    sourceType: row.source_type,
    originalRowCount: Number(row.original_row_count || 0),
    summary: {
      totalLines: Number(row.total_lines || 0),
      totalQty: Number(row.total_qty || 0),
      critical: Number(row.critical_count || 0),
      warning: Number(row.warning_count || 0),
      healthy: Number(row.healthy_count || 0),
      bomTotal: Number(row.bom_total || 0),
    },
    grade: row.grade,
    verdict: row.verdict,
    alerts: row.alerts || [],
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPartRow(row) {
  return {
    id: row.id,
    rowNumber: Number(row.row_number),
    mpn: row.mpn,
    manufacturer: row.manufacturer,
    description: row.description,
    qty: Number(row.qty || 0),
    category: row.category,
    package: row.package,
    lifecycle: row.lifecycle,
    yteol: row.yteol,
    stock: Number(row.stock || 0),
    unitPrice: row.unit_price == null ? null : Number(row.unit_price),
    extPrice: row.ext_price == null ? null : Number(row.ext_price),
    trend: row.trend,
    risk: row.risk,
    compliance: row.compliance || [],
    distributors: row.distributors || [],
  };
}

module.exports = {
  getStoreMode,
  saveScan,
  getScan,
  getLatestScan,
  listParts,
  saveWatchSubscription,
};
