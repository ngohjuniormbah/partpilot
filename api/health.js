const { query } = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    const result = await query('select now() as now');

    return res.status(200).json({
      ok: true,
      database: 'connected',
      time: result.rows[0].now
    });
  } catch (error) {
    console.error('health error:', error);

    return res.status(500).json({
      ok: false,
      error: error.message || 'Health check failed'
    });
  }
};