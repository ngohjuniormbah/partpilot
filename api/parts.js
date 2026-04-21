const { query } = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed'
      });
    }

    const { scanId } = req.query;

    if (!scanId) {
      return res.status(400).json({
        ok: false,
        error: 'scanId is required'
      });
    }

    const result = await query(
      `
        select
          mpn,
          manufacturer,
          description,
          qty,
          category,
          package,
          lifecycle,
          yteol,
          stock,
          unit_price,
          ext_price,
          trend,
          compliance,
          risk_level
        from parts
        where scan_id = $1
        order by id asc
      `,
      [scanId]
    );

    const parts = result.rows.map(part => ({
      ...part,
      compliance: parseCompliance(part.compliance)
    }));

    return res.status(200).json({
      ok: true,
      parts
    });
  } catch (error) {
    console.error('parts error:', error);

    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get parts'
    });
  }
};

function parseCompliance(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    return JSON.parse(value);
  } catch {
    return String(value)
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  }
}