const { createDemoScan } = require('../lib/scan-service');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed'
      });
    }

    const result = await createDemoScan();

    return res.status(200).json({
      ok: true,
      scanId: result.scanId,
      status: result.status || 'processing'
    });
  } catch (error) {
    console.error('demo-scan error:', error);

    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to create demo scan'
    });
  }
};