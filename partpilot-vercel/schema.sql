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

CREATE INDEX IF NOT EXISTS idx_bom_parts_scan_id ON bom_parts(scan_id);
CREATE INDEX IF NOT EXISTS idx_bom_parts_mpn ON bom_parts(mpn);

CREATE TABLE IF NOT EXISTS watch_subscriptions (
  id TEXT PRIMARY KEY,
  scan_id TEXT REFERENCES bom_scans(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
